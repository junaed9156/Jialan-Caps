/* Scroll story: the closure assembles, lifts, separates into its parts, changes finish
   and receives a laser-engraved logo. Scroll position drives every frame. */
import {
  THREE, Q, createRenderer, fit, studioEnvironment, makeAssembly, FINISHES, CAPS, contactShadow, caustic, backdrop,
  logoDecal, pulseRing, fieldLines, softDot, lerpFinish, ease, clamp01, range, damp, motionAllowed, whenVisible,
} from './kit.js';

const FINISH_TOUR = ['glossy-gold', 'glossy-black', 'glossy-silver', 'glossy-red', 'matte-gold'];
// Camera keyframes: [progress, yaw, pitch, distance, target height]
const KEYS = [
  [0.00, -0.75, 0.14, 38, 5.6], [0.14, -0.4, 0.15, 38, 6.4], [0.30, 0.05, 0.12, 42, 7.6],
  [0.44, 0.5, 0.14, 50, 9.4], [0.54, 0.45, 0.14, 50, 9.4], [0.62, 0.25, 0.12, 40, 7.8],
  [0.72, 0.12, 0.1, 36, 8.4], [0.80, 0.0, 0.04, 17, 11.1], [0.92, 0.0, 0.04, 17, 11.1],
  [1.00, -0.3, 0.12, 38, 5.8],
];

function cameraAt(p) {
  let i = 0;
  while (i < KEYS.length - 2 && p > KEYS[i + 1][0]) i++;
  const a = KEYS[i], b = KEYS[i + 1];
  const t = ease.inOutCubic(range(p, a[0], b[0]));
  return a.slice(1).map((v, k) => v + (b[k + 1] - v) * t);
}

export function mount(section) {
  const stage = section.querySelector('.anatomy-stage');
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  stage.prepend(canvas);
  const steps = [...section.querySelectorAll('[data-step]')];
  const labels = Object.fromEntries([...section.querySelectorAll('[data-label]')].map(el => [el.dataset.label, el]));
  const finishName = section.querySelector('.anatomy-finish');
  const progressBar = section.querySelector('.anatomy-progress i');

  const renderer = createRenderer(canvas);
  renderer.localClippingEnabled = true;
  const scene = new THREE.Scene();
  scene.environment = studioEnvironment(renderer, { warmth: 0.6, light: true });
  const camera = new THREE.PerspectiveCamera(30, 1, 0.3, 300);
  scene.add(backdrop('#faf0d9', '#e2c99a', { z: -40, size: 260, center: [0.58, 0.6] }));
  const key = new THREE.DirectionalLight(0xfff5e6, 1.6);
  key.position.set(-8, 14, 10);
  scene.add(key, new THREE.HemisphereLight(0xffffff, 0xcad4da, 1.0));

  const floorMat = new THREE.MeshStandardMaterial({ color: 0xd4c9b8, roughness: 0.9, envMapIntensity: 0.3 });
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(7.5, 7.5, 0.6, 128), floorMat);
  floor.position.y = -0.3;
  scene.add(floor);
  const trim = new THREE.Mesh(new THREE.TorusGeometry(7.5, 0.04, 8, 200), new THREE.MeshPhysicalMaterial({ color: '#e5bd72', metalness: 1, roughness: 0.2 }));
  trim.rotation.x = Math.PI / 2;
  trim.position.y = -0.02;
  scene.add(trim);

  const asm = makeAssembly({ cap: 'wl100', finish: 'glossy-gold', liquid: '#efcf94' });
  scene.add(asm.root);
  // Own materials so the finish can morph smoothly while scrolling.
  const capMat = new THREE.MeshPhysicalMaterial({ side: THREE.DoubleSide });
  const collarMat = new THREE.MeshPhysicalMaterial({ side: THREE.DoubleSide });
  lerpFinish(capMat, 'glossy-gold', 'glossy-gold', 1);
  lerpFinish(collarMat, 'glossy-gold', 'glossy-gold', 1);
  asm.capMesh.material = capMat;
  asm.collar.material = collarMat;
  asm.actuator.material = collarMat;
  const shadow = contactShadow(6.6, 4.4, 0.22);
  shadow.position.y = 0.012;
  const glow = caustic(3.2, 2.3, 0.45);
  glow.position.set(0.5, 0.02, 1.1);
  scene.add(shadow, glow);
  const ring = pulseRing(0xe2c27c); ring.position.y = asm.base + 0.36; asm.stack.add(ring);
  const lines = fieldLines(14, 0xe9c77f); lines.position.y = asm.base + 0.36; asm.stack.add(lines);

  // Laser engraving: a decal revealed behind a moving clipping plane, a beam and sparks.
  const cut = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0);
  // Laser removes the anodized colour, leaving bright matte aluminium.
  const engraveMat = new THREE.MeshPhysicalMaterial({ color: 0xf6f3ec, metalness: 0.15, roughness: 0.62, clippingPlanes: [cut] });
  const decal = logoDecal(asm.capMesh, CAPS.wl100, 'MAO HAN', engraveMat, { scale: 1.3 });
  if (decal) asm.capMesh.add(decal);
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xffb46b, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1, 8), beamMat);
  const spot = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshBasicMaterial({ map: softDot(), color: 0xffd39a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  scene.add(beam, spot);
  const SPARKS = 90;
  const sparkPos = new Float32Array(SPARKS * 3), sparkVel = new Float32Array(SPARKS * 3), sparkLife = new Float32Array(SPARKS);
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
  const sparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial({ map: softDot(), color: 0xffc27a, size: 0.12, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  scene.add(sparks);

  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
  let raf = 0, last = 0, smooth = 0, target = 0, time = 0;
  const visibleNow = whenVisible(section, v => v && wake());
  function wake() { if (!raf) raf = requestAnimationFrame(tick); }
  function readScroll() {
    const r = section.getBoundingClientRect();
    target = clamp01(-r.top / Math.max(1, r.height - innerHeight));
  }
  addEventListener('scroll', () => { readScroll(); wake(); }, { passive: true });

  function place(label, world, visible) {
    const el = labels[label];
    if (!el) return;
    tmp.copy(world).project(camera);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const x = (tmp.x * 0.5 + 0.5) * w, y = (-tmp.y * 0.5 + 0.5) * h;
    el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    el.style.opacity = visible.toFixed(3);
  }

  function tick(now) {
    raf = 0;
    if (!visibleNow()) return;
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
    last = now;
    time += dt;
    readScroll();
    smooth = motionAllowed() ? damp(smooth, target, 7, dt) : target;
    const p = smooth;

    fit(renderer, camera, stage);
    const wide = camera.aspect > 1.1;
    // On wide screens the product sits right of the copy column.
    const W = stage.clientWidth, H = stage.clientHeight;
    camera.setViewOffset(W, H, wide ? -W * 0.17 : W * 0.1, wide ? 0 : H * 0.1, W, H);

    const [yaw, pitch, dist0, ty] = cameraAt(p);
    const dist = dist0 * (wide ? 1 : Math.max(1, 0.62 / camera.aspect));
    camera.position.set(Math.sin(yaw) * Math.cos(pitch) * dist, ty + Math.sin(pitch) * dist, Math.cos(yaw) * Math.cos(pitch) * dist);
    camera.lookAt(0, ty, 0);
    camera.updateMatrixWorld();

    // 1. Lift: the magnet lets go.
    const liftIn = ease.inOutCubic(range(p, 0.14, 0.28));
    // 2. Exploded view.
    const explode = ease.inOutCubic(range(p, 0.3, 0.44)) * (1 - ease.inOutCubic(range(p, 0.52, 0.6)));
    // 4. Engrave, then close with a snap.
    const engrave = range(p, 0.8, 0.92);
    const close = range(p, 0.93, 0.99);
    const lift = close > 0 ? 0.9 * (1 - ease.snap(close)) : liftIn * 0.9 + explode * 1.6;
    const base = asm.base;
    asm.capGroup.position.y = base + 0.36 + lift * 2.6;
    asm.actuator.position.y = base + 1.435 + explode * 1.5;
    asm.collar.position.y = base + explode * 0.9;
    lines.userData.set(liftIn * (1 - range(p, 0.28, 0.32)) * 0.6, 1.2 + liftIn * 1.6);
    ring.userData.fire(close > 0 ? clamp01((close - 0.25) / 0.75) : 0);

    // 3. Finish tour.
    const tour = range(p, 0.6, 0.78) * (FINISH_TOUR.length - 1);
    const fi = Math.min(FINISH_TOUR.length - 2, Math.floor(tour));
    const ft = ease.inOutCubic(tour - fi);
    lerpFinish(capMat, FINISH_TOUR[fi], FINISH_TOUR[fi + 1], ft);
    const collarFrom = FINISH_TOUR[fi].includes('black') ? 'glossy-black' : FINISH_TOUR[fi].includes('silver') ? 'glossy-silver' : 'glossy-gold';
    const collarTo = FINISH_TOUR[fi + 1].includes('black') ? 'glossy-black' : FINISH_TOUR[fi + 1].includes('silver') ? 'glossy-silver' : 'glossy-gold';
    lerpFinish(collarMat, collarFrom, collarTo, ft);
    if (finishName) finishName.textContent = FINISHES[FINISH_TOUR[Math.round(tour)]].label;

    // Keep the logo facing the camera while it is engraved.
    asm.root.rotation.y = p > 0.72 ? -yaw * ease.inOutCubic(range(p, 0.72, 0.8)) * (1 - range(p, 0.95, 1)) : 0;
    asm.root.updateMatrixWorld(true);

    // Laser.
    if (decal) {
      const bb = new THREE.Box3().setFromObject(decal);
      const x = bb.min.x + (bb.max.x - bb.min.x) * engrave;
      cut.constant = engrave >= 1 ? 1e4 : x; // plane keeps points with x <= constant
      decal.visible = engrave > 0 || p > 0.92;
      const active = engrave > 0 && engrave < 1 ? 1 : 0;
      const beamOn = damp(beamMat.opacity, active ? 0.9 : 0, 12, dt);
      beamMat.opacity = beamOn;
      spot.material.opacity = beamOn;
      const hitPoint = tmp2.set(x, (bb.min.y + bb.max.y) / 2 + Math.sin(time * 40) * 0.05, bb.max.z);
      const from = new THREE.Vector3(hitPoint.x + 2.5, hitPoint.y + 7, hitPoint.z + 4);
      beam.position.copy(from).add(hitPoint).multiplyScalar(0.5);
      beam.scale.y = from.distanceTo(hitPoint);
      beam.lookAt(hitPoint); beam.rotateX(Math.PI / 2);
      spot.position.copy(hitPoint); spot.position.z += 0.05;
      spot.lookAt(camera.position);
      // Sparks spray from the contact point while the laser runs.
      for (let i = 0; i < SPARKS; i++) {
        sparkLife[i] -= dt;
        if (sparkLife[i] <= 0 && active && motionAllowed()) {
          sparkLife[i] = 0.25 + Math.random() * 0.45;
          sparkPos[i * 3] = hitPoint.x; sparkPos[i * 3 + 1] = hitPoint.y; sparkPos[i * 3 + 2] = hitPoint.z;
          sparkVel[i * 3] = (Math.random() - 0.3) * 2.2; sparkVel[i * 3 + 1] = Math.random() * 2.5 - 0.5; sparkVel[i * 3 + 2] = Math.random() * 1.8;
        }
        if (sparkLife[i] > 0) {
          sparkVel[i * 3 + 1] -= 9 * dt;
          sparkPos[i * 3] += sparkVel[i * 3] * dt; sparkPos[i * 3 + 1] += sparkVel[i * 3 + 1] * dt; sparkPos[i * 3 + 2] += sparkVel[i * 3 + 2] * dt;
        } else sparkPos[i * 3 + 1] = -999;
      }
      sparkGeo.attributes.position.needsUpdate = true;
    }

    // Labels for the exploded view.
    const show = explode;
    const R = CAPS.wl100.R;
    place('cap', asm.capGroup.localToWorld(tmp2.set(R, CAPS.wl100.H * 0.6, 0)).clone(), show);
    place('pump', asm.stack.localToWorld(tmp2.set(0.5, asm.actuator.position.y + 0.5, 0)).clone(), show);
    place('collar', asm.stack.localToWorld(tmp2.set(1.23, asm.collar.position.y + 0.2, 0)).clone(), show);
    place('bottle', asm.stack.localToWorld(tmp2.set(2.2, 3.4, 0)).clone(), show);

    // Copy: highlight the step for this part of the scroll.
    const active = p < 0.14 ? 0 : p < 0.3 ? 1 : p < 0.58 ? 2 : p < 0.79 ? 3 : 4;
    steps.forEach((s, i) => s.classList.toggle('is-active', i === active));
    if (progressBar) progressBar.style.transform = `scaleY(${p.toFixed(4)})`;

    renderer.render(scene, camera);
    if (!section.classList.contains('is-3d')) section.classList.add('is-3d');
    const settling = Math.abs(smooth - target) > 0.0005 || (engrave > 0 && engrave < 1) || sparkLife.some(l => l > 0) || (close > 0 && close < 1);
    if (settling) wake();
  }

  new ResizeObserver(wake).observe(stage);
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); section.classList.remove('is-3d'); });
  readScroll();
  wake();
}
