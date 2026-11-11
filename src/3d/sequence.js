/* The poster and the WebGL scene follow the same clock, including pause and replay. */
import { plateRenderer } from './plate.js';

const DURATION = 6.4;
const CYCLE = 12.5;
const phaseTimes = [0, 3.65, DURATION];
const clamp = t => Math.max(0, Math.min(1, t));
const smooth = t => { t = clamp(t); return t * t * (3 - 2 * t); };
const span = (t, a, b) => smooth((t - a) / (b - a));

export function assemblyPose(t) {
  if (t > 9.65) {
    // Lift clear of the pump before tilting back to the starting pose.
    const rise = span(t, 9.65, 11.75), drift = span(t, 10.72, CYCLE);
    return { x: -1.38 * drift, lift: 1.30 * rise, tilt: -0.24 * drift, yaw: -0.65 * drift, phase: 0 };
  }
  const turn = span(t, 0.08, 3.55);
  const align = span(t, 1.95, 4.18);
  const lower = span(t, 4.14, 5.7);
  const catchUp = Math.sin(Math.PI * clamp((t - 5.7) / 0.40));
  return {
    x: -1.38 * (1 - align),
    lift: (1.30 - 0.42 * align) * (1 - lower) + 0.042 * catchUp,
    tilt: -0.24 * (1 - align),
    yaw: -(1 - turn) * 2 * Math.PI - (1 - span(t, 2.95, 5.68)) * 0.65,
    phase: t < 2.65 ? 0 : t < 4.25 ? 1 : 2,
  };
}

export function mountSequence(stage) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const drawPlate = plateRenderer(stage);
  const buttons = [...stage.querySelectorAll('[data-phase]')];
  const replay = stage.querySelector('[data-replay]');
  const subscribers = new Set();
  let t = reduced.matches ? DURATION : 0;
  let ambient = 0, last = null, frame = 0, observed = false;

  function draw() {
    const pose = assemblyPose(t);
    if (!stage.classList.contains('is-3d')) drawPlate(pose, ambient);
    if (stage.dataset.phase !== String(pose.phase)) {
      stage.dataset.phase = String(pose.phase);
      buttons.forEach((button, i) => button.setAttribute('aria-pressed', String(i === pose.phase)));
    }
    for (const update of subscribers) update(pose, ambient);
  }

  const playing = () => !reduced.matches && !document.body.classList.contains('motion-paused');
  function tick(now) {
    frame = 0;
    if (!observed || document.hidden || document.body.classList.contains('modal-open')) { last = null; return; }
    // The clock waits at its first pose until the 3D scene draws: the hero poster is that exact
    // frame, so the photo and the live scene meet seamlessly (no drawn preview plays first).
    if (playing() && stage.classList.contains('is-3d')) {
      // A slow frame or restored tab must not jump over the cap's assembly sequence.
      const dt = last === null ? 0 : Math.min(0.05, Math.max(0, (now - last) / 1000));
      ambient += dt;
      t = (t + dt) % CYCLE;
    }
    last = now;
    draw();
    if (playing() && stage.classList.contains('is-3d')) frame = requestAnimationFrame(tick);
  }

  function wake() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0; last = null;
    if (observed && !document.hidden) frame = requestAnimationFrame(tick);
  }

  function select(time) { t = time; draw(); wake(); }
  buttons.forEach((button, i) => button.addEventListener('click', () => select(phaseTimes[i])));
  replay?.addEventListener('click', () => {
    if (!playing() && !reduced.matches) document.getElementById('motion-toggle')?.click();
    select(0);
  });
  function preference() {
    if (replay) replay.hidden = reduced.matches;
    if (reduced.matches) t = DURATION;
    draw(); wake();
  }
  document.addEventListener('jialan:motion', wake);
  document.addEventListener('visibilitychange', wake);
  document.addEventListener('jialan:overlay', wake);
  reduced.addEventListener('change', preference);
  new ResizeObserver(wake).observe(stage);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => { observed = entry.isIntersecting; wake(); }).observe(stage);
  } else { observed = true; }
  preference();
  return {
    subscribe(update) { subscribers.add(update); update(assemblyPose(t), ambient); wake(); },
    unsubscribe(update) { subscribers.delete(update); draw(); },
  };
}
