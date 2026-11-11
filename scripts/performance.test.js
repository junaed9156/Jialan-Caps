// Regression checks for language routing, render scheduling and scene lifecycle.
// Uses real three.js geometry with a renderer double; browser/GPU visual QA is separate.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
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
const idleTasks = [];
const win = new EventTarget();
Object.assign(win, { devicePixelRatio: 2, IntersectionObserver: Observer, requestIdleCallback: true });
Object.assign(globalThis, {
  window: win, document: doc, screen: { width: 1440, height: 900 }, matchMedia: match,
  Image: Element,
  IntersectionObserver: Observer, ResizeObserver: Resize, innerHeight: 600,
  requestAnimationFrame: fn => { const id = nextFrame++; frames.set(id, fn); return id; },
  requestIdleCallback: fn => idleTasks.push(fn),
  cancelAnimationFrame: id => frames.delete(id), addEventListener: (...args) => win.addEventListener(...args),
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { deviceMemory: 8, hardwareConcurrency: 8 } });
const kit = await import('../src/3d/kit.js');

test('the WebGL support check reuses its context for exactly the first scene', async () => {
  const context = await import('../src/3d/context.js');
  const original = doc.createElement;
  const created = [], requests = [];
  doc.createElement = () => {
    const canvas = new Element();
    canvas.getContext = (type, options) => { requests.push({ type, options }); return {}; };
    created.push(canvas);
    return canvas;
  };
  try {
    assert.equal(context.webglAvailable(), true);
    assert.equal(context.webglAvailable(), true);
    assert.equal(requests.length, 1, 'Repeated capability checks must not allocate more contexts');
    assert.equal(context.createCanvas(), created[0], 'The first scene must keep the already initialised GPU context');
    assert.notEqual(context.createCanvas(), created[0], 'Other scenes need their own canvases');
    assert.equal(requests[0].type, 'webgl2');
    assert.equal(requests[0].options.alpha, false);
    assert.equal(requests[0].options.antialias, true);
    doc.createElement = () => ({ getContext: () => null });
    assert.equal(context.webglAvailable(), false);
    doc.createElement = () => ({ getContext() { throw new Error('GPU unavailable'); } });
    assert.equal(context.webglAvailable(), false);
  } finally { doc.createElement = original; }
});

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

test('the first paint includes the complete design without waiting for scripts or CSS', () => {
  const html = new Element(), timers = [];
  runInNewContext(readFileSync(new URL('../dist/lang-boot.js', import.meta.url), 'utf8'), {
    document: { documentElement: html }, location: { search: '' }, URLSearchParams,
    setTimeout: (callback, delay) => timers.push({ callback, delay }),
  });
  assert.notEqual(html.dataset.heroState, 'loading', 'The static illustration must never wait for WebGL');
  assert.equal(timers.length, 0, 'No arbitrary first-paint delay on the English page');
  const index = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
  assert.match(index, /<style id="site-styles">/);
  assert.doesNotMatch(index, /<link rel="stylesheet"/);
  assert.match(index, /data-hero-state="preview"/);
  const scripts = [...index.matchAll(/<script\b([^>]*\bsrc="[^"]+"[^>]*)>/g)];
  assert.ok(scripts.every(([, attrs]) => /\bdefer\b|type="module"/.test(attrs)), 'No parser-blocking scripts');
  for (const [, path] of index.matchAll(/<link rel="modulepreload" href="([^"]+)"/g)) {
    assert.ok(statSync(new URL('../dist/' + path, import.meta.url)).size < 2000, 'Do not eagerly download the 3D engine');
  }
  assert.ok(gzipSync(index).length < 28000, 'The complete first-paint document stays below 28 KB compressed');
  const application = readFileSync(new URL('../dist/site.js', import.meta.url));
  assert.ok(gzipSync(application).length < 12000, 'The English application must not include the Chinese dictionary');
});

function startup({ hash = '', webgl = true, loadScene } = {}) {
  const source = readFileSync(new URL('../src/3d/main.js', import.meta.url), 'utf8')
    .replace("import { mountSequence } from './sequence.js';", '')
    .replace("import { webglAvailable } from './context.js';", '')
    .replaceAll(/import\('\.\/(hero|anatomy|studio)\.js'\)/g, (_, scene) => `loadScene('${scene}')`);
  const document = new Element();
  document.documentElement = new Element(); document.documentElement.dataset.heroState = 'loading';
  document.readyState = 'interactive'; document.hidden = false;
  const raf = [], idle = [], downloads = [], mounts = [], warnings = [];
  document.createElement = () => ({ getContext: () => webgl ? { getExtension: () => null } : null });
  const moduleFor = scene => ({ mount: async element => {
    mounts.push(scene);
    await loadScene?.(scene);
    element.classList.add('is-3d');
  } });
  runInNewContext(source, {
    document, webglAvailable: () => webgl, location: { hash }, window: { IntersectionObserver: Observer, addEventListener() {} },
    IntersectionObserver: Observer, requestIdleCallback: fn => idle.push(fn),
    requestAnimationFrame: fn => raf.push(fn), setTimeout, clearTimeout, mountSequence: () => ({}),
    console: { warn: error => warnings.push(error) },
    loadScene: async scene => { downloads.push(scene); return moduleFor(scene); },
  });
  return { document, raf, idle, downloads, mounts, warnings,
    enter(selector) { Observer.all.findLast(io => io.target === document.querySelector(selector))?.emit(true); },
    frame() { raf.shift()?.(); }, settle: () => new Promise(resolve => setImmediate(resolve)) };
}

test('off-screen scenes stay unloaded; entering the studio bypasses pending hero shaders', async () => {
  let finishHero;
  const app = startup({ loadScene: scene => scene === 'hero' ? new Promise(resolve => { finishHero = resolve; }) : undefined });
  assert.deepEqual(app.downloads, []);
  app.frame(); app.frame(); await app.settle();
  assert.deepEqual(app.downloads, ['hero']);
  assert.deepEqual(app.mounts, ['hero'], 'Only the visible hero starts on a normal visit');
  app.enter('#studio-view'); await app.settle();
  assert.deepEqual(app.downloads, ['hero', 'studio']);
  assert.ok(app.document.querySelector('#studio-view').classList.contains('is-3d'));
  assert.equal(app.document.querySelector('.hero-scene').classList.contains('is-3d'), false);
  assert.equal(app.document.readyState, 'interactive');
  finishHero(); await app.settle();
  assert.deepEqual(app.downloads, ['hero', 'studio'], 'Finishing the hero must not wake off-screen anatomy');
  app.enter('#anatomy'); await app.settle();
  assert.deepEqual(app.downloads, ['hero', 'studio', 'anatomy']);
});

test('a direct studio visit is prioritised and a failed hero cannot block it', async () => {
  const direct = startup({ hash: '#studio' });
  direct.frame(); direct.frame(); await direct.settle();
  assert.deepEqual(direct.downloads, ['studio']);
  assert.ok(direct.document.querySelector('#studio-view').classList.contains('is-3d'));
  direct.enter('.hero-scene'); await direct.settle();
  assert.deepEqual(direct.downloads, ['studio', 'hero']);
  const failed = startup({ loadScene: scene => { if (scene === 'hero') throw new Error('GPU failure'); } });
  failed.frame(); failed.frame(); await failed.settle();
  assert.equal(failed.document.documentElement.dataset.heroState, 'fallback');
  failed.enter('#studio-view'); await failed.settle();
  assert.ok(failed.document.querySelector('#studio-view').classList.contains('is-3d'));
  assert.equal(failed.warnings.length, 1);
  const unsupported = startup({ webgl: false });
  unsupported.frame(); unsupported.frame(); await unsupported.settle();
  assert.deepEqual(unsupported.downloads, []);
  assert.equal(unsupported.document.documentElement.dataset.heroState, 'fallback');
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
  stage.classList.add('is-3d');   // the clock only runs once the live scene is drawing
  const sequence = mountSequence(stage);
  let time = 0; sequence.subscribe((pose, ambient) => { time = ambient; });
  Observer.all.at(-1).emit(true); flush(1000); flush(1016); flush(5016);
  assert.ok(time > 0 && time < 0.08, `A stalled frame jumped to ${time}s`);
  Observer.all.at(-1).emit(false); assert.equal(frames.size, 0);
  Observer.all.at(-1).emit(true); flush(12000); assert.ok(time < 0.08);
  Observer.all.at(-1).emit(false);
});

test('the hero waits on its first pose (the poster frame) until the 3D scene draws', async () => {
  const { mountSequence } = await import('../src/3d/sequence.js');
  const stage = new Element();
  const sequence = mountSequence(stage);
  let time = -1; sequence.subscribe((pose, ambient) => { time = ambient; });
  Observer.all.at(-1).emit(true); flush(1000); flush(1016); flush(1032);
  assert.equal(time, 0, 'The clock must not advance behind the poster');
  assert.equal(frames.size, 0, 'No animation loop while waiting for the scene');
  stage.classList.add('is-3d'); sequence.subscribe(() => {}); flush(1048); flush(1064);
  assert.ok(time > 0, 'The clock starts once the scene draws');
  Observer.all.at(-1).emit(false);
});

test('all scenes mount, draw finite cameras, pause, and recover after GPU context restoration', async () => {
  const renderers = [];
  class Renderer {
    constructor({ canvas }) { this.canvas = canvas; this.ratio = 1; this.draws = 0; this.compiles = []; renderers.push(this); }
    getPixelRatio() { return this.ratio; }
    setPixelRatio(value) { this.ratio = value; }
    setSize() {}
    async compileAsync(scene, camera, targetScene) {
      let glass = 0;
      scene.traverse(object => { if (object.material?.transmission > 0) glass++; });
      this.compiles.push({ glass, targetScene, draws: this.draws });
    }
    render(scene, camera) { assert.ok(camera.projectionMatrix.elements.every(Number.isFinite)); this.draws++; }
  }
  kit.THREE.WebGLRenderer = Renderer;
  kit.THREE.PMREMGenerator = class { fromScene() { return { texture: new Texture() }; } dispose() {} };
  const { mountSequence } = await import('../src/3d/sequence.js');
  const stage = new Element();
  const start = Observer.all.length;
  doc.documentElement.dataset.heroState = 'loading';
  await (await import('../src/3d/hero.js')).mount(stage, mountSequence(stage));
  assert.equal(doc.documentElement.dataset.heroState, 'ready', 'Only a rendered frame can reveal the hero');
  await (await import('../src/3d/anatomy.js')).mount(new Element());
  const studioView = new Element();
  await (await import('../src/3d/studio.js')).mount(studioView);
  const studio = renderers[2];
  assert.ok(studioView.classList.contains('is-3d'), 'The first studio frame must be ready before scrolling');
  assert.equal(studio.draws, 1);
  assert.equal(studio.compiles[0].glass, 0, 'Invisible bottle shaders must not delay the first cap frame');
  idleTasks.pop()(); await new Promise(resolve => setImmediate(resolve));
  assert.ok(studio.compiles[1].glass > 0, 'Bottle shaders still warm for later interactions');
  assert.ok(studio.compiles[1].draws > 0, 'Optional shaders may warm only after the cap is showing');
  const observers = Observer.all.slice(start);
  observers.forEach(io => io.emit(true));
  for (let i = 0; i < 8; i++) flush(20000 + i * 16);
  assert.equal(renderers.length, 3);
  assert.ok(renderers.every(r => r.draws > 0));
  doc.body.classList.add('motion-paused'); doc.dispatchEvent(new Event('jialan:motion'));
  flush(21000); flush(21016); assert.equal(frames.size, 0, 'Paused scenes should not keep rendering');
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

test('a late GPU compilation cannot replace an already displayed fallback', async () => {
  let complete, disposed = false, subscribed = false, removed = false;
  const stage = new Element();
  stage.prepend = canvas => { canvas.remove = () => { removed = true; }; };
  kit.THREE.WebGLRenderer = class {
    setPixelRatio() {}
    compileAsync() { return new Promise(resolve => { complete = resolve; }); }
    dispose() { disposed = true; }
  };
  doc.documentElement.dataset.heroState = 'loading';
  const loading = (await import('../src/3d/hero.js')).mount(stage, { subscribe() { subscribed = true; } });
  doc.documentElement.dataset.heroState = 'fallback'; complete(); await loading;
  assert.equal(doc.documentElement.dataset.heroState, 'fallback');
  assert.equal(subscribed, false); assert.equal(disposed, true); assert.equal(removed, true);
});
