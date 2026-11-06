/* Warm the hero and studio independently, with CPU setup on separate frames. Their shader
   compilation can overlap, so entering the studio never waits behind the hero's glass shaders.
   Without WebGL (or if a scene fails) the catalogue photographs stay in place. */
import { mountSequence } from './sequence.js';
import { webglAvailable } from './context.js';

const heroStage = document.querySelector('.hero-scene');
const heroSequence = heroStage && mountSequence(heroStage);
const page = document.documentElement;

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
    // Background scenes yield; critical scenes must not wait for another scene's shaders.
    started = (priority ? Promise.resolve() : queue.then(idle)).then(load).then(m => {
      // A timed-out hero stays in fallback for this visit, without another visual swap.
      if (el === heroStage && page.dataset.heroState === 'fallback') return;
      return m.mount(el, context);
    }).then(() => { mounted = el.classList.contains('is-3d'); }).catch(error => {
      console.warn('3D:', error);
      el.classList.add('is-3d-failed');
      el.classList.remove('is-3d');
      if (el === heroStage) page.dataset.heroState = 'fallback';
    });
    if (!priority) queue = started;
    return started;
  };
  const control = { start, mounted: () => mounted };
  if (priority) return control;
  if (!('IntersectionObserver' in window)) { start(); return control; }
  const io = new IntersectionObserver(entries => {
    if (entries.some(e => e.isIntersecting)) { io.disconnect(); start(); }
  }, { rootMargin: margin });
  io.observe(el);
  return control;
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
  const hero = page.dataset.heroState !== 'fallback'
    ? lazy('.hero-scene', () => import('./hero.js'), '0px', heroSequence, true) : null;
  const studio = lazy('#studio-view', () => import('./studio.js'), '0px', undefined, true);
  // A direct #studio visit gets its own first frame first. Otherwise paint the hero first.
  const [first, second] = location.hash === '#studio' ? [studio, hero] : [hero, studio];
  const firstReady = first?.start();
  const secondReady = new Promise(resolve => requestAnimationFrame(() => resolve(second?.start())));
  const criticalReady = Promise.all([firstReady, secondReady]);
  queue = criticalReady;
  const anatomy = lazy('#anatomy', () => import('./anatomy.js'), '900px 0px');
  criticalReady.then(() => anatomy?.start());
  // Intent also wakes the studio if a visitor navigates during startup.
  const studioIntent = event => {
    if (event.target.closest?.('a[href="#studio"]')) studio?.start();
  };
  document.addEventListener('pointerover', studioIntent, { passive: true });
  document.addEventListener('focusin', studioIntent);
  document.addEventListener('click', event => {
    studioIntent(event);
  }, true);
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
