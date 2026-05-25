import { S } from './state.js';
import { oc, octx } from './dom.js';

export function clearOverlay() {
  octx.clearRect(0, 0, oc.width, oc.height);
  oc.style.cursor = 'default';
}

export interface Handle {
  x: number;
  y: number;
}

export function drawHandles(context: CanvasRenderingContext2D, handles: Handle[], size: number = 8): void {
  context.fillStyle = '#fff';
  context.strokeStyle = '#58a6ff';
  context.lineWidth = 1.5;
  for (const handle of handles) {
    context.fillRect(handle.x - size / 2, handle.y - size / 2, size, size);
    context.strokeRect(handle.x - size / 2, handle.y - size / 2, size, size);
  }
}

// ==================== CROP OVERLAY ====================
export function drawCropOverlay() {
  octx.clearRect(0, 0, oc.width, oc.height);
  const c = S.crop;
  if (c.w <= 0 || c.h <= 0) { oc.style.cursor = 'crosshair'; return; }

  // Dim outside
  octx.fillStyle = 'rgba(0,0,0,0.55)';
  octx.fillRect(0, 0, oc.width, oc.height);
  octx.clearRect(c.x, c.y, c.w, c.h);

  // Border
  octx.strokeStyle = '#58a6ff'; octx.lineWidth = 2;
  octx.setLineDash([6, 3]);
  octx.strokeRect(c.x, c.y, c.w, c.h);
  octx.setLineDash([]);

  // Corner handles
  drawHandles(octx, [
    { x: c.x, y: c.y },
    { x: c.x + c.w, y: c.y },
    { x: c.x, y: c.y + c.h },
    { x: c.x + c.w, y: c.y + c.h }
  ]);

  // Edge midpoints (for edge resize)
  octx.fillStyle = 'rgba(255,255,255,0.6)'; octx.strokeStyle = 'rgba(88,166,255,0.6)'; octx.lineWidth = 1;
  [
    [c.x + c.w/2, c.y],
    [c.x + c.w/2, c.y + c.h],
    [c.x, c.y + c.h/2],
    [c.x + c.w, c.y + c.h/2]
  ].forEach(([hx, hy]) => {
    octx.fillRect(hx - 3, hy - 3, 6, 6);
    octx.strokeRect(hx - 3, hy - 3, 6, 6);
  });

  // Rule of thirds
  const tw = c.w / 3, th = c.h / 3;
  octx.strokeStyle = 'rgba(255,255,255,0.15)'; octx.lineWidth = 1;
  [1, 2].forEach(i => {
    octx.beginPath(); octx.moveTo(c.x + tw * i, c.y); octx.lineTo(c.x + tw * i, c.y + c.h); octx.stroke();
    octx.beginPath(); octx.moveTo(c.x, c.y + th * i); octx.lineTo(c.x + c.w, c.y + th * i); octx.stroke();
  });

  oc.style.cursor = 'default';
}

// ==================== GRID OVERLAY ====================
export function drawGridOverlay() {
  octx.clearRect(0, 0, oc.width, oc.height);
  if (S.tool !== 'grid') return;
  const g = S.grid, w = oc.width, h = oc.height;
  octx.setLineDash([8, 4]); octx.lineWidth = 2; octx.strokeStyle = '#58a6ff';
  g.hLines.forEach(p => { const y = p * h; octx.beginPath(); octx.moveTo(0, y); octx.lineTo(w, y); octx.stroke(); });
  g.vLines.forEach(p => { const x = p * w; octx.beginPath(); octx.moveTo(x, 0); octx.lineTo(x, h); octx.stroke(); });
  octx.setLineDash([]); octx.fillStyle = '#58a6ff'; octx.strokeStyle = '#fff'; octx.lineWidth = 1.5;
  g.hLines.forEach(p => { const y = p * h; octx.fillRect(w / 2 - 20, y - 4, 40, 8); octx.strokeRect(w / 2 - 20, y - 4, 40, 8); });
  g.vLines.forEach(p => { const x = p * w; octx.fillRect(x - 4, h / 2 - 20, 8, 40); octx.strokeRect(x - 4, h / 2 - 20, 8, 40); });
  oc.style.cursor = 'crosshair';
}
