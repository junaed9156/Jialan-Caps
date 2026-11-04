// Regression checks for language routing, render scheduling and scene lifecycle.
// Uses real three.js geometry with a renderer double; browser/GPU visual QA is separate.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { Texture } from 'three';

class Classes extends Set {
  contains(v) { return this.has(v); }
  remove(...values) { values.forEach(v => this.delete(v)); }
  add(...values) { values.forEach(v => super.add(v)); }
  toggle(v, force = !this.has(v)) { force ? this.add(v) : this.delete(v); return force; }
}
const ctx2d = new Proxy({}, { get(target, key) {
  if (key === 'measureText') return text => ({ width: text.length * 32 });
  if (/^create.*Gradient$/.test(key)) return () => ({ addColorStop() {} });
  return target[key] ?? (() => {});
} });
class Element extends EventTarget {
  constructor() { super(); this.classList = new Classes(); this.style = {}; this.dataset = {}; this.attrs = new Map(); this.nodes = new Map(); this.children = []; this.value = ''; this.textContent = ''; this.clientWidth = 800; this.clientHeight = 600; }
  setAttribute(k, v) { this.attrs.set(k, String(v)); }
  getAttribute(k) { return this.attrs.get(k); }
  querySelector(k) { if (!this.nodes.has(k)) this.nodes.set(k, new Element()); return this.nodes.get(k); }
  querySelectorAll() { return []; }
  prepend(el) { this.children.unshift(el); }
  getBoundingClientRect() { return { top: 0, left: 0, width: this.clientWidth, height: this.clientHeight }; }
  getContext() { return ctx2d; }
  closest() { return null; }
}
const doc = new Element();
doc.documentElement = new Element(); doc.body = new Element(); doc.hidden = false;
doc.getElementById = id => doc.querySelector('#' + id);
doc.createElement = () => new Element(); doc.createElementNS = () => new Element();
const queries = new Map();
const match = query => {
  if (!queries.has(query)) { const q = new EventTarget(); q.matches = false; queries.set(query, q); }
  return queries.get(query);
};
let nextFrame = 1; const frames = new Map();
const flush = now => { const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn(now)); };
class Observer {
  static all = [];
  constructor(callback) { this.callback = callback; Observer.all.push(this); }
  observe(target) { this.target = target; }
  disconnect() {}
  emit(visible) { this.callback([{ target: this.target, isIntersecting: visible }]); }
}
class Resize {
  static all = [];
  constructor(callback) { this.callback = callback; Resize.all.push(this); }
  observe() {}
}
const win = new EventTarget();
Object.assign(win, { devicePixelRatio: 2, IntersectionObserver: Observer });
Object.assign(globalThis, {
  window: win, document: doc, screen: { width: 1440, height: 900 }, matchMedia: match,
  Image: Element,
  IntersectionObserver: Observer, ResizeObserver: Resize, innerHeight: 600,
  requestAnimationFrame: fn => { const id = nextFrame++; frames.set(id, fn); return id; },
  cancelAnimationFrame: id => frames.delete(id), addEventListener: (...args) => win.addEventListener(...args),
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { deviceMemory: 8, hardwareConcurrency: 8 } });
const kit = await import('../src/3d/kit.js');

test('normal URL always uses English, including a previously saved Chinese preference', () => {
  for (const query of ['', '?lang=en', '?lang=invalid', '?lang=zh']) {
    const html = new Element();
    const document = { documentElement: html, body: new Element(), querySelector: () => null, getElementById: () => null,
      createTreeWalker: () => ({ nextNode: () => null }) };
    const w = {}; w.self = w; w.top = w;
    const sandbox = { document, window: w, location: { search: query }, URLSearchParams,
      localStorage: { getItem: () => { throw new Error('Language must not depend on storage'); } },
      NodeFilter: { SHOW_ELEMENT: 1, SHOW_TEXT: 4 }, MutationObserver: class { observe() {} }, setTimeout() {} };
    runInNewContext(readFileSync(new URL('../dist/lang-boot.js', import.meta.url), 'utf8'), sandbox);
    runInNewContext(readFileSync(new URL('../dist/i18n.js', import.meta.url), 'utf8'), sandbox);
    assert.equal(w.I18N.lang, query === '?lang=zh' ? 'zh' : 'en');
    assert.equal(html.lang, query === '?lang=zh' ? 'zh-CN' : 'en');
  }
});

test('renderer caches layout and lowers resolution under sustained slow frames', () => {
  let reads = 0;
  const el = { get clientWidth() { reads++; return 1000; }, get clientHeight() { reads++; return 600; } };
  let ratio = 1.5, resizes = 0, renders = 0;
  const r = { getPixelRatio: () => ratio, setPixelRatio: v => { ratio = v; }, setSize: () => resizes++, render: () => renders++ };
  const camera = { updateProjectionMatrix() {} };
  assert.equal(kit.fit(r, camera, el), true);
  for (let i = 0; i < 120; i++) kit.fit(r, camera, el);
  assert.equal(reads, 2); assert.equal(resizes, 1);
  for (let i = 0; i < 180; i++) kit.renderFrame(r, {}, camera, 1000 + i * 40);
  assert.ok(ratio < 1.5 && ratio >= 0.8); assert.equal(renders, 180);
  // Widely separated interactions must not be counted as a slow animation.
  ratio = 1.5;
  for (let i = 0; i < 120; i++) kit.renderFrame(r, {}, camera, 20000 + i * 1000);
  assert.equal(ratio, 1.5);
});

test('visibility pauses GPU work behind dialogs and hidden browser tabs', () => {
  const changes = [];
  const visible = kit.whenVisible(new Element(), value => changes.push(value));
  Observer.all.at(-1).emit(true); assert.equal(visible(), true);
  doc.body.classList.add('modal-open'); doc.dispatchEvent(new Event('jialan:overlay'));
  assert.equal(visible(), false);
  doc.body.classList.remove('modal-open'); doc.dispatchEvent(new Event('jialan:overlay'));
  assert.equal(visible(), true);
  doc.hidden = true; doc.dispatchEvent(new Event('visibilitychange')); assert.equal(visible(), false);
  doc.hidden = false; doc.dispatchEvent(new Event('visibilitychange')); assert.equal(visible(), true);
  Observer.all.at(-1).emit(false); assert.equal(visible(), false);
  assert.deepEqual(changes, [true, false, true, false, true, false]);
});

test('assembly clock clamps stalls and resumes without skipping the animation', async () => {
  const { mountSequence } = await import('../src/3d/sequence.js');
  const stage = new Element();
  const sequence = mountSequence(stage);
  let time = 0; sequence.subscribe((pose, ambient) => { time = ambient; });
  Observer.all.at(-1).emit(true); flush(1000); flush(1016); flush(5016);
  assert.ok(time > 0 && time < 0.08, `A stalled frame jumped to ${time}s`);
  Observer.all.at(-1).emit(false); assert.equal(frames.size, 0);
  Observer.all.at(-1).emit(true); flush(12000); assert.ok(time < 0.08);
  Observer.all.at(-1).emit(false);
});

test('all scenes mount, draw finite cameras, pause, and recover after GPU context restoration', async () => {
  const renderers = [];
  class Renderer {
    constructor({ canvas }) { this.canvas = canvas; this.ratio = 1; this.draws = 0; renderers.push(this); }
    getPixelRatio() { return this.ratio; }
    setPixelRatio(value) { this.ratio = value; }
    setSize() {}
    async compileAsync() {}
    render(scene, camera) { assert.ok(camera.projectionMatrix.elements.every(Number.isFinite)); this.draws++; }
  }
  kit.THREE.WebGLRenderer = Renderer;
  kit.THREE.PMREMGenerator = class { fromScene() { return { texture: new Texture() }; } dispose() {} };
  const { mountSequence } = await import('../src/3d/sequence.js');
  const stage = new Element();
  const start = Observer.all.length;
  await (await import('../src/3d/hero.js')).mount(stage, mountSequence(stage));
  await (await import('../src/3d/anatomy.js')).mount(new Element());
  await (await import('../src/3d/studio.js')).mount(new Element());
  const observers = Observer.all.slice(start);
  observers.forEach(io => io.emit(true));
  for (let i = 0; i < 8; i++) flush(20000 + i * 16);
  assert.equal(renderers.length, 3);
  assert.ok(renderers.every(r => r.draws > 0));
  doc.body.classList.add('motion-paused'); doc.dispatchEvent(new Event('jialan:motion'));
  flush(21000); flush(21016); assert.equal(frames.size, 0, 'Paused scenes should not keep rendering');
  const studio = renderers[2];
  studio.canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
  const previous = studio.draws;
  doc.dispatchEvent(new Event('jialan:motion')); flush(22000);
  assert.equal(studio.draws, previous);
  studio.canvas.dispatchEvent(new Event('webglcontextrestored'));
  await new Promise(resolve => setImmediate(resolve)); flush(23000);
  assert.ok(studio.draws > previous, 'Restored scenes should redraw');
  doc.body.classList.remove('motion-paused'); doc.dispatchEvent(new Event('jialan:motion')); flush(24000);
  observers.forEach(io => io.emit(false));
  assert.equal(frames.size, 0, 'Off-screen scenes should not schedule frames');
});
