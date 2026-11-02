/* Hero: a glass bottle receives its magnetic cap. Silk, a second bottle and floating pieces
   give the composition depth without competing with the product. */
import {
  THREE, Q, createRenderer, fit, studioEnvironment, makeAssembly, finishMaterial, CAPS, collarGeometry,
  contactShadow, caustic, backdrop, textTexture, pulseRing, fieldLines, silkRibbon, softDot,
  ease, clamp01, damp, motionAllowed, whenVisible,
} from './kit.js';

export function mount(sceneEl) {
  const canvas = document.createElement('canvas');
  canvas.className = 'hero-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  sceneEl.prepend(canvas);

  const renderer = createRenderer(canvas);
  const scene = new THREE.Scene();
  scene.environment = studioEnvironment(renderer, { warmth: 0.65, light: true });
  const camera = new THREE.PerspectiveCamera(30, 1, 0.5, 200);

  scene.add(backdrop('#f6f3ea', '#d3dccf', { z: -26, size: 160, center: [0.46, 0.6] }));
  const hemi = new THREE.HemisphereLight(0xffffff, 0xd4d5cb, 1.1);
  const key = new THREE.DirectionalLight(0xfff6e8, 2.0);
  key.position.set(-8, 14, 12);
  const rim = new THREE.DirectionalLight(0xe8f1ff, 1.0);
  rim.position.set(10, 6, -8);
  scene.add(hemi, key, rim);

  // Warm light behind the hero bottle.
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(22, 22),
    new THREE.MeshBasicMaterial({ map: softDot(), color: 0xffe0a6, transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false }));
  halo.position.set(-0.6, 6.2, -12);
  scene.add(halo);

  // The brand word sits behind the objects, so the glass bends it.
  const word = new THREE.Mesh(new THREE.PlaneGeometry(30, 7.5),
    new THREE.MeshBasicMaterial({ map: textTexture('JIALAN', { spacing: 0.16 }), transparent: true, opacity: 0.6, depthWrite: false, toneMapped: false }));
  word.position.set(-0.6, 10.6, -10);
  scene.add(word);

  // Champagne and sage silk flowing behind everything (opaque, so the glass refracts it).
  const silk = silkRibbon({ color: '#eadcc0', sheen: '#fff1d6' });
  silk.position.set(0, 3.2, -7.5);
  silk.rotation.set(0.12, 0, -0.32);
  const silk2 = silkRibbon({ color: '#c9d6c4', sheen: '#eef6e8', width: 3.2, segments: [200, 10] });
  silk2.position.set(2, 0.2, -9.5);
  silk2.rotation.set(0.1, 0, -0.18);
  scene.add(silk, silk2);

  const stone = new THREE.MeshStandardMaterial({ color: 0xdfe2d8, roughness: 0.9, envMapIntensity: 0.25 });
  const sage = new THREE.MeshStandardMaterial({ color: 0xc3cfbf, roughness: 0.85, envMapIntensity: 0.3 });
  const forest = new THREE.MeshPhysicalMaterial({ color: 0x1d453e, roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.25, envMapIntensity: 0.45 });
  const goldTrim = finishMaterial('glossy-gold');
  const plinth = (r, h, x, top, z, mat, trim = false) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 120), mat);
    m.position.set(x, top - h / 2, z);
    scene.add(m);
    if (trim) {
      const t = new THREE.Mesh(new THREE.TorusGeometry(r + 0.01, 0.045, 10, 160), goldTrim);
      t.rotation.x = Math.PI / 2;
      t.position.set(x, top - 0.03, z);
      scene.add(t);
    }
    return m;
  };
  plinth(3.5, 9, -1.2, 0, 0, stone, true);
  plinth(2.5, 9, -6.6, -1.6, -4.4, sage);
  plinth(3.0, 9, 6.4, -2.8, 2.6, forest, true);
  plinth(2.4, 9, -8.4, -5.4, 4.6, stone);

  // Thin orbit lines echo the page's graphic language.
  const orbitMat = new THREE.MeshBasicMaterial({ color: 0x9aa98f, transparent: true, opacity: 0.5, toneMapped: false });
  const orbits = [8.6, 11.6].map((r, i) => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(r, 0.016, 8, 240), orbitMat);
    m.position.set(-0.8, 4.4, -2);
    m.rotation.set(Math.PI / 2 - 0.28 - i * 0.1, 0.18 + i * 0.12, 0);
    scene.add(m);
    return m;
  });

  // The hero bottle.
  const hero = makeAssembly({ cap: 'wl100', finish: 'glossy-gold', liquid: '#efcf94' });
  hero.root.position.set(-1.2, 0, 0);
  hero.root.rotation.y = -0.42;
  scene.add(hero.root);
  const heroShadow = contactShadow(6.4, 4.0, 0.2);
  heroShadow.position.set(-1.2, 0.012, 0.1);
  const glow = caustic(3.4, 2.4, 0.5);
  glow.position.set(-0.4, 0.02, 1.0);
  scene.add(heroShadow, glow);
  const ring = pulseRing(0xe2c27c);
  ring.position.y = hero.base + 0.36;
  hero.stack.add(ring);
  const lines = fieldLines(12, 0xf0d496);
  lines.position.y = hero.base + 0.36;
  hero.stack.add(lines);

  // A second, rounder bottle behind it: rose perfume under a glossy black cap.
  const second = makeAssembly({ cap: 'wl100', finish: 'glossy-black', liquid: '#e9a3a8', bottleShape: 'round', bottleSize: { width: 3.6, height: 5.4 } });
  second.root.position.set(-6.6, -1.6, -4.4);
  second.root.scale.setScalar(0.92);
  scene.add(second.root);
  const secondShadow = contactShadow(4.6, 3.4, 0.18);
  secondShadow.position.set(-6.6, -1.59, -4.3);
  scene.add(secondShadow);

  // Light motes drifting upward, like dust in a sunbeam.
  const moteCount = Q.low ? 60 : 130;
  const motePos = new Float32Array(moteCount * 3), moteSeed = new Float32Array(moteCount);
  for (let i = 0; i < moteCount; i++) {
    motePos[i * 3] = (Math.random() - 0.5) * 26;
    motePos[i * 3 + 1] = Math.random() * 18 - 5;
    motePos[i * 3 + 2] = (Math.random() - 0.5) * 12 - 1;
    moteSeed[i] = Math.random();
  }
  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
  const motes = new THREE.Points(moteGeo, new THREE.PointsMaterial({ map: softDot(), color: 0xfff0cf, size: 0.22, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  scene.add(motes);

  // Floating pieces.
  const floating = [];
  const addFloat = ({ cap, finish, x, y, z, tilt, collar, phase, shadowY, scale = 1, shadowX = x, shadowZ = z }) => {
    const g = new THREE.Group();
    const def = cap === 'collar' ? { H: 1.485, R: 1.23 } : CAPS[cap];
    const mesh = new THREE.Mesh(cap === 'collar' ? collarGeometry() : def.build(), finishMaterial(finish, { knurled: !!def.knurled, side: THREE.DoubleSide }));
    mesh.position.y = -def.H / 2;
    const pivot = new THREE.Group();
    pivot.add(mesh);
    g.add(pivot);
    g.position.set(x, y, z);
    g.rotation.z = tilt;
    scene.add(g);
    const shadow = contactShadow(def.R * 2.4, def.R * 1.9, 0.18);
    shadow.position.set(shadowX, shadowY + 0.01, shadowZ);
    shadow.visible = shadowY > -30;
    scene.add(shadow);
    const item = { g, pivot, mesh, def, cap, finish, scale, base: new THREE.Vector3(x, y, z), tilt, phase, shadow, shadowY, hover: 0 };
    mesh.userData.item = cap === 'collar' ? null : item;
    floating.push(item);
    return item;
  };
  addFloat({ cap: 'jlq36', finish: 'glossy-gold', x: 6.4, y: 1.2, z: 2.6, tilt: 0.16, phase: 0.6, shadowY: -2.8 });
  addFloat({ cap: 'ky100', finish: 'glossy-black', x: -8.4, y: -2.3, z: 4.6, tilt: -0.26, phase: 2.1, shadowY: -5.4 });
  addFloat({ cap: 'jlm31', finish: 'wood-coffee', x: 9.6, y: 8.4, z: -4, tilt: 0.34, phase: 4.2, shadowY: -99 });
  addFloat({ cap: 'wl100', finish: 'glossy-red', x: -10.6, y: 10.2, z: -6, tilt: -0.42, phase: 1.3, shadowY: -99, scale: 0.85 });
  addFloat({ cap: 'collar', finish: 'glossy-gold', x: 3.9, y: 5.4, z: 3.2, tilt: 0.55, phase: 3.3, shadowY: -99, scale: 0.9 });

  /* ---------- camera framing ---------- */
  const target = new THREE.Vector3(0.2, 3.4, 0);
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  function frame() {
    fit(renderer, camera, sceneEl);
    const vFov = THREE.MathUtils.degToRad(camera.fov);
    const needH = 21, needW = 25;
    const dist = Math.max(needH / (2 * Math.tan(vFov / 2)), needW / (2 * Math.tan(vFov / 2) * camera.aspect));
    camera.userData.dist = dist;
  }

  /* ---------- interaction ---------- */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let hovered = null;
  const canHover = matchMedia('(hover: hover)').matches;
  sceneEl.addEventListener('pointermove', e => {
    const r = sceneEl.getBoundingClientRect();
    pointer.tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
    pointer.ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
    if (!canHover) return;
    ndc.set(pointer.tx, -pointer.ty);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(floating.map(f => f.mesh), false)[0];
    hovered = hit ? hit.object.userData.item : null;
    canvas.style.cursor = hovered ? 'pointer' : '';
    wake();
  }, { passive: true });
  sceneEl.addEventListener('pointerleave', () => { pointer.tx = pointer.ty = 0; hovered = null; canvas.style.cursor = ''; wake(); });
  canvas.addEventListener('click', e => {
    const r = sceneEl.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width - 0.5) * 2, -((e.clientY - r.top) / r.height - 0.5) * 2);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects([...floating.map(f => f.mesh), hero.capMesh], false)[0];
    if (!hit) return;
    const item = hit.object.userData.item;
    document.dispatchEvent(new CustomEvent('jialan:studio', { detail: item ? { cap: item.cap, finish: item.finish } : { cap: 'wl100', finish: 'glossy-gold' } }));
    document.getElementById('studio')?.scrollIntoView({ behavior: motionAllowed() ? 'smooth' : 'auto' });
  });

  /* ---------- animation ---------- */
  let start = null, last = 0, raf = 0;
  const clock = { t: 0 };
  const visibleNow = whenVisible(sceneEl, v => v && wake());
  function wake() { if (!raf) raf = requestAnimationFrame(tick); }

  function liftCycle(t) {
    // 0..1.3s: intro drop. Then every 7 s the cap lifts a little and snaps back.
    if (t < 1.35) {
      const p = clamp01((t - 0.25) / 1.1);
      return { lift: 1.7 * (1 - ease.snap(p)), pulse: clamp01((t - 1.05) / 0.9), lines: p > 0.55 ? (1 - p) * 2 : 0 };
    }
    const c = (t - 1.35) % 7;
    if (c < 4.6) return { lift: 0, pulse: clamp01((t - 1.05) / 0.9), lines: 0 };
    if (c < 5.6) { const p = ease.inOutCubic((c - 4.6) / 1.0); return { lift: 0.42 * p, pulse: 0, lines: p * 0.9 }; }
    if (c < 6.3) return { lift: 0.42, pulse: 0, lines: 0.9 };
    const p = ease.snap(clamp01((c - 6.3) / 0.6));
    return { lift: 0.42 * (1 - p), pulse: clamp01((c - 6.45) / 0.55), lines: 0.9 * (1 - p) };
  }

  function tick(now) {
    raf = 0;
    if (!visibleNow()) return;
    if (start === null) { start = now; last = now; }
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const moving = motionAllowed();
    if (moving) clock.t += dt; else if (clock.t < 2.5) clock.t = 2.5; // reduced motion: show the settled scene
    const t = clock.t;
    frame();

    pointer.x = damp(pointer.x, pointer.tx, 3, dt);
    pointer.y = damp(pointer.y, pointer.ty, 3, dt);
    const d = camera.userData.dist;
    camera.position.set(target.x + pointer.x * 1.6, target.y + 1.6 - pointer.y * 0.9, d);
    camera.lookAt(target);

    const cyc = liftCycle(t);
    hero.setLift(cyc.lift);
    ring.userData.fire(cyc.pulse);
    lines.userData.set(cyc.lines * 0.55, 2.0 + cyc.lift);
    hero.root.rotation.y = -0.42 + Math.sin(t * 0.22) * 0.32;

    const intro = ease.outCubic(clamp01(t / 1.4));
    for (const f of floating) {
      f.hover = damp(f.hover, hovered === f ? 1 : 0, 6, dt);
      const bob = Math.sin(t * 0.85 + f.phase) * 0.32;
      f.g.position.set(f.base.x, f.base.y + bob - (1 - intro) * 2.5, f.base.z);
      f.g.rotation.z = f.tilt + Math.sin(t * 0.6 + f.phase) * 0.05;
      f.pivot.rotation.y += dt * (0.32 + f.hover * 1.8);
      const s = f.scale * (0.86 + 0.14 * intro) * (1 + f.hover * 0.07);
      f.g.scale.setScalar(s);
      const height = f.g.position.y - f.def.H / 2 - f.shadowY;
      f.shadow.material.opacity = 0.2 * intro / (1 + height * 0.45);
      f.shadow.scale.setScalar(1 + height * 0.08);
    }
    orbits.forEach((o, i) => { o.rotation.z = t * (i ? -0.035 : 0.05); });
    if (moving || t < 0.1) {
      silk.userData.update(t);
      silk2.userData.update(t * 0.8 + 3);
      const p = moteGeo.attributes.position.array;
      for (let i = 0; i < moteCount; i++) {
        p[i * 3 + 1] += dt * (0.25 + moteSeed[i] * 0.45);
        p[i * 3] += Math.sin(t * 0.5 + moteSeed[i] * 9) * dt * 0.12;
        if (p[i * 3 + 1] > 13) p[i * 3 + 1] = -5;
      }
      moteGeo.attributes.position.needsUpdate = true;
      motes.material.opacity = 0.55 + Math.sin(t * 1.3) * 0.15;
    }
    second.root.rotation.y = 0.5 + Math.sin(t * 0.18 + 1) * 0.25;

    renderer.render(scene, camera);
    if (!sceneEl.classList.contains('is-3d')) sceneEl.classList.add('is-3d');
    const settling = Math.abs(pointer.x - pointer.tx) > 0.002 || Math.abs(pointer.y - pointer.ty) > 0.002 || floating.some(f => Math.abs(f.hover - (hovered === f ? 1 : 0)) > 0.01);
    if (moving || settling) wake();
  }

  new ResizeObserver(() => { frame(); wake(); }).observe(sceneEl);
  document.addEventListener('jialan:motion', wake);
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); sceneEl.classList.remove('is-3d'); });
  canvas.addEventListener('webglcontextrestored', () => location.reload());
  frame();
  wake();
  return { renderer, scene, camera };
}
