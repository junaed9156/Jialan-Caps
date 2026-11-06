/* Reuse the capability probe as the first scene's canvas instead of creating a disposable GPU context. */
export const contextAttributes = { alpha: false, antialias: true, powerPreference: 'high-performance' };
let reservedCanvas;

export function webglAvailable() {
  if (reservedCanvas) return true;
  try {
    const canvas = document.createElement('canvas');
    if (!canvas.getContext('webgl2', contextAttributes)) return false;
    reservedCanvas = canvas;
    return true;
  } catch { return false; }
}

export function createCanvas() {
  const canvas = reservedCanvas || document.createElement('canvas');
  reservedCanvas = undefined;
  return canvas;
}
