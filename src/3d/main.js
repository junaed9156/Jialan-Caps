/* Paint the catalogue and inline assembly illustration first. WebGL is an enhancement:
   only a scene approaching the viewport (or explicitly requested) downloads and starts. */
import { mountSequence } from './sequence.js';
import { webglAvailable } from './context.js';

const heroStage = document.querySelector('.hero-scene');
const heroSequence = heroStage && mountSequence(heroStage);
const page = document.documentElement;

function afterPaint(fn) {
  const go = () => requestAnimationFrame(() => requestAnimationFrame(fn));
  if (!document.hidden) { go(); return; }
  document.addEventListener('visibilitychange', function visible() {
    if (document.hidden) return;
    document.removeEventListener('visibilitychange', visible);
    go();
  });
}

function scene(selector, load, context) {
  const el = document.querySelector(selector);
  if (!el) return null;
  let started, mounted = false, observer;
  const start = () => {
    if (started) return started;
    observer?.disconnect();
    el.classList.add('is-3d-loading');
    // Only the hero has an automatic visual upgrade deadline. Photos remain usable
    // throughout other scene downloads, including failed/slow connections.
    let timer;
    if (el === heroStage) {
      page.dataset.heroState = 'loading';
      timer = setTimeout(() => {
        if (page.dataset.heroState === 'loading') page.dataset.heroState = 'fallback';
      }, 8000);
    }
    started = load().then(m => {
      if (el === heroStage && page.dataset.heroState === 'fallback') return;
      return m.mount(el, context);
    }).then(() => { mounted = el.classList.contains('is-3d'); }).catch(error => {
      console.warn('3D:', error);
      el.classList.add('is-3d-failed');
      el.classList.remove('is-3d');
      if (el === heroStage) page.dataset.heroState = 'fallback';
    }).finally(() => {
      clearTimeout(timer);
      el.classList.remove('is-3d-loading');
    });
    return started;
  };
  const observe = (margin = '400px 0px') => {
    if (started) return;
    if (!('IntersectionObserver' in window)) { start(); return; }
    observer = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) start();
    }, { rootMargin: margin });
    observer.observe(el);
  };
  return { start, observe, mounted: () => mounted };
}

afterPaint(() => {
  if (!webglAvailable()) { page.dataset.heroState = 'fallback'; return; }
  page.classList.add('webgl');
  const hero = scene('.hero-scene', () => import('./hero.js'), heroSequence);
  const studio = scene('#studio-view', () => import('./studio.js'));
  const anatomy = scene('#anatomy', () => import('./anatomy.js'));
  // No off-screen warm-up or shared queue: a studio visit cannot wait behind glass
  // shaders in an unrelated scene. Normal visits initialise only the visible hero.
  if (location.hash === '#studio') studio?.start();
  else if (location.hash === '#anatomy') anatomy?.start();
  else if (!location.hash || location.hash === '#main') hero?.start();
  hero?.observe('0px');
  studio?.observe('500px 0px');
  anatomy?.observe('150px 0px');

  const studioIntent = event => {
    if (event.target.closest?.('a[href="#studio"], #studio')) studio?.start();
  };
  document.addEventListener('pointerover', studioIntent, { passive: true });
  document.addEventListener('focusin', studioIntent);
  document.addEventListener('click', studioIntent, true);
  window.addEventListener('hashchange', () => {
    if (location.hash === '#studio') studio?.start();
    if (location.hash === '#anatomy') anatomy?.start();
  });
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
