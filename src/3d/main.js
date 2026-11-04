/* Loads each 3D scene only when its section approaches the viewport.
   Without WebGL (or if a scene fails) the catalogue photographs stay in place. */
import { mountSequence } from './sequence.js';

const heroStage = document.querySelector('.hero-scene');
const heroSequence = heroStage && mountSequence(heroStage);

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

function lazy(selector, load, margin = '240px 0px', context) {
  const el = document.querySelector(selector);
  if (!el) return null;
  let started, mounted = false;
  const start = () => {
    if (started) return started;
    // Never initialise several WebGL renderers in the same frame while scrolling.
    started = queue.then(idle).then(load).then(m => m.mount(el, context)).then(() => { mounted = true; }).catch(error => {
      console.warn('3D:', error);
      el.classList.add('is-3d-failed');
      el.classList.remove('is-3d');
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

function afterLoad(fn) {
  const go = () => requestAnimationFrame(() => {
    if ('requestIdleCallback' in window) requestIdleCallback(fn, { timeout: 1200 });
    else setTimeout(fn, 32);
  });
  if (document.readyState === 'complete') go(); else addEventListener('load', go, { once: true });
}

// Paint the useful page and its animated illustration before even allocating a GPU context.
afterLoad(() => {
  if (!webglAvailable()) return;
  document.documentElement.classList.add('webgl');
  lazy('.hero-scene', () => import('./hero.js'), '0px', heroSequence);
  lazy('#anatomy', () => import('./anatomy.js'));
  const studio = lazy('#studio-view', () => import('./studio.js'), '320px 0px');
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
