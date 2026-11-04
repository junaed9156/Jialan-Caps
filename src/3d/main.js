/* Loads each 3D scene only when its section approaches the viewport.
   Without WebGL (or if a scene fails) the catalogue photographs stay in place. */
import { mountSequence } from './sequence.js';

const heroStage = document.querySelector('.hero-scene');
const heroSequence = heroStage && mountSequence(heroStage);
const page = document.documentElement;

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    // This version of three.js needs WebGL2. Release the probe's GPU context immediately.
    const gl = c.getContext('webgl2');
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch { return false; }
}

let queue = Promise.resolve();
function idle() {
  return new Promise(resolve => {
    const start = () => 'requestIdleCallback' in window
      ? requestIdleCallback(resolve, { timeout: 1000 }) : setTimeout(resolve, 32);
    if (!document.hidden) { start(); return; }
    document.addEventListener('visibilitychange', function visible() {
      if (document.hidden) return;
      document.removeEventListener('visibilitychange', visible);
      start();
    });
  });
}

function lazy(selector, load, margin = '240px 0px', context, priority = false) {
  const el = document.querySelector(selector);
  if (!el) return null;
  let started, mounted = false;
  const start = () => {
    if (started) return started;
    // Never initialise several WebGL renderers in the same frame while scrolling.
    started = (priority ? Promise.resolve() : queue.then(idle)).then(load).then(m => {
      // A timed-out hero stays in fallback for this visit, without another visual swap.
      if (el === heroStage && page.dataset.heroState === 'fallback') return;
      return m.mount(el, context);
    }).then(() => { mounted = true; }).catch(error => {
      console.warn('3D:', error);
      el.classList.add('is-3d-failed');
      el.classList.remove('is-3d');
      if (el === heroStage) page.dataset.heroState = 'fallback';
    });
    queue = started;
    return started;
  };
  if (!('IntersectionObserver' in window)) { start(); return { start, mounted: () => mounted }; }
  const io = new IntersectionObserver(entries => {
    if (entries.some(e => e.isIntersecting)) { io.disconnect(); start(); }
  }, { rootMargin: margin });
  io.observe(el);
  return { start, mounted: () => mounted };
}

function afterPaint(fn) {
  const go = () => requestAnimationFrame(() => requestAnimationFrame(fn));
  if (!document.hidden) { go(); return; }
  document.addEventListener('visibilitychange', function visible() {
    if (document.hidden) return;
    document.removeEventListener('visibilitychange', visible);
    go();
  });
}

// Start after the first paint, without waiting for unrelated images or window.load.
afterPaint(() => {
  if (!webglAvailable()) { page.dataset.heroState = 'fallback'; return; }
  document.documentElement.classList.add('webgl');
  if (page.dataset.heroState !== 'fallback') {
    lazy('.hero-scene', () => import('./hero.js'), '0px', heroSequence, true)?.start();
  }
  // Start a screen or two ahead so the 3D is ready by the time the section is reached.
  lazy('#anatomy', () => import('./anatomy.js'), '900px 0px');
  const studio = lazy('#studio-view', () => import('./studio.js'), '1100px 0px');
  let pendingDesign;
  document.addEventListener('jialan:studio', event => {
    if (!studio || studio.mounted()) return;
    pendingDesign = event.detail;
    studio.start().then(() => {
      if (!pendingDesign || !studio.mounted()) return;
      const detail = pendingDesign; pendingDesign = null;
      document.dispatchEvent(new CustomEvent('jialan:studio', { detail }));
    });
  });
});
