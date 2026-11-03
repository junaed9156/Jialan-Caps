/* The 3D studio: choose a cap family, finish, collar and preview your own logo on it. */
import {
  THREE, Q, createRenderer, fit, studioEnvironment, makeAssembly, finishMaterial, FINISHES, CAPS,
  contactShadow, backdrop, textTexture, logoDecal, pulseRing, fieldLines, ease, clamp01, damp, motionAllowed, whenVisible,
} from './kit.js';

const PRODUCT = { wl100: ['wl100', 4], wll100: ['wll100', 5], ky100: ['ky100', 10], jlg29: ['jlg29', 32], jlq36: ['jlq36', 26], jlw37: ['jlw37', 27], jlf33: ['jlf33', 30], jlm31: ['jlm31', 34] };
const METALS = ['glossy-gold', 'matte-gold', 'brushed-gold', 'glossy-silver', 'matte-silver', 'glossy-black', 'matte-black', 'dark-grey', 'glossy-red', 'matte-purple', 'glossy-coffee', 'white-coating', 'blue-coating'];
const WOODS = ['wood-coffee', 'wood-white', 'wood-black'];
const LOGO_STYLES = {
  laser: { label: 'Laser engraved', make: () => new THREE.MeshPhysicalMaterial({ color: 0xd9d8d2, metalness: 1, roughness: 0.48 }) },
  gold: { label: 'Gold foil', make: () => new THREE.MeshPhysicalMaterial({ color: 0xf0c977, metalness: 1, roughness: 0.2 }) },
  white: { label: 'White print', make: () => new THREE.MeshStandardMaterial({ color: 0xf7f5ee, roughness: 0.55 }) },
  black: { label: 'Black print', make: () => new THREE.MeshStandardMaterial({ color: 0x111312, roughness: 0.5 }) },
};

export function mount(view) {
  const $ = id => document.getElementById(id);
  const render = $('studio-render');
  const canvas = document.createElement('canvas');
  canvas.id = 'studio-canvas';
  canvas.setAttribute('role', 'img');
  view.prepend(canvas);

  const renderer = createRenderer(canvas);
  const scene = new THREE.Scene();
  scene.environment = studioEnvironment(renderer, { warmth: 0.55 });
  const camera = new THREE.PerspectiveCamera(26, 1, 0.3, 200);
  const bd = backdrop('#445c6d', '#0b1927', { z: -40, size: 220, center: [0.5, 0.62] });
  scene.add(bd);
  const key = new THREE.DirectionalLight(0xfff3e2, 1.4);
  key.position.set(-6, 10, 8);
  scene.add(key, new THREE.HemisphereLight(0xe0ebf3, 0x101f30, 0.5));

  /* ---------- objects ---------- */
  const state = { cap: 'wl100', finish: 'glossy-gold', collar: 'match', bottle: false, lifted: false, auto: true, logo: '', logoStyle: 'laser' };
  const asm = makeAssembly({ cap: state.cap, finish: state.finish, liquid: '#efcf94' });
  scene.add(asm.root);
  asm.bottle.visible = false;
  const ring = pulseRing(0xf0d08e); asm.stack.add(ring);
  let glow = 0;
  const lines = fieldLines(14, 0xf2d79b); asm.stack.add(lines);

  // Floor: soft shadow plus a faded mirror image of the closure.
  const floorY = () => (state.bottle ? 0 : asm.base);
  const shadow = contactShadow(5.5, 5.5, 0.55, 0x081320);
  scene.add(shadow);
  const mirror = new THREE.Group();
  mirror.scale.y = -1;
  scene.add(mirror);
  const fade = new THREE.Mesh(new THREE.CircleGeometry(40, 64), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { c: { value: new THREE.Color('#1a2e3b') } },
    vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    // Opaque near the closure (fading its mirror image), clear toward the horizon so the floor melts into the backdrop.
    fragmentShader: 'uniform vec3 c; varying vec2 vP; void main(){ float d = length(vP); float a = mix(0.7, 1.0, smoothstep(0.0, 5.0, d)) * (1.0 - smoothstep(14.0, 38.0, d)); gl_FragColor = vec4(c, a);\n#include <colorspace_fragment>\n}',
  }));
  fade.renderOrder = 5;
  fade.rotation.x = -Math.PI / 2;
  scene.add(fade);
  function rebuildMirror() {
    mirror.clear();
    for (const part of [asm.collar, asm.actuator, asm.capMesh, decal]) {
      if (!part || !part.geometry) continue;
      const m = new THREE.Mesh(part.geometry, part.material);
      part.updateWorldMatrix(true, false);
      m.matrixAutoUpdate = false;
      mirror.add(m);
      m.userData.source = part;
    }
  }
  function syncMirror() {
    const y = floorY();
    mirror.position.y = y * 2;
    for (const m of mirror.children) {
      const src = m.userData.source;
      src.updateWorldMatrix(true, false);
      m.matrix.copy(src.matrixWorld);
    }
    mirror.visible = !state.bottle;
  }

  /* ---------- logo decal ---------- */
  let decal = null;
  function buildDecal() {
    if (decal) { asm.capMesh.remove(decal); decal.geometry.dispose(); decal.userData.texture?.dispose(); decal = null; }
    const text = state.logo.trim();
    if (text) {
      decal = logoDecal(asm.capMesh, CAPS[state.cap], text, LOGO_STYLES[state.logoStyle].make());
      if (decal) asm.capMesh.add(decal);
    }
    rebuildMirror();
  }

  /* ---------- UI ---------- */
  const shapeButtons = [...document.querySelectorAll('[data-studio-cap]')];
  const swatchBox = $('studio-finishes');
  function finishesFor(cap) { return CAPS[cap].wood ? WOODS : METALS; }
  function renderSwatches() {
    swatchBox.innerHTML = finishesFor(state.cap).map(k => `<button type="button" data-studio-finish="${k}" aria-pressed="${k === state.finish}" aria-label="${FINISHES[k].label}" title="${FINISHES[k].label}" style="--metal:${FINISHES[k].swatch}"><i></i></button>`).join('');
  }
  function updateText() {
    const def = CAPS[state.cap];
    const [pid, page] = PRODUCT[state.cap];
    shapeButtons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.studioCap === state.cap)));
    swatchBox.querySelectorAll('[data-studio-finish]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.studioFinish === state.finish)));
    document.querySelectorAll('[data-studio-collar]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.studioCollar === state.collar)));
    document.querySelectorAll('[data-logo-style]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.logoStyle === state.logoStyle)));
    $('studio-model').textContent = `${def.model} / ${String(Object.keys(CAPS).indexOf(state.cap) + 1).padStart(2, '0')}`;
    $('studio-caption').textContent = def.name;
    $('studio-finish-name').textContent = FINISHES[state.finish].label;
    $('studio-specs').innerHTML = `View ${def.model} specifications <span aria-hidden="true">↗</span>`;
    $('studio-specs').href = `assets/jialan-catalogue-2026.pdf#page=${page}`;
    $('studio-specs').dataset.product = pid;
    canvas.setAttribute('aria-label', `3D preview: ${def.model} ${def.name.toLowerCase()} in ${FINISHES[state.finish].label.toLowerCase()}${state.logo ? `, with “${state.logo}” ${LOGO_STYLES[state.logoStyle].label.toLowerCase()}` : ''}.`);
    $('studio-status').textContent = canvas.getAttribute('aria-label');
  }
  function collarKey() {
    if (state.collar !== 'match') return state.collar;
    return null;
  }
  function setCap(cap) {
    if (!CAPS[cap]) return;
    state.cap = cap;
    asm.setCap(cap);
    if (!finishesFor(cap).includes(state.finish)) state.finish = finishesFor(cap)[0];
    asm.setFinish(state.finish, collarKey());
    renderSwatches();
    buildDecal();
    updateText();
    pop = 1;
    wake();
  }
  function setFinish(k) {
    state.finish = k;
    asm.setFinish(k, collarKey());
    if (state.logoStyle === 'laser' && k === 'glossy-silver') state.logoStyle = 'black';
    buildDecal();
    updateText();
    wake();
  }
  shapeButtons.forEach(b => b.addEventListener('click', () => setCap(b.dataset.studioCap)));
  swatchBox.addEventListener('click', e => { const b = e.target.closest('[data-studio-finish]'); if (b) setFinish(b.dataset.studioFinish); });
  document.querySelectorAll('[data-studio-collar]').forEach(b => b.addEventListener('click', () => { state.collar = b.dataset.studioCollar; asm.setFinish(state.finish, collarKey()); rebuildMirror(); updateText(); wake(); }));
  document.querySelectorAll('[data-logo-style]').forEach(b => b.addEventListener('click', () => { state.logoStyle = b.dataset.logoStyle; buildDecal(); updateText(); wake(); }));
  let logoTimer;
  $('studio-logo').addEventListener('input', e => {
    state.logo = e.target.value.slice(0, 16);
    clearTimeout(logoTimer);
    logoTimer = setTimeout(() => { buildDecal(); updateText(); wake(); }, 120);
  });
  $('studio-explode').addEventListener('click', () => {
    state.lifted = !state.lifted;
    $('studio-explode').setAttribute('aria-pressed', String(state.lifted));
    $('studio-explode-label').textContent = state.lifted ? 'Close the cap' : 'Lift the cap';
    liftStart = clock; wake();
  });
  $('studio-bottle').addEventListener('click', () => {
    state.bottle = !state.bottle;
    $('studio-bottle').setAttribute('aria-pressed', String(state.bottle));
    $('studio-bottle-label').textContent = state.bottle ? 'Hide bottle' : 'Show on bottle';
    asm.bottle.visible = state.bottle;
    wake();
  });
  $('studio-spin').addEventListener('click', () => {
    state.auto = !state.auto;
    if (state.auto && !motionAllowed()) document.getElementById('motion-toggle')?.click();
    updateSpin(); wake();
  });
  $('studio-reset').addEventListener('click', () => {
    view3.yaw = 0.5; view3.pitch = 0.18; view3.vy = 0;
    if (state.lifted) $('studio-explode').click();
    state.auto = motionAllowed(); updateSpin(); wake();
  });
  $('studio-angle').addEventListener('input', e => { state.auto = false; updateSpin(); view3.yaw = Number(e.target.value) * Math.PI / 180; view3.vy = 0; wake(); });
  $('studio-enquire').addEventListener('click', () => {
    const def = CAPS[state.cap];
    const collar = state.collar === 'match' ? 'matching collar' : `${FINISHES[state.collar].label.toLowerCase()} collar`;
    const logo = state.logo.trim() ? `, logo “${state.logo.trim()}” (${LOGO_STYLES[state.logoStyle].label.toLowerCase()})` : '';
    const text = `3D studio design: ${def.model} ${def.name.toLowerCase()}, ${FINISHES[state.finish].label.toLowerCase()} cap, ${collar}${logo}.`;
    const field = document.querySelector('#enquiry-form textarea[name="message"]');
    if (field) { field.value = field.value.trim() ? `${field.value.trim()}\n${text}` : text; field.dispatchEvent(new Event('input')); }
    document.getElementById('contact')?.scrollIntoView({ behavior: motionAllowed() ? 'smooth' : 'auto' });
    setTimeout(() => field?.focus({ preventScroll: true }), 700);
  });
  function updateSpin() {
    const rotating = state.auto && motionAllowed();
    $('studio-spin').setAttribute('aria-pressed', String(rotating));
    $('studio-spin-label').textContent = rotating ? 'Pause rotation' : 'Play rotation';
    $('studio-spin-icon').textContent = rotating ? 'Ⅱ' : '▷';
  }
  document.addEventListener('jialan:studio', e => {
    const { cap, finish } = e.detail || {};
    if (cap && CAPS[cap]) setCap(cap);
    if (finish && finishesFor(state.cap).includes(finish)) setFinish(finish);
  });
  document.addEventListener('jialan:motion', () => { updateSpin(); wake(); });

  /* ---------- drag to turn ---------- */
  const view3 = { yaw: 0.5, pitch: 0.18, vy: 0, dist: 14, ty: 1.5 };
  let drag = null;
  canvas.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    drag = { x: e.clientX, y: e.clientY, yaw: view3.yaw, pitch: view3.pitch, id: e.pointerId, t: performance.now(), active: e.pointerType === 'mouse' };
    if (drag.active) { canvas.setPointerCapture(e.pointerId); state.auto = false; updateSpin(); }
  });
  canvas.addEventListener('pointermove', e => {
    if (!drag || drag.id !== e.pointerId) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.active && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.2) { drag.active = true; canvas.setPointerCapture(e.pointerId); state.auto = false; updateSpin(); }
    if (!drag.active) return;
    const now = performance.now();
    const yaw = drag.yaw + dx * 0.011;
    view3.vy = (yaw - view3.yaw) / Math.max(0.008, (now - drag.t) / 1000);
    drag.t = now;
    view3.yaw = yaw;
    view3.pitch = Math.max(-0.25, Math.min(0.75, drag.pitch + dy * 0.005));
    wake();
  });
  const release = () => { if (drag?.active) wake(); drag = null; };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);

  /* ---------- render loop ---------- */
  let raf = 0, last = 0, clock = 0, liftStart = -10, lift = 0, pop = 0, framed = false;
  const visibleNow = whenVisible(view, v => v && wake());
  function wake() { if (!raf) raf = requestAnimationFrame(tick); }
  const target = new THREE.Vector3();

  function tick(now) {
    raf = 0;
    if (!visibleNow()) return;
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
    last = now;
    clock += dt;
    fit(renderer, camera, view);
    // The canvas fills the whole panel; centre the product on the render box between the captions.
    const pr = view.getBoundingClientRect(), rr = render.getBoundingClientRect();
    const shift = (pr.top + pr.height / 2) - (rr.top + rr.height / 2);
    camera.setViewOffset(pr.width, pr.height, 0, shift, pr.width, pr.height);
    const moving = motionAllowed();

    // Spin with inertia after a drag, or the slow showroom turn.
    if (!drag?.active) {
      if (Math.abs(view3.vy) > 0.01) { view3.yaw += view3.vy * dt; view3.vy *= Math.pow(0.04, dt); }
      else if (state.auto && moving) view3.yaw += dt * 0.25;
    }
    asm.root.rotation.y = view3.yaw;
    asm.root.rotation.x = 0;
    const angle = Math.round(((view3.yaw * 180 / Math.PI) % 360 + 360) % 360);
    $('studio-angle').value = angle; $('studio-angle-value').value = `${angle}°`;

    // Lift and magnetic snap.
    const since = clock - liftStart;
    if (state.lifted) lift = moving ? ease.inOutCubic(clamp01(since / 0.9)) : 1;
    else lift = moving ? 1 - ease.snap(clamp01(since / 0.55)) : 0;
    asm.setLift(lift * 0.95);
    lines.position.y = asm.base + 0.36;
    lines.userData.set(lift * 0.6, 1.4 + lift * 2.3);
    ring.position.y = asm.base + 0.36;
    ring.userData.fire(!state.lifted && moving ? clamp01((since - 0.3) / 0.7) : 0);
    pop = damp(pop, 0, 5, dt);
    asm.capGroup.scale.setScalar(1 + pop * 0.06);

    // Camera frames the closure alone or the whole bottle.
    const top = asm.height() + lift * 2.4;
    const bottom = state.bottle ? 0 : asm.base - 0.1;
    const wantTy = (top + bottom) / 2, wantDist = (top - bottom) * (state.bottle ? 3.0 : 3.5) + 7.5;
    if (!framed) { view3.ty = wantTy; view3.dist = wantDist; framed = true; }
    view3.ty = damp(view3.ty, wantTy, 4, dt);
    view3.dist = damp(view3.dist, wantDist, 4, dt);
    const d = view3.dist * Math.max(1, 0.95 / camera.aspect);
    target.set(0, view3.ty, 0);
    camera.position.set(Math.sin(0.0) * d, view3.ty + Math.sin(view3.pitch) * d, Math.cos(view3.pitch) * d);
    camera.lookAt(target);

    // Warm softbox glow on the backdrop, behind the bottle, so glass and perfume light up.
    glow = damp(glow, state.bottle ? 1.15 : 0, 5, dt);
    const bu = bd.material.uniforms;
    bu.uGlow.value = glow;
    const hitY = view3.ty - 40 * Math.tan(view3.pitch) - 2.5;
    bu.uGlowPos.value.set(0.5, 0.5 + hitY / bd.userData.size);
    const fy = floorY();
    shadow.position.y = fy + 0.01;
    fade.position.y = fy + 0.005;
    shadow.scale.setScalar(state.bottle ? 1.35 : 1);
    shadow.material.opacity = 0.5;
    syncMirror();

    renderer.render(scene, camera);
    if (!view.classList.contains('is-3d')) { view.classList.add('is-3d'); updateText(); }
    const busy = drag?.active || Math.abs(view3.vy) > 0.01 || (state.auto && moving) || since < 1.2 || pop > 0.01 ||
      Math.abs(view3.ty - (top + bottom) / 2) > 0.005;
    if (busy) wake();
  }

  renderSwatches();
  setCap(state.cap);
  updateSpin();
  new ResizeObserver(wake).observe(view);
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); view.classList.remove('is-3d'); });
  wake();
}
