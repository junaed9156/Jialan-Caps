/* WL100 assembly study. The centre bottle is fixed. Two mounted specimens turn independently. */
import {
  THREE, CAPS, createRenderer, fit, studioEnvironment, makeAssembly, finishMaterial,
  contactShadow, backdrop, motionAllowed,
} from './kit.js';

export function mount(stage, sequence) {
  const canvas = document.createElement('canvas');
  canvas.className = 'hero-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  const renderer = createRenderer(canvas);
  stage.prepend(canvas);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#101f2a');
  scene.environment = studioEnvironment(renderer, { warmth: 0.62 });
  const camera = new THREE.PerspectiveCamera(28, 1, 0.3, 200);
  const wall = backdrop('#49646a', '#0c1925', { size: 115, z: -20, center: [0.51, 0.54] });
  scene.add(wall);

  const key = new THREE.DirectionalLight(0xffead0, 2.25);
  key.position.set(-6, 12, 9);
  const edge = new THREE.DirectionalLight(0xb5dbe8, 1.65);
  edge.position.set(8, 5, -5);
  scene.add(key, edge, new THREE.HemisphereLight(0xd9e7e8, 0x162737, 0.85));

  const tone = new THREE.MeshStandardMaterial({ color: '#233742', metalness: 0.36, roughness: 0.34 });
  const rim = new THREE.MeshStandardMaterial({ color: '#bc9a65', metalness: 0.83, roughness: 0.31 });
  function stand(x, z, radius, height, top) {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius + 0.05, height, 96), tone);
    body.position.set(x, top - height / 2, z);
    const lip = new THREE.Mesh(new THREE.TorusGeometry(radius - 0.015, 0.025, 8, 100), rim);
    lip.rotation.x = Math.PI / 2;
    lip.position.set(x, top + 0.005, z);
    scene.add(body, lip);
  }

  stand(0, 0, 3.5, 2.0, 0);
  const bottle = makeAssembly({
    cap: 'wl100', finish: 'glossy-gold', liquid: '#e6ba76',
    bottleSize: { width: 4.4, height: 5.4, depth: 2.75 },
  });
  bottle.root.rotation.y = -0.29;
  scene.add(bottle.root);
  const paper = document.createElement('canvas');
  paper.width = 512; paper.height = 232;
  const ink = paper.getContext('2d');
  ink.fillStyle = '#e8dfca'; ink.fillRect(0, 0, 512, 232);
  const labelMap = new THREE.CanvasTexture(paper);
  labelMap.colorSpace = THREE.SRGBColorSpace;
  labelMap.anisotropy = 8;
  // The Mao Han logo printed on the label (drawn once the image has loaded).
  const logo = new Image();
  logo.onload = () => {
    const h = 170, w = h * logo.naturalWidth / logo.naturalHeight;
    ink.drawImage(logo, (512 - w) / 2, (232 - h) / 2, w, h);
    labelMap.needsUpdate = true;
    document.dispatchEvent(new CustomEvent('jialan:motion'));
  };
  logo.src = 'assets/maohan-mark.png';
  const label = new THREE.Mesh(new THREE.PlaneGeometry(2.65, 1.2),
    new THREE.MeshStandardMaterial({ map: labelMap, roughness: 0.9 }));
  label.position.set(0, 2.34, 1.39);
  bottle.stack.add(label);
  const shadow = contactShadow(5.8, 3.7, 0.52, 0x06121c);
  shadow.position.y = 0.016;
  scene.add(shadow);

  /* A pale knurled cylinder and the black soft square make axial rotation legible in silhouette. */
  const exhibits = [];
  function specimen(cap, finish, x, y, z, scale, lean, speed) {
    const def = CAPS[cap];
    const pivot = new THREE.Group();
    pivot.position.set(x, y, z);
    pivot.scale.setScalar(scale);
    pivot.rotation.z = lean;
    pivot.rotation.x = 0.22;
    const turntable = new THREE.Group();
    const mesh = new THREE.Mesh(def.build(), finishMaterial(finish, { knurled: !!def.knurled, side: THREE.DoubleSide }));
    mesh.position.y = -def.H / 2;
    turntable.add(mesh);
    pivot.add(turntable);
    scene.add(pivot);
    exhibits.push({ cap, finish, mesh, turntable, speed });
  }
  specimen('jlg29', 'matte-silver', -4.9, 3.65, -0.7, 0.82, -0.32, 0.52);
  specimen('jlf33', 'glossy-black', 4.85, 5.9, -1.3, 0.81, 0.30, -0.42);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(100, 85),
    new THREE.MeshStandardMaterial({ color: '#142630', roughness: 0.62, metalness: 0.24 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -2.01;
  scene.add(floor);
  const target = new THREE.Vector3(0, 5.0, 0);
  function draw(pose, time) {
    fit(renderer, camera, stage);
    const distance = Math.max(16.4, 14.7 / camera.aspect) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    camera.position.set(0, target.y + distance * 0.13, distance);
    camera.lookAt(target);
    bottle.setLift(pose.lift);
    bottle.capGroup.position.x = pose.x;
    bottle.capGroup.rotation.set(0.035 * (pose.lift / 1.3), pose.yaw, pose.tilt, 'ZXY');
    exhibits.forEach(({ turntable, speed }, i) => { turntable.rotation.y = (i ? 0.68 : -0.56) + time * speed; });
    renderer.render(scene, camera);
    stage.classList.add('is-3d');
  }

  const ray = new THREE.Raycaster(), pointer = new THREE.Vector2();
  function pick(event) {
    const b = canvas.getBoundingClientRect();
    pointer.set(2 * (event.clientX - b.left) / b.width - 1, 1 - 2 * (event.clientY - b.top) / b.height);
    ray.setFromCamera(pointer, camera);
    const hit = ray.intersectObjects([bottle.capMesh, ...exhibits.map(e => e.mesh)], false)[0];
    if (hit?.object === bottle.capMesh) return { cap: 'wl100', finish: 'glossy-gold' };
    return hit && exhibits.find(item => item.mesh === hit.object);
  }
  canvas.addEventListener('pointermove', e => { canvas.style.cursor = pick(e) ? 'pointer' : ''; }, { passive: true });
  canvas.addEventListener('click', e => {
    const part = pick(e);
    if (!part) return;
    document.dispatchEvent(new CustomEvent('jialan:studio', { detail: { cap: part.cap, finish: part.finish } }));
    document.getElementById('studio')?.scrollIntoView({ behavior: motionAllowed() ? 'smooth' : 'auto' });
  });
  canvas.addEventListener('webglcontextlost', e => {
    e.preventDefault();
    stage.classList.remove('is-3d');
    sequence.unsubscribe(draw);
  });
  canvas.addEventListener('webglcontextrestored', () => sequence.subscribe(draw));
  sequence.subscribe(draw);
}
