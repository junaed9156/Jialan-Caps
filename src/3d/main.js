/* Loads each 3D scene only when its section approaches the viewport.
   Without WebGL (or if a scene fails) the catalogue photographs stay in place. */
import { mountSequence } from './sequence.js';

const heroStage = document.querySelector('.hero-scene');
const heroSequence = heroStage && mountSequence(heroStage);

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}

function lazy(selector, load, margin = '400px 0px', context) {
  const el = document.querySelector(selector);
  if (!el) return;
  const start = () => load().then(m => m.mount(el, context)).catch(error => {
    console.warn('Jialan 3D:', error);
    el.classList.add('is-3d-failed');
    el.classList.remove('is-3d');
  });
  if (!('IntersectionObserver' in window)) { start(); return; }
  const io = new IntersectionObserver(entries => {
    if (entries.some(e => e.isIntersecting)) { io.disconnect(); start(); }
  }, { rootMargin: margin });
  io.observe(el);
}

if (webglAvailable()) {
  document.documentElement.classList.add('webgl');
  lazy('.hero-scene', () => import('./hero.js'), '0px', heroSequence);
  lazy('#anatomy', () => import('./anatomy.js'), '800px 0px');
  lazy('#studio-view', () => import('./studio.js'), '600px 0px');
}
