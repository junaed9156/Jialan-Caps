/* Shared 3D kit: renderer, studio lighting, finishes and real-dimension cap geometry.
   Units are centimetres. Dimensions follow the 2026 catalogue (e.g. WL100: Ø27.5 × 28.6 mm). */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';

export { THREE };

/* ---------- quality ---------- */
const coarse = matchMedia('(pointer: coarse)').matches;
const small = Math.min(screen.width, screen.height) < 700;
const weak = (navigator.deviceMemory || 8) <= 4 || (navigator.hardwareConcurrency || 8) <= 4;
export const Q = {
  low: coarse && (small || weak),
  dpr: Math.min(window.devicePixelRatio || 1, coarse ? 1.75 : 2),
  radial: coarse ? 96 : 160,
};

export const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
export const motionAllowed = () => !reducedMotion.matches && !document.body.classList.contains('motion-paused');

/* ---------- renderer ---------- */
export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.setPixelRatio(Q.dpr);
  return renderer;
}

export function fit(renderer, camera, element) {
  const w = Math.max(1, element.clientWidth), h = Math.max(1, element.clientHeight);
  const size = renderer.getSize(new THREE.Vector2());
  if (size.x !== w || size.y !== h) {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    return true;
  }
  return false;
}

/* ---------- studio environment: tall softboxes give the product-photography highlights ---------- */
export function studioEnvironment(renderer, { warmth = 0.5, light = false } = {}) {
  const scene = new THREE.Scene();
  const room = new THREE.SphereGeometry(30, 32, 16);
  const colors = [];
  const pos = room.attributes.position;
  // A light room suits the cream hero; the darker room gives the studio more contrast.
  const top = new THREE.Color(light ? 0xd2cfca : 0x6e6c69), mid = new THREE.Color(light ? 0x6b6763 : 0x2d2c2b), bottom = new THREE.Color(light ? 0xaaa59c : 0x3b3a37);
  for (let i = 0; i < pos.count; i++) {
    const t = pos.getY(i) / 30;
    const c = t > 0 ? mid.clone().lerp(top, t) : mid.clone().lerp(bottom, -t);
    colors.push(c.r, c.g, c.b);
  }
  room.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  scene.add(new THREE.Mesh(room, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const warm = new THREE.Color(1, 0.94, 0.86), cool = new THREE.Color(0.9, 0.96, 1);
  const softbox = (w, h, x, y, z, power, color) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(power), side: THREE.DoubleSide }));
    m.position.set(x, y, z);
    m.lookAt(0, y * 0.35, 0);
    scene.add(m);
  };
  softbox(3.2, 16, -13, 3, 9, 11, warm.clone().lerp(cool, 1 - warmth));   // key strip, front left
  softbox(2.4, 16, 14, 3, 4, 6, cool);                                    // rim strip, right
  softbox(2.0, 14, 3, 2, -16, 3.5, warm);                                 // back strip
  softbox(18, 9, 0, 17, 2, 4.5, new THREE.Color(1, 1, 1));               // top panel
  softbox(26, 3, 0, -6, 12, 1.2, warm);                                  // floor bounce
  const pmrem = new THREE.PMREMGenerator(renderer);
  const target = pmrem.fromScene(scene, 0.015, 0.1, 100);
  pmrem.dispose();
  scene.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); });
  return target.texture;
}

/* ---------- procedural textures ---------- */
function canvasTexture(w, h, draw, { srgb = true, repeat } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  t.anisotropy = 8;
  return t;
}

function noise1(x) { return Math.sin(x * 12.9898) * 43758.5453 % 1; }

export function woodTexture(base = '#5b3a29', dark = '#3a2419', light = '#7a5038') {
  return canvasTexture(1024, 512, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    // Long grain runs vertically on the cap (texture v axis), with gentle waves.
    for (let i = 0; i < 300; i++) {
      const x = (i / 300) * w + noise1(i) * 6;
      const width = 0.8 + Math.abs(noise1(i * 3.7)) * 3.4;
      g.strokeStyle = i % 3 ? dark : light;
      g.globalAlpha = 0.28 + Math.abs(noise1(i * 1.3)) * 0.45;
      g.lineWidth = width;
      g.beginPath();
      for (let y = 0; y <= h; y += 16) {
        const wave = Math.sin(y / h * Math.PI * 2 + i * 0.7) * 3 + Math.sin(y / 37 + i) * 1.2;
        y ? g.lineTo(x + wave, y) : g.moveTo(x + wave, y);
      }
      g.stroke();
    }
    g.globalAlpha = 1;
  }, { repeat: [2, 1] });
}

export function knurlNormalMap() {
  // A diamond-knurl height field converted to a tangent-space normal map.
  const w = 256, h = 256, data = new Uint8Array(w * h * 4), height = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = x / w * 8, v = y / h * 8;
    const a = Math.abs(((u + v) % 1) - 0.5), b = Math.abs(((u - v + 16) % 1) - 0.5);
    height[y * w + x] = Math.min(a, b);
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const hx = height[y * w + (x + 1) % w] - height[y * w + (x - 1 + w) % w];
    const hy = height[((y + 1) % h) * w + x] - height[((y - 1 + h) % h) * w + x];
    const n = new THREE.Vector3(-hx * 6, -hy * 6, 1).normalize();
    const i = (y * w + x) * 4;
    data[i] = (n.x * 0.5 + 0.5) * 255; data[i + 1] = (n.y * 0.5 + 0.5) * 255; data[i + 2] = (n.z * 0.5 + 0.5) * 255; data[i + 3] = 255;
  }
  const t = new THREE.DataTexture(data, w, h);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(6, 2);
  t.needsUpdate = true;
  return t;
}

export function brushedRoughness() {
  return canvasTexture(512, 512, (g, w, h) => {
    g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) {
      const x = Math.random() * w, l = 40 + Math.random() * 300, c = 100 + Math.random() * 90;
      g.strokeStyle = `rgb(${c},${c},${c})`; g.globalAlpha = 0.25; g.lineWidth = Math.random() * 1.2 + 0.3;
      g.beginPath(); const y = Math.random() * h; g.moveTo(x, y); g.lineTo(x, y + l); g.stroke();
    }
  }, { srgb: false, repeat: [3, 1] });
}

let knurl, brushed;
const woods = {};

/* ---------- finishes (named like the catalogue) ---------- */
export const FINISHES = {
  'glossy-gold':   { label: 'Glossy gold',   swatch: 'linear-gradient(120deg,#8d661e,#f4d58f,#ad7f23)', color: '#e9bd6c', metalness: 1, roughness: 0.14, clearcoat: 0.5 },
  'matte-gold':    { label: 'Matte gold',    swatch: 'linear-gradient(120deg,#9f8344,#e2c98f,#a88a4b)', color: '#dcbf86', metalness: 1, roughness: 0.42 },
  'glossy-silver': { label: 'Glossy silver', swatch: 'linear-gradient(115deg,#8a9e9c,#f1f6f4,#a7b6b1)', color: '#eef1f2', metalness: 1, roughness: 0.09 },
  'matte-silver':  { label: 'Matte silver',  swatch: 'linear-gradient(115deg,#a3adb0,#e3e8e8,#b3bcbd)', color: '#d9dee0', metalness: 1, roughness: 0.4 },
  'glossy-black':  { label: 'Glossy black',  swatch: 'linear-gradient(120deg,#111a1a,#5b6661,#172321)', color: '#0b0c0d', metalness: 0.3, roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.03 },
  'matte-black':   { label: 'Matte black',   swatch: '#2b302f', color: '#141516', metalness: 0.25, roughness: 0.55 },
  'glossy-red':    { label: 'Glossy red',    swatch: 'linear-gradient(120deg,#5c0f17,#c9414c,#6e141d)', color: '#a3162a', metalness: 1, roughness: 0.18, clearcoat: 0.8 },
  'dark-grey':     { label: 'Glossy dark grey', swatch: 'linear-gradient(120deg,#3c4447,#8b979a,#465053)', color: '#545b5f', metalness: 1, roughness: 0.2, clearcoat: 0.6 },
  'matte-purple':  { label: 'Matte purple',  swatch: '#776a96', color: '#7d6dab', metalness: 0.9, roughness: 0.42 },
  'glossy-coffee': { label: 'Glossy coffee', swatch: 'linear-gradient(120deg,#2e1d16,#7a5545,#3a261d)', color: '#4c2d22', metalness: 0.9, roughness: 0.22, clearcoat: 0.7 },
  'white-coating': { label: 'White coating', swatch: '#ece9df', color: '#f2f0ea', metalness: 0, roughness: 0.34, clearcoat: 0.35 },
  'blue-coating':  { label: 'Blue coating',  swatch: '#5aaed0', color: '#4fb3dd', metalness: 0, roughness: 0.36, clearcoat: 0.25 },
  'brushed-gold':  { label: 'Brushed gold',  swatch: 'repeating-linear-gradient(90deg,#b08a3e 0 2px,#e2c27f 2px 4px)', color: '#e0bb73', metalness: 1, roughness: 0.3, brushed: true },
  'wood-coffee':   { label: 'Coffee wood',   swatch: 'linear-gradient(90deg,#35271e,#73523c,#3b291e)', wood: ['#5d3b2a', '#3b2419', '#7b5139'] },
  'wood-white':    { label: 'White wood',    swatch: '#ddd6c6', wood: ['#e4dccb', '#c9bea8', '#f2ece0'] },
  'wood-black':    { label: 'Black wood',    swatch: '#2e2c25', wood: ['#26211d', '#141110', '#3a332d'] },
};

const matCache = new Map();
export function finishMaterial(key, { knurled = false, side = THREE.FrontSide } = {}) {
  const id = `${key}|${knurled}|${side}`;
  if (matCache.has(id)) return matCache.get(id);
  const f = FINISHES[key] || FINISHES['glossy-gold'];
  let m;
  if (f.wood) {
    woods[key] ||= woodTexture(...f.wood);
    m = new THREE.MeshPhysicalMaterial({ map: woods[key], metalness: 0, roughness: 0.58, clearcoat: 0.25, clearcoatRoughness: 0.4, side });
  } else {
    m = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(f.color), metalness: f.metalness, roughness: f.roughness,
      clearcoat: f.clearcoat || 0, clearcoatRoughness: f.clearcoatRoughness ?? 0.08, side,
    });
    if (f.brushed) {
      brushed ||= brushedRoughness();
      m.roughnessMap = brushed;
      m.anisotropy = 0.85;
      m.anisotropyRotation = Math.PI / 2;
    }
  }
  if (knurled) {
    knurl ||= knurlNormalMap();
    m = m.clone();
    m.normalMap = knurl;
    m.normalScale = new THREE.Vector2(0.9, 0.9);
  }
  m.userData.finish = key;
  matCache.set(id, m);
  return m;
}

/* Smoothly carry a material from one finish to another (used by the scroll story). */
export function lerpFinish(material, fromKey, toKey, t) {
  const a = FINISHES[fromKey], b = FINISHES[toKey];
  if (!a || !b || a.wood || b.wood) return;
  material.color.set(a.color).lerp(new THREE.Color(b.color), t);
  material.metalness = THREE.MathUtils.lerp(a.metalness, b.metalness, t);
  material.roughness = THREE.MathUtils.lerp(a.roughness, b.roughness, t);
  material.clearcoat = THREE.MathUtils.lerp(a.clearcoat || 0, b.clearcoat || 0, t);
}

/* ---------- lathe with crisp edges ----------
   profile: [[r, y, smooth?], ...] traced from the top centre outward and down.
   Normals: (-dy, dr) relative to travel direction, so outer faces point outward. */
export function lathe(profile, radial = Q.radial, { ribs } = {}) {
  const pos = [], nor = [], uv = [], idx = [];
  const segN = [];
  let total = 0;
  const lengths = [0];
  for (let i = 0; i < profile.length - 1; i++) {
    const [r0, y0] = profile[i], [r1, y1] = profile[i + 1];
    const dr = r1 - r0, dy = y1 - y0, len = Math.hypot(dr, dy) || 1e-6;
    segN.push([-dy / len, dr / len]);
    total += len; lengths.push(total);
  }
  const ringNormal = (i, end) => {
    // Normal for the end (or start) of segment i, blended with the neighbour when the vertex is smooth.
    const s = segN[i];
    const vi = end ? i + 1 : i;
    const smooth = profile[vi][2];
    const ni = end ? i + 1 : i - 1;
    if (smooth && ni >= 0 && ni < segN.length) {
      const o = segN[ni];
      const x = s[0] + o[0], y = s[1] + o[1], l = Math.hypot(x, y) || 1;
      return [x / l, y / l];
    }
    return s;
  };
  for (let i = 0; i < profile.length - 1; i++) {
    const base = pos.length / 3;
    for (const end of [0, 1]) {
      const [r, y] = profile[i + end];
      const [nr, ny] = ringNormal(i, end);
      for (let j = 0; j <= radial; j++) {
        const t = j / radial * Math.PI * 2, s = Math.sin(t), c = Math.cos(t);
        let rr = r;
        if (ribs && r > 0.3) rr += ribs(t, y);
        pos.push(rr * s, y, rr * c);
        nor.push(nr * s, ny, nr * c);
        uv.push(j / radial, 1 - lengths[i + end] / total);
      }
    }
    for (let j = 0; j < radial; j++) {
      const a = base + j, b = base + j + 1, c = base + radial + 1 + j, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

/* Quarter-circle fillet points from corner (cx, cy) with radius rad. */
function arc(cx, cy, rad, from, to, steps = 8) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const a = from + (to - from) * i / steps;
    pts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad, i > 0 && i < steps]);
  }
  return pts;
}

/* A cap shell: outer form, a thin rim, and the inner wall/ceiling seen when it lifts. */
function shell(outer, R, wall = 0.11, depth) {
  const inner = R - wall;
  const d = depth ?? outer[0][1] - 0.35;
  return [...outer, [inner, 0, false], [inner, d, false], [0.001, d, false]];
}

function cylinderCap(R, H, fillet = 0.1) {
  return shell([
    [0.001, H], ...arc(R - fillet, H - fillet, fillet, Math.PI / 2, 0), [R, 0.04], [R - 0.04, 0],
  ], R);
}

/* Cap families. Sizes in cm from the catalogue. `top` is the cap height above the collar step. */
export const CAPS = {
  wl100: { model: 'WL100', name: 'Signature cylinder', R: 1.375, H: 2.86, build: () => lathe(cylinderCap(1.375, 2.86, 0.12)) },
  wll100: { model: 'WLL100', name: 'Extended cylinder', R: 1.375, H: 3.5, build: () => lathe(cylinderCap(1.375, 3.5, 0.12)) },
  ky100: { model: 'KY100', name: 'Bead-rolled classic', R: 1.55, H: 3.28, build: () => {
    const R = 1.55, H = 3.28, f = 0.13, groove = (y) => [[R, y + 0.07, false], [R - 0.055, y + 0.025, true], [R - 0.055, y - 0.025, true], [R, y - 0.07, false]];
    return lathe(shell([[0.001, H], ...arc(R - f, H - f, f, Math.PI / 2, 0), ...groove(2.3), ...groove(1.55), ...groove(0.8), [R, 0.04], [R - 0.04, 0]], R));
  } },
  jlg29: { model: 'JLG29', name: 'Diamond knurl', R: 1.44, H: 3.18, knurled: true, build: () => lathe(cylinderCap(1.44, 3.18, 0.09)) },
  jlq36: { model: 'JLQ36', name: 'Statement sphere', R: 1.79, H: 3.3, build: () => {
    const r = 1.79, cy = 1.51, open = Math.sqrt(r * r - cy * cy);
    const pts = [[0.001, cy + r]];
    const end = Math.atan2(-cy, open);
    for (let i = 1; i <= 40; i++) { const a = Math.PI / 2 + (end - Math.PI / 2) * i / 40; pts.push([Math.cos(a) * r, cy + Math.sin(a) * r, i < 40]); }
    pts.push([0.86, 0, false], [0.86, 1.6, false], [0.001, 1.6, false]);
    return lathe(pts);
  } },
  jlw37: { model: 'JLW37', name: 'Rounded dome', R: 1.84, H: 3.0, build: () => {
    const r = 1.84, base = 3.0 - r * 0.92, pts = [[0.001, 3.0]];
    for (let i = 1; i <= 30; i++) { const a = Math.PI / 2 - (Math.PI / 2) * i / 30; pts.push([Math.cos(a) * r, base + Math.sin(a) * r * 0.92, i < 30]); }
    pts.push([r * 0.97, 0.05, true], [r * 0.95, 0, false]);
    return lathe(shell(pts, r * 0.95, 0.12, 1.8));
  } },
  jlf33: { model: 'JLF33', name: 'Soft square', R: 1.65, H: 2.76, square: true, build: () => {
    const g = new RoundedBoxGeometry(3.3, 2.76, 3.3, 6, 0.42);
    g.translate(0, 1.38, 0);
    return g;
  } },
  jlm31: { model: 'JLM31', name: 'Hardwood cylinder', R: 1.525, H: 3.25, wood: true, build: () => lathe(cylinderCap(1.525, 3.25, 0.18)) },
};

/* ---------- assembly parts ---------- */
export function collarGeometry() {
  // Single-step shoulder collar: Ø24.6 flange, Ø17.2 sleeve, 14.85 mm tall.
  const f = 0.04;
  return lathe([
    [0.72, 1.485, false], [0.86 - f, 1.485, true], [0.86, 1.485 - f, true], [0.86, 0.36, false],
    [1.23 - f, 0.36, true], [1.23, 0.36 - f, true], [1.23, 0.02, true], [1.21, 0, false], [0.72, 0, false], [0.72, 1.485, false],
  ], Math.round(Q.radial * 0.8));
}

export function actuatorGeometry() {
  return lathe([
    [0.001, 0.98], ...arc(0.42, 0.9, 0.08, Math.PI / 2, 0, 5), [0.5, 0.06, true], [0.47, 0, false], [0.25, 0, false],
  ], 64);
}

export function makeBottle({ width = 4.4, depth = 2.9, height = 6.8, liquid = '#e9c98f', shape = 'square' } = {}) {
  const group = new THREE.Group();
  // DoubleSide lets three.js draw the far walls into the refraction buffer, so the glass reads as a solid.
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, metalness: 0, roughness: 0.03, transmission: 1, thickness: 1.1, ior: 1.52,
    attenuationColor: new THREE.Color('#c9e3d8'), attenuationDistance: 4.5, specularIntensity: 1,
    envMapIntensity: 1.25, dispersion: Q.low ? 0 : 0.4, side: THREE.DoubleSide,
  });
  const liquidMat = liquid && new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.02, metalness: 0, transmission: 1, thickness: 2.2, ior: 1.36,
    attenuationColor: new THREE.Color(liquid), attenuationDistance: 1.1, side: THREE.DoubleSide, envMapIntensity: 0.8 });
  let glass, liq;
  if (shape === 'round') {
    // Curved walls shift the refraction strongly, so round glass uses a thinner optical thickness.
    glassMat.thickness = 0.3;
    if (liquidMat) { liquidMat.thickness = 0.9; liquidMat.attenuationDistance = 0.7; }
    const R = width / 2, f = 0.7;
    glass = new THREE.Mesh(lathe([[0.001, height], ...arc(R - f, height - f, f, Math.PI / 2, 0, 10), ...arc(R - 0.3, 0.3, 0.3, 0, -Math.PI / 2, 6), [0.001, 0]], 96), glassMat);
    if (liquid) {
      const r = R - 0.32, lh = height * 0.58;
      liq = new THREE.Mesh(lathe([[0.001, lh], [r, lh, false], ...arc(r - 0.25, 0.25, 0.25, 0, -Math.PI / 2, 5), [0.001, 0]], 80), liquidMat);
      liq.position.y = 0.95;
    }
  } else {
    glass = new THREE.Mesh(new RoundedBoxGeometry(width, height, depth, 8, 0.5), glassMat);
    glass.position.y = height / 2;
    if (liquid) {
      const lh = height * 0.62;
      liq = new THREE.Mesh(new RoundedBoxGeometry(width - 0.62, lh, depth - 0.62, 6, 0.32), liquidMat);
      liq.position.y = 0.95 + lh / 2;
    }
  }
  group.add(glass);
  if (liq) {
    group.add(liq);
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, height - 1.0, 12),
      new THREE.MeshPhysicalMaterial({ color: 0xf4f6f4, roughness: 0.25, transmission: 0.6, thickness: 0.1 }));
    tube.position.y = (height - 1.0) / 2 + 0.85;
    group.add(tube);
  }
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.82, 0.32, 48), glassMat);
  neck.position.y = height + 0.12;
  group.add(neck);
  group.userData = { height: height + 0.25, glass, glassMat, liquid: liq };
  return group;
}

/* A complete closure: optional bottle, collar, actuator and a cap that can lift. */
export function makeAssembly({ cap = 'wl100', finish = 'glossy-gold', collarFinish, bottle = true, liquid, bottleShape = 'square', bottleSize = {} } = {}) {
  const root = new THREE.Group();
  const stack = new THREE.Group();
  root.add(stack);
  let base = 0, bottleObj = null;
  if (bottle) {
    bottleObj = makeBottle({ liquid, shape: bottleShape, ...bottleSize });
    stack.add(bottleObj);
    base = bottleObj.userData.height;
  }
  const collar = new THREE.Mesh(collarGeometry(), finishMaterial(collarFinish || matchCollar(finish), { side: THREE.DoubleSide }));
  collar.position.y = base;
  const actuator = new THREE.Mesh(actuatorGeometry(), finishMaterial(collarFinish || matchCollar(finish)));
  actuator.position.y = base + 1.485 - 0.05;
  const capGroup = new THREE.Group();
  capGroup.position.y = base + 0.36;
  const capMesh = new THREE.Mesh();
  capGroup.add(capMesh);
  stack.add(collar, actuator, capGroup);
  const api = {
    root, stack, collar, actuator, capGroup, capMesh, bottle: bottleObj, base,
    capKey: null, finish,
    setCap(key) {
      const def = CAPS[key] || CAPS.wl100;
      capMesh.geometry?.dispose();
      capMesh.geometry = def.build();
      api.capKey = key;
      api.setFinish(def.wood && !FINISHES[api.finish]?.wood ? 'wood-coffee' : (!def.wood && FINISHES[api.finish]?.wood ? 'glossy-gold' : api.finish));
      return def;
    },
    setFinish(key, collarKey) {
      api.finish = key;
      const def = CAPS[api.capKey] || CAPS.wl100;
      capMesh.material = finishMaterial(key, { knurled: !!def.knurled, side: THREE.DoubleSide });
      const c = collarKey || collarFinish || matchCollar(key);
      collar.material = finishMaterial(c, { side: THREE.DoubleSide });
      actuator.material = finishMaterial(c);
    },
    /* 0 = seated on the collar, 1 = lifted clear of the actuator. */
    setLift(t) { capGroup.position.y = base + 0.36 + t * 2.6; },
    height() { return base + 0.36 + (CAPS[api.capKey]?.H || 2.86); },
  };
  api.setCap(cap);
  api.setFinish(finish);
  for (const m of [collar, actuator, capMesh]) { m.castShadow = false; m.receiveShadow = false; }
  return api;
}

export function matchCollar(finish) {
  if (finish.includes('gold') || finish.includes('wood') || finish === 'white-coating' || finish === 'blue-coating') return 'glossy-gold';
  if (finish.includes('silver')) return 'glossy-silver';
  if (finish.includes('black')) return finish;
  return 'glossy-silver';
}

/* ---------- soft contact shadow ---------- */
let shadowTex;
/* Soft round sprite for floating light particles. */
let dotTex;
export function softDot() {
  dotTex ||= canvasTexture(64, 64, (g, w) => {
    const grad = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.4, 'rgba(255,255,255,0.35)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad; g.fillRect(0, 0, w, w);
  });
  return dotTex;
}

/* A flowing silk ribbon, like the fabric on the catalogue cover. Call update(t) to move it. */
export function silkRibbon({ length = 64, width = 7, color = '#eadfc8', sheen = '#fff3dc', segments = [220, 24] } = {}) {
  const geo = new THREE.PlaneGeometry(length, width, segments[0], segments[1]);
  const rest = geo.attributes.position.array.slice();
  const mat = new THREE.MeshPhysicalMaterial({ color, sheen: 1, sheenColor: new THREE.Color(sheen), sheenRoughness: 0.35,
    roughness: 0.5, metalness: 0, side: THREE.DoubleSide, envMapIntensity: 0.7 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData.update = (t) => {
    const p = geo.attributes.position.array;
    for (let i = 0; i < p.length; i += 3) {
      const x = rest[i], v = rest[i + 1];
      const twist = x * 0.07 + Math.sin(t * 0.25 + x * 0.03) * 0.6;
      const wave = Math.sin(x * 0.16 + t * 0.45) * 1.9 + Math.sin(x * 0.07 - t * 0.3) * 1.3;
      p[i] = x;
      p[i + 1] = wave + v * Math.cos(twist);
      p[i + 2] = Math.cos(x * 0.1 + t * 0.2) * 2.2 + v * Math.sin(twist);
    }
    geo.attributes.position.needsUpdate = true;
    geo.computeVertexNormals();
  };
  mesh.userData.update(0);
  return mesh;
}

export function contactShadow(width, depth = width, opacity = 0.45, color = 0x1d2a22) {
  shadowTex ||= canvasTexture(256, 256, (g, w, h) => {
    const grad = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.35, 'rgba(255,255,255,0.55)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
  }, { srgb: false });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(width, depth),
    new THREE.MeshBasicMaterial({ color, alphaMap: shadowTex, transparent: true, opacity, depthWrite: false, toneMapped: false }));
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = 1;
  return m;
}

/* Warm light focused through a glass bottle onto the surface below it. */
let causticTex;
export function caustic(width, depth = width, opacity = 0.5, color = 0xffd9a0) {
  causticTex ||= canvasTexture(256, 256, (g, w, h) => {
    const grad = g.createRadialGradient(w * 0.5, h * 0.5, 0, w * 0.5, h * 0.5, w * 0.5);
    grad.addColorStop(0, 'rgba(255,255,255,0.9)');
    grad.addColorStop(0.25, 'rgba(255,255,255,0.35)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
  }, { srgb: false });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(width, depth),
    new THREE.MeshBasicMaterial({ color, alphaMap: causticTex, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = 2;
  return m;
}

/* ---------- gradient backdrop rendered inside the scene so glass refracts it ---------- */
export function backdrop(inner, outer, { size = 140, z = -30, center = [0.5, 0.55] } = {}) {
  // Opaque, so transmissive glass refracts it. An optional warm glow acts as a softbox behind a bottle.
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      cInner: { value: new THREE.Color(inner) }, cOuter: { value: new THREE.Color(outer) }, uCenter: { value: new THREE.Vector2(...center) },
      uGlow: { value: 0 }, uGlowPos: { value: new THREE.Vector2(0.5, 0.5) }, uGlowSize: { value: new THREE.Vector2(0.05, 0.09) }, uGlowColor: { value: new THREE.Color('#ffe2b4') },
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform vec3 cInner; uniform vec3 cOuter; uniform vec2 uCenter; uniform float uGlow; uniform vec2 uGlowPos; uniform vec2 uGlowSize; uniform vec3 uGlowColor; varying vec2 vUv;
      void main(){ float d = distance(vUv, uCenter) * 2.2; vec3 c = mix(cInner, cOuter, smoothstep(0.0, 1.0, d));
      vec2 g = (vUv - uGlowPos) / uGlowSize; c += uGlowColor * uGlow * exp(-dot(g, g) * 1.6);
      gl_FragColor = vec4(c, 1.0);
      #include <colorspace_fragment>
      }`,
    depthWrite: false,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
  m.position.z = z;
  m.renderOrder = -10;
  m.userData.size = size;
  return m;
}

/* ---------- text on a texture (scene lettering and logo previews) ---------- */
export function textTexture(text, { width = 2048, height = 512, font = 'Georgia, serif', weight = 400, color = '#ffffff', spacing = 0.12, size = 0.62, sub } = {}) {
  return canvasTexture(width, height, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = color;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    let px = h * size;
    const measure = () => {
      g.font = `${weight} ${px}px ${font}`;
      return [...text].reduce((s, ch) => s + g.measureText(ch).width, 0) + px * spacing * (text.length - 1);
    };
    while (measure() > w * 0.92 && px > 10) px *= 0.94;
    const total = measure();
    let x = (w - total) / 2;
    const y = sub ? h * 0.43 : h / 2;
    for (const ch of text) {
      const cw = g.measureText(ch).width;
      g.fillText(ch, x + cw / 2, y);
      x += cw + px * spacing;
    }
    if (sub) {
      g.font = `400 ${px * 0.2}px Arial, sans-serif`;
      const s = sub.split('').join(String.fromCharCode(8202));
      g.fillText(s, w / 2, h * 0.78);
    }
  });
}

/* A logo decal hugging the front of a cap, in the cap mesh's own space. */
const _probe = new THREE.Raycaster();
export function logoDecal(capMesh, def, text, material, { font = 'Georgia, serif', scale = 1 } = {}) {
  const tex = textTexture(text.toUpperCase(), { width: 1024, height: 256, spacing: 0.18, size: 0.7, font });
  const local = new THREE.Mesh(capMesh.geometry, capMesh.material);
  local.updateMatrixWorld(true);
  const y = def.H * (def.square ? 0.5 : 0.56);
  _probe.set(new THREE.Vector3(0, y, 20), new THREE.Vector3(0, 0, -1));
  const hit = _probe.intersectObject(local, false)[0];
  if (!hit) return null;
  const w = def.R * (def.square ? 1.55 : 1.35) * scale, h = w / 4;
  const geo = new DecalGeometry(local, hit.point, new THREE.Euler(), new THREE.Vector3(w, h, def.R * 1.2));
  material.alphaMap = tex; material.transparent = true; material.alphaTest = 0.35; material.depthWrite = false;
  material.polygonOffset = true; material.polygonOffsetFactor = -4;
  const m = new THREE.Mesh(geo, material);
  m.userData.width = w; m.userData.texture = tex; m.userData.center = hit.point.clone();
  return m;
}

/* The red Mao Han mark as a decal (image, not text). Aspect 400:329. */
let _markTex;
export function markTexture() {
  if (!_markTex) {
    _markTex = new THREE.TextureLoader().load('assets/maohan-mark.png', () => document.dispatchEvent(new CustomEvent('jialan:motion')));
    _markTex.colorSpace = THREE.SRGBColorSpace;
    _markTex.anisotropy = 8;
  }
  return _markTex;
}
/* The red Mao Han mark printed on the exact centre of a bottle's front face (no text, no paper). */
export function bottleMark(bottle, { size = 0.26 } = {}) {
  const glass = bottle.userData.glass;
  glass.geometry.computeBoundingBox();
  const box = glass.geometry.boundingBox.clone().translate(glass.position);
  const h = (box.max.y - box.min.y) * size, w = h * 400 / 329;
  const mark = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
    new THREE.MeshStandardMaterial({ map: markTexture(), transparent: true, alphaTest: 0.35, roughness: 0.4, depthWrite: false }));
  mark.position.set((box.min.x + box.max.x) / 2, (box.min.y + box.max.y) / 2, box.max.z + 0.012);
  mark.renderOrder = 2;
  return mark;
}

/* The mark's silhouette in one colour (for laser engraving): alpha from the logo, colour from `color`. */
let _markSil = null;
export function markSilhouette(color = '#ffffff') {
  if (_markSil) return _markSil;
  const c = document.createElement('canvas');
  c.width = 400; c.height = 329;
  _markSil = new THREE.CanvasTexture(c);
  _markSil.colorSpace = THREE.SRGBColorSpace;
  _markSil.anisotropy = 8;
  const img = new Image();
  img.onload = () => {
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0, c.width, c.height);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = color; g.fillRect(0, 0, c.width, c.height);
    _markSil.needsUpdate = true;
    document.dispatchEvent(new CustomEvent('jialan:motion'));
  };
  img.src = 'assets/maohan-mark.png';
  return _markSil;
}

export function markDecal(capMesh, def, { scale = 1, material } = {}) {
  const local = new THREE.Mesh(capMesh.geometry, capMesh.material);
  local.updateMatrixWorld(true);
  const y = def.H * (def.square ? 0.5 : 0.55);
  _probe.set(new THREE.Vector3(0, y, 20), new THREE.Vector3(0, 0, -1));
  const hit = _probe.intersectObject(local, false)[0];
  if (!hit) return null;
  const w = def.R * (def.square ? 0.62 : 0.55) * scale, h = w * 329 / 400;
  const geo = new DecalGeometry(local, hit.point, new THREE.Euler(), new THREE.Vector3(w, h, def.R * 1.2));
  material = material || new THREE.MeshStandardMaterial({ map: markTexture(), transparent: true, alphaTest: 0.4, roughness: 0.45, metalness: 0.1,
    depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
  return new THREE.Mesh(geo, material);
}

/* ---------- motion helpers ---------- */
export const ease = {
  outCubic: t => 1 - Math.pow(1 - t, 3),
  inOutCubic: t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  outBack: (t, s = 1.6) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2),
  /* A magnet snap: fast approach, a small overshoot and a quick settle. */
  snap: t => {
    if (t <= 0) return 0; if (t >= 1) return 1;
    const p = 1 - Math.pow(1 - Math.min(1, t * 1.25), 4);
    return p + Math.sin(Math.min(1, t * 1.25) * Math.PI * 3) * 0.05 * (1 - t);
  },
};
export const clamp01 = t => Math.min(1, Math.max(0, t));
export const damp = (a, b, lambda, dt) => THREE.MathUtils.damp(a, b, lambda, dt);
export const range = (p, a, b) => clamp01((p - a) / (b - a));

/* ---------- pulse ring and magnetic field lines ---------- */
export function pulseRing(color = 0xd8b46a) {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.96, 1, 96),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false }));
  m.rotation.x = -Math.PI / 2;
  m.userData.fire = (t) => {
    // t: 0..1 progress of the expanding ring.
    const s = 1.2 + t * 3.4;
    m.scale.set(s, s, s);
    m.material.opacity = t <= 0 || t >= 1 ? 0 : (1 - t) * 0.85;
  };
  return m;
}

export function fieldLines(count = 10, color = 0xf3d89a) {
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  for (let i = 0; i < count; i++) {
    const a = i / count * Math.PI * 2;
    const pts = [];
    for (let k = 0; k <= 24; k++) {
      const t = k / 24, bulge = Math.sin(t * Math.PI) * 0.75;
      const r = 0.95 + bulge;
      pts.push(new THREE.Vector3(Math.cos(a) * r, t, Math.sin(a) * r));
    }
    const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 32, 0.012, 6), mat);
    group.add(tube);
  }
  group.userData.set = (opacity, height) => { mat.opacity = opacity; group.scale.y = Math.max(0.001, height); group.visible = opacity > 0.01; };
  return group;
}

/* ---------- render only while visible ---------- */
export function whenVisible(element, onChange) {
  let visible = false;
  const io = new IntersectionObserver(entries => {
    const v = entries.some(e => e.isIntersecting);
    if (v !== visible) { visible = v; onChange(visible && !document.hidden); }
  }, { rootMargin: '120px 0px' });
  io.observe(element);
  document.addEventListener('visibilitychange', () => onChange(visible && !document.hidden));
  return () => visible && !document.hidden;
}
