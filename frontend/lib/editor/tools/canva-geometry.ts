import type { CanvaLayer } from '../state.js';

function imageWidth(img: HTMLImageElement | null) {
  return img?.width || img?.naturalWidth || 1;
}

function imageHeight(img: HTMLImageElement | null) {
  return img?.height || img?.naturalHeight || 1;
}

function layerCorners(layer: CanvaLayer) {
  const cx = layer.x + layer.w / 2;
  const cy = layer.y + layer.h / 2;
  const hw = layer.w / 2;
  const hh = layer.h / 2;
  const angle = layer.angle * Math.PI / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [
    [-hw, -hh],
    [hw, -hh],
    [hw, hh],
    [-hw, hh],
  ].map(([x, y]) => ({
    x: cx + x * cos - y * sin,
    y: cy + x * sin + y * cos,
  }));
}

export function computeCanvaMergeGeometry(layers: CanvaLayer[]) {
  const base = layers[0];
  const baseW = imageWidth(base.img) || base.w || 1;
  const baseH = imageHeight(base.img) || base.h || 1;
  const scaleX = baseW / (base.w || 1);
  const scaleY = baseH / (base.h || 1);

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const layer of layers) {
    for (const corner of layerCorners(layer)) {
      const x = (corner.x - base.x) * scaleX;
      const y = (corner.y - base.y) * scaleY;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  const left = Math.floor(minX);
  const top = Math.floor(minY);
  const right = Math.ceil(maxX);
  const bottom = Math.ceil(maxY);

  return {
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top),
    scaleX,
    scaleY,
    offsetX: -left,
    offsetY: -top,
  };
}
