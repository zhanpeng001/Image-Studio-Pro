// @ts-nocheck
import { S } from '../state.js';
import { oc, octx, mc } from '../dom.js';
import { pushHistory } from '../history.js';
import { toast } from '../ui.js';
import { computeCanvaMergeGeometry } from './canva-geometry.js';

let cleanupEvents: (() => void) | null = null;

// ==================== HELPERS ====================
function drawCheckerboardOnMc(w: number, h: number) {
  const ctx2 = mc.getContext('2d')!;
  const size = 16;
  for (let y = 0; y < h; y += size) {
    for (let x = 0; x < w; x += size) {
      ctx2.fillStyle = ((Math.floor(x / size) + Math.floor(y / size)) % 2 === 0) ? '#eee' : '#fff';
      ctx2.fillRect(x, y, size, size);
    }
  }
}

// ==================== PANEL ====================
export function renderCanvaPanel(p) {
  const c = S.canva;

  const canvasAreaEl = document.getElementById('canvasArea')!;
  const viewW = canvasAreaEl.clientWidth;
  const viewH = canvasAreaEl.clientHeight;

  // Init workspace on first entry
  if (c.workspaceW === 0 || c.workspaceH === 0) {
    const wsW = Math.max(viewW * 3, 4000);
    const wsH = Math.max(viewH * 3, 3000);
    c.workspaceW = wsW;
    c.workspaceH = wsH;
    c.zoom = 1;

    mc.width = wsW; mc.height = wsH;
    oc.width = wsW; oc.height = wsH;
    mc.style.width = wsW + 'px'; mc.style.height = wsH + 'px';
    oc.style.width = wsW + 'px'; oc.style.height = wsH + 'px';

    drawCheckerboardOnMc(wsW, wsH);

    canvasAreaEl.style.overflow = 'auto';
    canvasAreaEl.style.alignItems = 'flex-start';
    canvasAreaEl.style.justifyContent = 'flex-start';

    canvasAreaEl.scrollLeft = Math.round((wsW - viewW) / 2);
    canvasAreaEl.scrollTop = Math.round((wsH - viewH) / 2);
  }

  // Create layer 0 from base image if no layers yet
  if (c.layers.length === 0 && S.img) {
    const wsW = c.workspaceW, wsH = c.workspaceH;
    const scale = Math.min(0.5, wsW * 0.4 / S.img.width, wsH * 0.4 / S.img.height);
    const w = Math.round(S.img.width * scale);
    const h = Math.round(S.img.height * scale);
    const x = Math.round((wsW - w) / 2);
    const y = Math.round((wsH - h) / 2);
    c.layers = [createLayer(S.img, x, y, w, h)];
    c.selectedIdx = 0;
  }
  // Undo/redo may have replaced S.img — keep layers in sync
  if (c.layers.length > 0 && c.layers[0].img !== S.img && S.img) {
    const oldLayers = c.layers;
    const wsW = c.workspaceW, wsH = c.workspaceH;
    const scale = Math.min(0.5, wsW * 0.4 / S.img.width, wsH * 0.4 / S.img.height);
    const w = Math.round(S.img.width * scale);
    const h = Math.round(S.img.height * scale);
    const x = Math.round((wsW - w) / 2);
    const y = Math.round((wsH - h) / 2);
    c.layers = [createLayer(S.img, x, y, w, h)];
    for (let i = 1; i < oldLayers.length; i++) {
      c.layers.push(oldLayers[i]);
    }
    if (c.selectedIdx >= c.layers.length) c.selectedIdx = c.layers.length - 1;
  }

  const sel = c.selectedIdx >= 0 ? c.layers[c.selectedIdx] : null;

  let html = '';

  // Zoom controls (scroll wheel to zoom, slider for fine adjustment)
  html += '<div class="row" style="align-items:center;gap:6px;margin-bottom:8px;">';
  html += '<input type="range" id="canvaZoom" min="25" max="400" value="' + Math.round(c.zoom * 100) + '" style="flex:1;">';
  html += '<span class="val" id="canvaZoomVal" style="min-width:42px;text-align:center;">' + Math.round(c.zoom * 100) + '%</span>';
  html += '<button class="btn" id="canvaZoomFit" title="Fit to screen" style="padding:4px 6px;font-size:11px;">Fit</button>';
  html += '</div>';
  html += '<p class="hint" style="margin-top:-4px;">Scroll wheel to zoom, drag to pan</p>';

  html += '<h3>Canva — Layers</h3>';

  // Layer list
  html += '<div class="layer-list" id="canvaLayerList" style="display:flex;flex-direction:column;gap:2px;margin-bottom:8px;max-height:160px;overflow-y:auto;">';
  for (let i = 0; i < c.layers.length; i++) {
    const l = c.layers[i];
    const active = i === c.selectedIdx ? ' active' : '';
    const name = i === 0 ? 'Background' : `Layer ${i}`;
    html += `<div class="layer-row${active}" data-idx="${i}" style="padding:4px 8px;cursor:pointer;border-radius:4px;font-size:12px;display:flex;justify-content:space-between;${active ? 'background:var(--accent);color:#fff;' : 'background:var(--bg2);'}">`;
    html += `<span>${name}</span>`;
    html += `<span style="opacity:0.6;">${Math.round(l.w)}x${Math.round(l.h)} ${l.angle !== 0 ? l.angle + '°' : ''}</span>`;
    html += '</div>';
  }
  html += '</div>';

  // Selected layer controls
  html += '<div id="canvaSelControls" style="display:' + (sel ? 'flex' : 'none') + ';flex-direction:column;gap:8px;">';

  html += '<div class="col"><label>Opacity: <span class="val" id="canvaOpacityVal">' + (sel ? Math.round(sel.opacity * 100) + '%' : '100%') + '</span></label>';
  html += '<input type="range" id="canvaOpacity" min="5" max="100" value="' + (sel ? Math.round(sel.opacity * 100) : 100) + '"></div>';

  html += '<div class="col"><label>Rotation: <span class="val" id="canvaAngleVal">' + (sel ? sel.angle + '°' : '0°') + '</span></label>';
  html += '<input type="range" id="canvaAngle" min="-180" max="180" value="' + (sel ? sel.angle : 0) + '"></div>';

  html += '<label><input type="checkbox" id="canvaLockRatio"' + (sel && sel.ratioLocked ? ' checked' : '') + '> Lock aspect ratio</label>';

  html += '</div>'; // end selControls

  // Buttons
  html += '<div style="margin-top:8px;display:flex;flex-direction:column;gap:6px;">';
  html += '<button class="btn primary btn-block" id="canvaAddLayer">Add Layer</button>';
  html += '<button class="btn btn-block" id="canvaRemoveLayer"' + (c.selectedIdx <= 0 ? ' disabled' : '') + '>Remove Layer</button>';
  html += '<div class="row" style="gap:4px;">';
  html += '<button class="btn btn-block" id="canvaSendBackward" title="Send backward"' + (c.selectedIdx <= 0 ? ' disabled' : '') + '>Back</button>';
  html += '<button class="btn btn-block" id="canvaBringForward" title="Bring forward"' + (c.selectedIdx < 0 || c.selectedIdx >= c.layers.length - 1 ? ' disabled' : '') + '>Forward</button>';
  html += '</div>';
  html += '<div class="divider"></div>';
  html += '<button class="btn btn-block" id="canvaMergeAll" style="background:var(--success);color:#fff;">Merge All & Flatten</button>';
  html += '</div>';

  html += '<p class="hint" style="margin-top:8px;">Click to select. Drag to move. Corner/edge handles to resize. Top handle to rotate. Double-click or Enter to merge.</p>';

  p.innerHTML = html;

  // Wire events
  const layerList = document.getElementById('canvaLayerList');
  if (layerList) {
    layerList.onclick = (e) => {
      const row = e.target.closest('.layer-row');
      if (!row) return;
      c.selectedIdx = +row.dataset.idx;
      drawCanvaAll();
      renderCanvaPanel(p);
    };
  }

  const opacitySlider = document.getElementById('canvaOpacity');
  if (opacitySlider && sel) {
    opacitySlider.oninput = () => {
      sel.opacity = +opacitySlider.value / 100;
      const valEl = document.getElementById('canvaOpacityVal');
      if (valEl) valEl.textContent = Math.round(sel.opacity * 100) + '%';
      drawCanvaAll();
    };
  }

  const angleSlider = document.getElementById('canvaAngle');
  if (angleSlider && sel) {
    angleSlider.oninput = () => {
      sel.angle = +angleSlider.value;
      const valEl = document.getElementById('canvaAngleVal');
      if (valEl) valEl.textContent = sel.angle + '°';
      drawCanvaAll();
    };
  }

  const lockChk = document.getElementById('canvaLockRatio');
  if (lockChk && sel) {
    lockChk.onchange = () => {
      sel.ratioLocked = lockChk.checked;
      if (sel.ratioLocked && sel.w > 0) sel.ratio = sel.w / sel.h;
    };
  }

  const addBtn = document.getElementById('canvaAddLayer');
  if (addBtn) addBtn.onclick = () => openLayerFilePicker();

  const removeBtn = document.getElementById('canvaRemoveLayer');
  if (removeBtn) {
    removeBtn.onclick = () => {
      if (c.selectedIdx <= 0) return;
      c.layers.splice(c.selectedIdx, 1);
      c.selectedIdx = Math.min(c.selectedIdx, c.layers.length - 1);
      drawCanvaAll();
      renderCanvaPanel(p);
      toast('Layer removed');
    };
  }

  const backBtn = document.getElementById('canvaSendBackward');
  if (backBtn) {
    backBtn.onclick = () => {
      if (c.selectedIdx <= 0) return;
      [c.layers[c.selectedIdx], c.layers[c.selectedIdx - 1]] = [c.layers[c.selectedIdx - 1], c.layers[c.selectedIdx]];
      c.selectedIdx--;
      drawCanvaAll();
      renderCanvaPanel(p);
    };
  }

  const fwdBtn = document.getElementById('canvaBringForward');
  if (fwdBtn) {
    fwdBtn.onclick = () => {
      if (c.selectedIdx < 0 || c.selectedIdx >= c.layers.length - 1) return;
      [c.layers[c.selectedIdx], c.layers[c.selectedIdx + 1]] = [c.layers[c.selectedIdx + 1], c.layers[c.selectedIdx]];
      c.selectedIdx++;
      drawCanvaAll();
      renderCanvaPanel(p);
    };
  }

  const mergeBtn = document.getElementById('canvaMergeAll');
  if (mergeBtn) mergeBtn.onclick = mergeAllLayers;

  // Zoom controls
  const zoomSlider = document.getElementById('canvaZoom');
  const zoomVal = document.getElementById('canvaZoomVal');
  if (zoomSlider && zoomVal) {
    zoomSlider.oninput = () => {
      const z = +zoomSlider.value / 100;
      const canvasArea = document.getElementById('canvasArea')!;
      const vcx = canvasArea.scrollLeft + canvasArea.clientWidth / 2;
      const vcy = canvasArea.scrollTop + canvasArea.clientHeight / 2;
      applyCanvaZoom(z, { ax: vcx, ay: vcy });
      zoomVal.textContent = Math.round(z * 100) + '%';
    };
  }
  const zoomFitBtn = document.getElementById('canvaZoomFit');
  if (zoomFitBtn) {
    zoomFitBtn.onclick = () => {
      zoomSlider.value = 100;
      const canvasArea = document.getElementById('canvasArea')!;
      const vcx = canvasArea.scrollLeft + canvasArea.clientWidth / 2;
      const vcy = canvasArea.scrollTop + canvasArea.clientHeight / 2;
      applyCanvaZoom(1, { ax: vcx, ay: vcy });
      if (zoomVal) zoomVal.textContent = '100%';
    };
  }

  setupCanvaEvents();
  drawCanvaAll();

  // Sync text overlay
  const sel = c.selectedIdx >= 0 ? c.layers[c.selectedIdx] : null;
  if (sel && sel.type === 'text') {
    showTextOverlay();
    if (!sel.text && !textOverlayEditing) {
      enterTextEdit();
    }
  } else {
    hideTextOverlay();
  }
}

function openLayerFilePicker() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.style.display = 'none';
  document.body.appendChild(input);
  input.addEventListener('change', e => {
    const f = e.target.files[0];
    if (f) loadOverlayLayer(f);
    input.remove();
  });
  input.click();
}

// ==================== LAYER HELPERS ====================
function createLayer(img, x, y, w, h): any {
  return { img, x, y, w, h, angle: 0, opacity: 1, ratioLocked: false, ratio: w / h, type: 'image', text: '', fontSize: 24, fontColor: '#ffffff' };
}

function createTextLayer(x: number, y: number, w: number, h: number): any {
  return { img: null, x, y, w, h, angle: 0, opacity: 1, ratioLocked: false, ratio: w / h, type: 'text', text: '', fontSize: 24, fontColor: '#ffffff' };
}

// ==================== TEXT OVERLAY ====================
let textOverlay: HTMLDivElement | null = null;
let textOverlayEditing = false;

function getTextOverlay(): HTMLDivElement {
  if (!textOverlay) {
    textOverlay = document.createElement('div');
    textOverlay.id = 'canvaTextOverlay';
    textOverlay.contentEditable = 'false';
    textOverlay.style.cssText = 'position:absolute;display:none;z-index:10;pointer-events:none;outline:none;overflow:hidden;word-wrap:break-word;white-space:pre-wrap;font-family:sans-serif;line-height:1.3;border:2px dashed #58a6ff;border-radius:2px;background:transparent;';
    const canvasAreaEl = document.getElementById('canvasArea')!;
    canvasAreaEl.style.position = canvasAreaEl.style.position || 'relative';
    canvasAreaEl.appendChild(textOverlay);

    textOverlay.addEventListener('input', () => {
      const c = S.canva;
      if (c.selectedIdx >= 0) {
        const sel = c.layers[c.selectedIdx];
        if (sel.type === 'text') {
          sel.text = textOverlay!.textContent || '';
        }
      }
    });

    textOverlay.addEventListener('blur', () => {
      exitTextEdit();
    });
  }
  return textOverlay;
}

function showTextOverlay() {
  const overlay = getTextOverlay();
  const c = S.canva;
  if (c.selectedIdx < 0) { overlay.style.display = 'none'; return; }
  const sel = c.layers[c.selectedIdx];
  if (sel.type !== 'text') { overlay.style.display = 'none'; return; }

  const canvasAreaEl = document.getElementById('canvasArea')!;
  const zoom = c.zoom;
  const left = sel.x * zoom - canvasAreaEl.scrollLeft;
  const top = sel.y * zoom - canvasAreaEl.scrollTop;
  const w = sel.w * zoom;
  const h = sel.h * zoom;

  overlay.style.display = 'block';
  overlay.style.left = left + 'px';
  overlay.style.top = top + 'px';
  overlay.style.width = w + 'px';
  overlay.style.height = h + 'px';
  overlay.style.fontSize = (sel.fontSize * zoom) + 'px';
  overlay.style.color = sel.fontColor;
  overlay.style.padding = (4 * zoom) + 'px';
  overlay.style.borderWidth = (2 * zoom) + 'px';

  if (sel.angle !== 0) {
    overlay.style.transformOrigin = 'center center';
    overlay.style.transform = `rotate(${sel.angle}deg)`;
  } else {
    overlay.style.transform = '';
  }

  if (!textOverlayEditing) {
    overlay.textContent = sel.text || '';
    overlay.contentEditable = 'false';
    overlay.style.pointerEvents = 'none';
  }
}

function enterTextEdit() {
  const overlay = getTextOverlay();
  const c = S.canva;
  if (c.selectedIdx < 0) return;
  const sel = c.layers[c.selectedIdx];
  if (sel.type !== 'text') return;

  textOverlayEditing = true;
  overlay.contentEditable = 'true';
  overlay.style.pointerEvents = 'auto';
  overlay.textContent = sel.text || '';
  overlay.focus();

  if (!sel.text) {
    const range = document.createRange();
    range.selectNodeContents(overlay);
    const sel2 = window.getSelection();
    sel2?.removeAllRanges();
    sel2?.addRange(range);
  }
}

function exitTextEdit() {
  const overlay = getTextOverlay();
  textOverlayEditing = false;
  overlay.contentEditable = 'false';
  overlay.style.pointerEvents = 'none';
}

function hideTextOverlay() {
  if (textOverlay) {
    textOverlay.style.display = 'none';
  }
  textOverlayEditing = false;
}

function loadOverlayLayer(file) {
  if (!file.type.startsWith('image/')) { toast('Not an image file'); return; }
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      const c = S.canva;
      const canvasArea = document.getElementById('canvasArea')!;
      // Convert viewport center from canvas pixels to workspace coordinates
      const viewCX = (canvasArea.scrollLeft + canvasArea.clientWidth / 2) / c.zoom;
      const viewCY = (canvasArea.scrollTop + canvasArea.clientHeight / 2) / c.zoom;
      // Scale to a reasonable size relative to workspace
      const scale = Math.min(0.3, c.workspaceW * 0.2 / img.width, c.workspaceH * 0.2 / img.height);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const x = Math.round(viewCX - w / 2);
      const y = Math.round(viewCY - h / 2);
      const layer = createLayer(img, x, y, w, h);
      c.layers.push(layer);
      c.selectedIdx = c.layers.length - 1;
      drawCanvaAll();
      const panel = document.getElementById('panel');
      if (panel) renderCanvaPanel(panel);
      toast('Layer added — drag to position');
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// ==================== EVENTS ====================
function setupCanvaEvents() {
  cleanupCanvaEvents();
  oc.style.cursor = 'default';

  const onDown = (e) => canvaDown(e);
  const onMove = (e) => canvaMove(e);
  const onUp = () => canvaUp();
  const onWheel = (e) => {
    e.preventDefault();
    const c = S.canva;
    const rect = oc.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const step = e.deltaY < 0 ? 1.1 : 0.9;
    const newZoom = Math.max(0.25, Math.min(4, c.zoom * step));
    applyCanvaZoom(newZoom, { ax: mx, ay: my });
    const slider = document.getElementById('canvaZoom');
    const val = document.getElementById('canvaZoomVal');
    if (slider) slider.value = Math.round(newZoom * 100);
    if (val) val.textContent = Math.round(newZoom * 100) + '%';
  };

  oc.addEventListener('mousedown', onDown);
  oc.addEventListener('mousemove', onMove);
  oc.addEventListener('mouseup', onUp);
  oc.addEventListener('mouseleave', onUp);
  oc.addEventListener('wheel', onWheel, { passive: false });

  cleanupEvents = () => {
    oc.removeEventListener('mousedown', onDown);
    oc.removeEventListener('mousemove', onMove);
    oc.removeEventListener('mouseup', onUp);
    oc.removeEventListener('mouseleave', onUp);
    oc.removeEventListener('wheel', onWheel);
    S.canva.dragging = false;
    S.canva.moving = false;
    S.canva.panning = false;
  };
}

export function cleanupCanvaEvents() {
  if (cleanupEvents) { cleanupEvents(); cleanupEvents = null; }
}

function applyCanvaZoom(newZoom, anchor?: { ax: number; ay: number }) {
  const c = S.canva;
  const oldZoom = c.zoom;
  if (oldZoom === newZoom || c.workspaceW === 0) return;
  c.zoom = newZoom;

  const canvasArea = document.getElementById('canvasArea')!;

  // Anchor is in canvas pixels from the wheel event. Convert to workspace coords.
  const ax = (anchor ? anchor.ax : oc.width / 2) / oldZoom;
  const ay = (anchor ? anchor.ay : oc.height / 2) / oldZoom;

  // Where the anchor appears on screen (relative to canvasArea)
  const areaRect = canvasArea.getBoundingClientRect();
  const viewX = ax * oldZoom - canvasArea.scrollLeft;
  const viewY = ay * oldZoom - canvasArea.scrollTop;

  const newW = Math.round(c.workspaceW * newZoom);
  const newH = Math.round(c.workspaceH * newZoom);

  // New scroll: keep the workspace anchor point at the same screen position
  const newScrollLeft = Math.round(ax * newZoom - viewX);
  const newScrollTop = Math.round(ay * newZoom - viewY);

  // Resize both canvases
  mc.width = newW; mc.height = newH;
  oc.width = newW; oc.height = newH;
  mc.style.width = newW + 'px'; mc.style.height = newH + 'px';
  oc.style.width = newW + 'px'; oc.style.height = newH + 'px';

  // Apply scroll
  canvasArea.scrollLeft = Math.max(0, newScrollLeft);
  canvasArea.scrollTop = Math.max(0, newScrollTop);

  // Redraw checkerboard on mc
  drawCheckerboardOnMc(newW, newH);

  // Update zoom indicator
  const zi = document.getElementById('zoomIndicator');
  if (zi) zi.textContent = Math.round(newZoom * 100) + '%';

  drawCanvaAll();
}

// ==================== MATH HELPERS ====================
function worldToLocal(mx, my, cx, cy, angleDeg) {
  const rad = -angleDeg * Math.PI / 180;
  const dx = mx - cx;
  const dy = my - cy;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return { lx: dx * cos - dy * sin, ly: dx * sin + dy * cos };
}

function hitTestHandle(mx, my, hx, hy, threshold) {
  return Math.abs(mx - hx) < threshold && Math.abs(my - hy) < threshold;
}

function getLayerCenter(layer) {
  return { cx: layer.x + layer.w / 2, cy: layer.y + layer.h / 2 };
}

function computeHandlePositions(layer) {
  const { cx, cy } = getLayerCenter(layer);
  const a = layer.angle * Math.PI / 180;
  const cos = Math.cos(a), sin = Math.sin(a);
  const hw = layer.w / 2, hh = layer.h / 2;
  const rotDist = 30;

  const local = {
    tl: [-hw, -hh], tr: [hw, -hh], bl: [-hw, hh], br: [hw, hh],
    n: [0, -hh], s: [0, hh], w: [-hw, 0], e: [hw, 0],
    rot: [0, -hh - rotDist],
  };

  const result: any = {};
  for (const [key, [lx, ly]] of Object.entries(local)) {
    result[key] = {
      wx: cx + lx * cos - ly * sin,
      wy: cy + lx * sin + ly * cos,
    };
  }
  return result;
}

// ==================== DRAWING ====================
function drawCanvaAll() {
  octx.clearRect(0, 0, oc.width, oc.height);
  const c = S.canva;
  if (c.layers.length === 0) return;
  const zoom = c.zoom;

  // Draw layers (layer coords are workspace units, multiply by zoom for canvas pixels)
  for (const layer of c.layers) {
    const cx = (layer.x + layer.w / 2) * zoom;
    const cy = (layer.y + layer.h / 2) * zoom;
    const w = layer.w * zoom;
    const h = layer.h * zoom;
    octx.save();
    octx.translate(cx, cy);
    octx.rotate(layer.angle * Math.PI / 180);
    octx.globalAlpha = layer.opacity;
    octx.drawImage(layer.img, -w / 2, -h / 2, w, h);
    octx.restore();
  }

  // Draw selection UI for selected layer
  if (c.selectedIdx >= 0 && c.selectedIdx < c.layers.length) {
    drawSelectionUI(c.layers[c.selectedIdx]);
  }

  // Re-sync overlay position after redraw (zoom/scroll may have changed)
  if (c.selectedIdx >= 0 && c.layers[c.selectedIdx]?.type === 'text') {
    showTextOverlay();
  }
}

function drawSelectionUI(layer) {
  const zoom = S.canva.zoom;
  const cx = (layer.x + layer.w / 2) * zoom;
  const cy = (layer.y + layer.h / 2) * zoom;
  const w = layer.w * zoom;
  const h = layer.h * zoom;
  const hraw = computeHandlePositions(layer);
  // Scale handle positions to canvas pixels
  const hs: any = {};
  for (const k of Object.keys(hraw)) {
    hs[k] = { wx: hraw[k].wx * zoom, wy: hraw[k].wy * zoom };
  }
  const a = layer.angle * Math.PI / 180;

  // Dashed border
  octx.save();
  octx.translate(cx, cy);
  octx.rotate(a);
  octx.strokeStyle = '#58a6ff';
  octx.lineWidth = 2;
  octx.setLineDash([6, 3]);
  octx.strokeRect(-w / 2, -h / 2, w, h);
  octx.setLineDash([]);
  octx.restore();

  // Corner handles (fixed screen-pixel size)
  octx.fillStyle = '#fff'; octx.strokeStyle = '#58a6ff'; octx.lineWidth = 1.5;
  ['tl', 'tr', 'bl', 'br'].forEach(k => {
    const p = hs[k];
    octx.fillRect(p.wx - 4, p.wy - 4, 8, 8);
    octx.strokeRect(p.wx - 4, p.wy - 4, 8, 8);
  });

  // Edge handles
  octx.fillStyle = 'rgba(255,255,255,0.6)'; octx.strokeStyle = 'rgba(88,166,255,0.6)'; octx.lineWidth = 1;
  ['n', 's', 'w', 'e'].forEach(k => {
    const p = hs[k];
    octx.fillRect(p.wx - 3, p.wy - 3, 6, 6);
    octx.strokeRect(p.wx - 3, p.wy - 3, 6, 6);
  });

  // Rotation handle
  const rp = hs.rot;
  octx.strokeStyle = '#58a6ff'; octx.lineWidth = 2;
  octx.beginPath();
  octx.moveTo(hs.n.wx, hs.n.wy);
  octx.lineTo(rp.wx, rp.wy);
  octx.stroke();
  octx.fillStyle = '#58a6ff'; octx.strokeStyle = '#fff'; octx.lineWidth = 1.5;
  octx.beginPath();
  octx.arc(rp.wx, rp.wy, 6, 0, Math.PI * 2);
  octx.fill();
  octx.stroke();
}

// ==================== INTERACTION ====================
function getPos(e) {
  const rect = oc.getBoundingClientRect();
  const zoom = S.canva.zoom;
  const rawX = e.clientX - rect.left;
  const rawY = e.clientY - rect.top;
  return {
    mx: rawX / zoom,
    my: rawY / zoom,
  };
}

function isInsideLayer(mx, my, layer) {
  const { cx, cy } = getLayerCenter(layer);
  const { lx, ly } = worldToLocal(mx, my, cx, cy, layer.angle);
  return lx >= -layer.w / 2 && lx <= layer.w / 2 && ly >= -layer.h / 2 && ly <= layer.h / 2;
}

function canvaDown(e) {
  const c = S.canva;
  if (c.layers.length === 0) return;
  const { mx, my } = getPos(e);
  const zoom = c.zoom;

  // Hit test thresholds in workspace coords (screen px / zoom)
  const cornerThresh = 10 / zoom;
  const edgeThresh = 8 / zoom;

  // First, check if clicking on a handle of the selected layer
  if (c.selectedIdx >= 0) {
    const sel = c.layers[c.selectedIdx];
    const h = computeHandlePositions(sel);

    // Check rotation handle first (highest priority)
    if (hitTestHandle(mx, my, h.rot.wx, h.rot.wy, cornerThresh)) {
      c.dragging = true;
      c.dragCorner = 'rot';
      const { cx, cy } = getLayerCenter(sel);
      c.rotateOrigAngle = sel.angle;
      c.rotateStartAngle = Math.atan2(my - cy, mx - cx) * 180 / Math.PI;
      return;
    }

    // Check corner handles
    for (const k of ['tl', 'tr', 'bl', 'br']) {
      if (hitTestHandle(mx, my, h[k].wx, h[k].wy, cornerThresh)) {
        c.dragging = true;
        c.dragCorner = k;
        c.resizeOrigX = sel.x; c.resizeOrigY = sel.y;
        c.resizeOrigW = sel.w; c.resizeOrigH = sel.h;
        c.resizeOrigAngle = sel.angle;
        return;
      }
    }

    // Check edge handles
    for (const k of ['n', 's', 'w', 'e']) {
      if (hitTestHandle(mx, my, h[k].wx, h[k].wy, edgeThresh)) {
        c.dragging = true;
        c.dragCorner = k;
        c.resizeOrigX = sel.x; c.resizeOrigY = sel.y;
        c.resizeOrigW = sel.w; c.resizeOrigH = sel.h;
        c.resizeOrigAngle = sel.angle;
        return;
      }
    }

    // Check if inside selected layer (move)
    if (isInsideLayer(mx, my, sel)) {
      c.moving = true;
      c.moveStartX = mx; c.moveStartY = my;
      c.moveOrigX = sel.x; c.moveOrigY = sel.y;
      oc.style.cursor = 'move';
      return;
    }
  }

  // Click on an unselected layer (select it)
  for (let i = c.layers.length - 1; i >= 0; i--) {
    if (isInsideLayer(mx, my, c.layers[i])) {
      c.selectedIdx = i;
      drawCanvaAll();
      const panel = document.getElementById('panel');
      if (panel) renderCanvaPanel(panel);
      // Start move on the newly selected layer
      c.moving = true;
      c.moveStartX = mx; c.moveStartY = my;
      c.moveOrigX = c.layers[i].x; c.moveOrigY = c.layers[i].y;
      oc.style.cursor = 'move';
      return;
    }
  }

  // Clicked empty space — start panning
  c.panning = true;
  c.moveStartX = e.clientX;
  c.moveStartY = e.clientY;
  const canvasAreaEl2 = document.getElementById('canvasArea')!;
  c.moveOrigX = canvasAreaEl2.scrollLeft;
  c.moveOrigY = canvasAreaEl2.scrollTop;
  oc.style.cursor = 'grabbing';
}

function canvaMove(e) {
  const c = S.canva;
  const { mx, my } = getPos(e);

  // Panning
  if (c.panning) {
    const dx = e.clientX - c.moveStartX;
    const dy = e.clientY - c.moveStartY;
    const canvasArea = document.getElementById('canvasArea')!;
    canvasArea.scrollLeft = c.moveOrigX - dx;
    canvasArea.scrollTop = c.moveOrigY - dy;
    return;
  }

  if (c.layers.length === 0) return;

  // Hover cursors when no drag
  if (!c.dragging && !c.moving) {
    updateHoverCursor(mx, my);
  }

  // Moving
  if (c.moving && c.selectedIdx >= 0) {
    const sel = c.layers[c.selectedIdx];
    const dx = mx - c.moveStartX, dy = my - c.moveStartY;
    sel.x = c.moveOrigX + dx;
    sel.y = c.moveOrigY + dy;
    drawCanvaAll();
    return;
  }

  // Resizing
  if (c.dragging && c.dragCorner !== 'rot' && c.selectedIdx >= 0) {
    handleRotatedResize(mx, my, c.layers[c.selectedIdx]);
    drawCanvaAll();
    return;
  }

  // Rotating
  if (c.dragging && c.dragCorner === 'rot' && c.selectedIdx >= 0) {
    const sel = c.layers[c.selectedIdx];
    const { cx, cy } = getLayerCenter(sel);
    const currentAngle = Math.atan2(my - cy, mx - cx) * 180 / Math.PI;
    let newAngle = c.rotateOrigAngle + (currentAngle - c.rotateStartAngle);
    if (e.shiftKey) newAngle = Math.round(newAngle / 5) * 5;
    sel.angle = Math.round(newAngle);
    drawCanvaAll();
    return;
  }
}

function updateHoverCursor(mx, my) {
  const c = S.canva;
  const zoom = c.zoom;
  oc.style.cursor = 'default';

  // Hit test thresholds in workspace coords
  const cornerThresh = 10 / zoom;
  const edgeThresh = 8 / zoom;

  if (c.selectedIdx >= 0) {
    const sel = c.layers[c.selectedIdx];
    const h = computeHandlePositions(sel);

    if (hitTestHandle(mx, my, h.rot.wx, h.rot.wy, cornerThresh)) {
      oc.style.cursor = 'grab';
      return;
    }

    // Corners — diagonal resize cursors
    const tl = h.tl, tr = h.tr, bl = h.bl, br = h.br;
    if (hitTestHandle(mx, my, tl.wx, tl.wy, cornerThresh)) { oc.style.cursor = 'nwse-resize'; return; }
    if (hitTestHandle(mx, my, br.wx, br.wy, cornerThresh)) { oc.style.cursor = 'nwse-resize'; return; }
    if (hitTestHandle(mx, my, tr.wx, tr.wy, cornerThresh)) { oc.style.cursor = 'nesw-resize'; return; }
    if (hitTestHandle(mx, my, bl.wx, bl.wy, cornerThresh)) { oc.style.cursor = 'nesw-resize'; return; }

    // Edges
    if (hitTestHandle(mx, my, h.n.wx, h.n.wy, edgeThresh)) { oc.style.cursor = 'ns-resize'; return; }
    if (hitTestHandle(mx, my, h.s.wx, h.s.wy, edgeThresh)) { oc.style.cursor = 'ns-resize'; return; }
    if (hitTestHandle(mx, my, h.w.wx, h.w.wy, edgeThresh)) { oc.style.cursor = 'ew-resize'; return; }
    if (hitTestHandle(mx, my, h.e.wx, h.e.wy, edgeThresh)) { oc.style.cursor = 'ew-resize'; return; }

    if (isInsideLayer(mx, my, sel)) {
      oc.style.cursor = 'move';
      return;
    }
  }

  // Hover over unselected layer
  for (let i = c.layers.length - 1; i >= 0; i--) {
    if (i === c.selectedIdx) continue;
    if (isInsideLayer(mx, my, c.layers[i])) {
      oc.style.cursor = 'pointer';
      return;
    }
  }
}

function handleRotatedResize(mx, my, layer) {
  const c = S.canva;
  const anchorAngle = c.resizeOrigAngle;
  const origCx = c.resizeOrigX + c.resizeOrigW / 2;
  const origCy = c.resizeOrigY + c.resizeOrigH / 2;

  // Transform mouse into anchor's local space
  const { lx, ly } = worldToLocal(mx, my, origCx, origCy, anchorAngle);

  let left = -c.resizeOrigW / 2, right = c.resizeOrigW / 2;
  let top = -c.resizeOrigH / 2, bottom = c.resizeOrigH / 2;

  switch (c.dragCorner) {
    case 'tl': left = Math.min(lx, right - 10); top = Math.min(ly, bottom - 10); break;
    case 'tr': right = Math.max(lx, left + 10); top = Math.min(ly, bottom - 10); break;
    case 'bl': left = Math.min(lx, right - 10); bottom = Math.max(ly, top + 10); break;
    case 'br': right = Math.max(lx, left + 10); bottom = Math.max(ly, top + 10); break;
    case 'n': top = Math.min(ly, bottom - 10); break;
    case 's': bottom = Math.max(ly, top + 10); break;
    case 'w': left = Math.min(lx, right - 10); break;
    case 'e': right = Math.max(lx, left + 10); break;
  }

  // Enforce aspect ratio lock
  if (layer.ratioLocked && layer.ratio > 0) {
    const ratio = layer.ratio;
    if (c.dragCorner === 'n' || c.dragCorner === 's') {
      right = left + (bottom - top) * ratio;
    } else if (c.dragCorner === 'w' || c.dragCorner === 'e') {
      bottom = top + (right - left) / ratio;
    } else {
      // For corners, use dominant axis
      const dw = Math.abs(right - left - c.resizeOrigW);
      const dh = Math.abs(bottom - top - c.resizeOrigH);
      if (dw >= dh) { bottom = top + (right - left) / ratio; }
      else { right = left + (bottom - top) * ratio; }
    }
  }

  const newW = right - left;
  const newH = bottom - top;
  const localNewCx = (left + right) / 2;
  const localNewCy = (top + bottom) / 2;

  // Convert local center offset back to world
  const aRad = anchorAngle * Math.PI / 180;
  const cos = Math.cos(aRad), sin = Math.sin(aRad);
  const worldDx = localNewCx * cos - localNewCy * sin;
  const worldDy = localNewCx * sin + localNewCy * cos;

  layer.w = newW;
  layer.h = newH;
  layer.x = origCx + worldDx - newW / 2;
  layer.y = origCy + worldDy - newH / 2;
}

// Keyboard action exports for main.ts
export function canvaMergeAll() { mergeAllLayers(); }

export function canvaDeselect() {
  const c = S.canva;
  if (c.selectedIdx >= 0) {
    c.selectedIdx = -1;
    drawCanvaAll();
    const panel = document.getElementById('panel');
    if (panel) renderCanvaPanel(panel);
  }
}

export function canvaRemoveLayer() {
  const c = S.canva;
  if (c.selectedIdx > 0) {
    c.layers.splice(c.selectedIdx, 1);
    c.selectedIdx = Math.min(c.selectedIdx, c.layers.length - 1);
    drawCanvaAll();
    const panel = document.getElementById('panel');
    if (panel) renderCanvaPanel(panel);
    toast('Layer removed');
  }
}

// Called by topbar Fit/1:1 buttons — route through canva zoom system
export function canvaFitZoom() {
  const c = S.canva;
  if (c.workspaceW === 0 || c.workspaceH === 0) return;
  applyCanvaZoom(1);
  const slider = document.getElementById('canvaZoom');
  const val = document.getElementById('canvaZoomVal');
  if (slider) slider.value = '100';
  if (val) val.textContent = '100%';
}

export function canvaHandleResize() {
  const c = S.canva;
  if (c.workspaceW === 0 || c.workspaceH === 0) {
    // Workspace not initialized yet, nothing to do
    drawCanvaAll();
    return;
  }
  // Viewport changed but workspace stays the same — just redraw
  // Re-apply zoom to rescale canvases to new viewport-relative fit
  if (c.zoom === 1) {
    // At zoom 1, resize canvases to workspace
    mc.width = c.workspaceW; mc.height = c.workspaceH;
    oc.width = c.workspaceW; oc.height = c.workspaceH;
    mc.style.width = c.workspaceW + 'px'; mc.style.height = c.workspaceH + 'px';
    oc.style.width = c.workspaceW + 'px'; oc.style.height = c.workspaceH + 'px';
    drawCheckerboardOnMc(c.workspaceW, c.workspaceH);
  }
  drawCanvaAll();
}

export function canvaActualZoom() {
  const c = S.canva;
  if (!S.img || c.workspaceW === 0 || c.layers.length === 0) return;
  // Zoom so that the base image layer appears at 1:1 (actual pixels)
  const base = c.layers[0];
  if (base.w === 0 || base.h === 0) return;
  const imgW = base.img.width;
  const displayW = base.w;
  const z = imgW / displayW;
  applyCanvaZoom(Math.max(0.25, Math.min(4, z)));
  const slider = document.getElementById('canvaZoom');
  const val = document.getElementById('canvaZoomVal');
  if (slider) slider.value = Math.round(z * 100);
  if (val) val.textContent = Math.round(z * 100) + '%';
}

function canvaUp() {
  const c = S.canva;
  if (c.panning) oc.style.cursor = 'default';
  c.dragging = false;
  c.moving = false;
  c.panning = false;
  c.dragCorner = null;
}

// ==================== MERGE ====================
async function mergeAllLayers() {
  const c = S.canva;
  if (c.layers.length === 0) { toast('No layers'); return; }

  pushHistory('Canva Merge');

  const base = c.layers[0];
  const merge = computeCanvaMergeGeometry(c.layers);
  const outW = merge.width;
  const outH = merge.height;
  const scaleX = merge.scaleX;
  const scaleY = merge.scaleY;

  const out = document.createElement('canvas');
  out.width = outW;
  out.height = outH;
  const outCtx = out.getContext('2d')!;
  if (!outCtx) { toast('Merge failed: no canvas context'); return; }

  // Fill with transparent background first
  outCtx.clearRect(0, 0, outW, outH);

  for (const layer of c.layers) {
    outCtx.save();
    const cx = (layer.x - base.x + layer.w / 2) * scaleX + merge.offsetX;
    const cy = (layer.y - base.y + layer.h / 2) * scaleY + merge.offsetY;
    outCtx.translate(cx, cy);
    outCtx.rotate(layer.angle * Math.PI / 180);
    outCtx.globalAlpha = layer.opacity;
    outCtx.drawImage(
      layer.img,
      -layer.w * scaleX / 2,
      -layer.h * scaleY / 2,
      layer.w * scaleX,
      layer.h * scaleY,
    );
    outCtx.restore();
  }

  // Load merged result as an image
  let nimg: HTMLImageElement;
  try {
    nimg = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Image decode failed'));
      img.src = out.toDataURL('image/png');
    });
  } catch (err) {
    toast('Merge failed: ' + (err as Error).message);
    return;
  }

  S.img = nimg;
  c.layers = [];
  c.selectedIdx = -1;
  c.workspaceW = 0;
  c.workspaceH = 0;
  c.dragging = false; c.moving = false; c.panning = false; c.dragCorner = null;
  const panel = document.getElementById('panel');
  if (panel) renderCanvaPanel(panel);
  toast('All layers merged');
}
