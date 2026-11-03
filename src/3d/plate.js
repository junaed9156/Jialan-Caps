/* Orthographic metal specimens for visitors without WebGL.
   Projecting the four faces keeps the square turning through a full revolution. */
const corners = [[-30, 25], [30, 25], [30, -25], [-30, -25]];
const normals = [[0, 1], [1, 0], [0, -1], [-1, 0]];
const fixed = value => value.toFixed(2);

function rounded(points, radius = 0.12) {
  const toward = (a, b) => a.map((v, k) => fixed(v + (b[k] - v) * radius)).join(' ');
  const first = toward(points[0], points[points.length - 1]);
  return 'M' + first + points.map((p, i) => {
    const next = points[(i + 1) % points.length];
    return 'Q' + p.map(fixed).join(' ') + ' ' + toward(p, next) + 'L' + toward(next, p);
  }).join('') + 'Z';
}

export function plateRenderer(stage) {
  const cap = stage.querySelector('[data-plate-cap]');
  const engraving = stage.querySelector('[data-plate-mark]');
  const highlight = stage.querySelector('[data-plate-light]');
  const knurl = stage.querySelector('#crosshatch');
  const silverMark = stage.querySelector('[data-silver-mark]');
  const squareTop = stage.querySelector('[data-square-top]');
  const squareMark = stage.querySelector('[data-square-mark]');
  const faces = [...stage.querySelectorAll('[data-square-face]')];

  function square(angle) {
    const c = Math.cos(angle), s = Math.sin(angle);
    const project = ([x, z], y) => [x * c + z * s, y + 0.28 * (-x * s + z * c)];
    const top = corners.map(p => project(p, -26));
    const bottom = corners.map(p => project(p, 26));
    squareTop.setAttribute('d', rounded(top));
    faces.forEach((face, i) => {
      const [nx, nz] = normals[i];
      const visible = -nx * s + nz * c > 0;
      face.style.display = visible ? '' : 'none';
      if (!visible) return;
      const j = (i + 1) % 4;
      face.setAttribute('d', rounded([top[i], top[j], bottom[j], bottom[i]], 0.09));
    });
    const mid = project([0, 25], 5);
    squareMark.setAttribute('transform', `matrix(${fixed(c)} ${fixed(-0.28 * s)} 0 1 ${fixed(mid[0])} ${fixed(mid[1])})`);
    squareMark.setAttribute('opacity', fixed(Math.max(0, c)));
  }

  return function drawPlate(pose, time) {
    cap.setAttribute('transform', `translate(${fixed(pose.x * 28)} ${fixed(-pose.lift * 74)}) rotate(${fixed(pose.tilt * 180 / Math.PI)} 345 235)`);
    const c = Math.cos(pose.yaw), s = Math.sin(pose.yaw);
    engraving.setAttribute('transform', `translate(${fixed(345 + s * 35)} 0) scale(${fixed(Math.max(0.04, c))} 1) translate(-345 0)`);
    engraving.setAttribute('opacity', fixed(Math.max(0, c)));
    highlight.setAttribute('x', fixed(324 + s * 23));
    const silverAngle = time * 0.52 - 0.56;
    knurl.setAttribute('patternTransform', `translate(${fixed((silverAngle * 32) % 6)} 0)`);
    silverMark.setAttribute('transform', `translate(${fixed(29 * Math.sin(silverAngle))} 0) scale(${fixed(Math.max(0.04, Math.cos(silverAngle)))} 1)`);
    silverMark.setAttribute('opacity', fixed(Math.max(0, Math.cos(silverAngle))));
    square(0.68 - time * 0.42);
  };
}
