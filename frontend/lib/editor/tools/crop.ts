// @ts-nocheck
import { S } from '../state.js';
import { $, oc, octx, ctx } from '../dom.js';
import { fitImage, renderAll, renderCropExpand, restoreCropCanvas } from '../canvas.js';
import { pushHistory } from '../history.js';
import { drawCropOverlay } from '../overlay.js';
import { toast } from '../ui.js';
import { smartResize } from '../lanczos.js';

// ==================== PANEL ====================
export function renderCropPanel(p) {
  const customRatio = S.crop.aspect && !['1:1','4:3','16:9','3:2','2:3','9:16'].includes(S.crop.aspect) ? S.crop.aspect : null;
  const [crW, crH] = customRatio ? customRatio.split(':').map(Number) : [16, 9];
  const activePreset = S.crop.aspect || 'free';

  p.innerHTML = `
    <h3>Crop Image</h3>
    <div class="col"><label>Aspect Ratio</label>
      <div class="presets" id="cropPresets">
        <span class="preset${activePreset === 'free' ? ' active' : ''}" data-ratio="free">Free</span>
        <span class="preset${activePreset === '1:1' ? ' active' : ''}" data-ratio="1:1">1:1</span>
        <span class="preset${activePreset === '4:3' ? ' active' : ''}" data-ratio="4:3">4:3</span>
        <span class="preset${activePreset === '16:9' ? ' active' : ''}" data-ratio="16:9">16:9</span>
        <span class="preset${activePreset === '3:2' ? ' active' : ''}" data-ratio="3:2">3:2</span>
        <span class="preset${activePreset === '2:3' ? ' active' : ''}" data-ratio="2:3">2:3</span>
        <span class="preset${activePreset === '9:16' ? ' active' : ''}" data-ratio="9:16">9:16</span>
        <span class="preset${customRatio ? ' active' : ''}" data-ratio="custom">Custom</span>
      </div>
    </div>
    <div class="row" id="customRatioRow" style="display:${customRatio ? 'flex' : 'none'};gap:6px;align-items:center;">
      <input type="number" id="customRatioW" value="${crW}" min="1" max="100" style="flex:1;">
      <span style="color:var(--text2);font-size:12px;">:</span>
      <input type="number" id="customRatioH" value="${crH}" min="1" max="100" style="flex:1;">
    </div>
    <div class="divider"></div>
    <div class="col">
      <label>Expand Canvas</label>
      <div class="expand-row">
        <button class="expand-btn" id="expandMinus">-</button>
        <span class="expand-val" id="expandVal">${S.crop.expand} px</span>
        <button class="expand-btn" id="expandPlus">+</button>
        <button class="eyedropper-btn" id="eyedropperBtn" title="Pick color from image">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 22l1-1h3l9-9"/><path d="M19 3l2 2L10 16H8v-2L19 3z"/></svg>
        </button>
        <input type="color" id="fillColorPicker" value="${S.crop.fillColor}" style="display:none;">
        <div class="color-swatch" id="colorSwatch" style="background:${S.crop.fillColor};" title="Current fill color"></div>
        <span class="expand-reset" id="expandReset">reset</span>
      </div>
    </div>
    <div class="divider"></div>
    <div class="col">
      <label>Resize Output</label>
      <div style="display:flex;flex-direction:column;gap:6px;">
        <div class="row">
          <input type="number" id="cropResW" value="${S.resize.w || S.img.width}" style="flex:1;">
          <span style="color:var(--text2);font-size:12px;">x</span>
          <input type="number" id="cropResH" value="${S.resize.h || S.img.height}" style="flex:1;">
        </div>
        <label><input type="checkbox" id="cropResLock"${S.resize.lock ? ' checked' : ''}> Lock aspect ratio</label>
        <div class="presets" id="cropResPresets">
          <span class="preset" data-w="7680" data-h="4320">8K</span>
          <span class="preset" data-w="3840" data-h="2160">4K</span>
          <span class="preset" data-w="2560" data-h="1440">1440p</span>
          <span class="preset" data-w="1920" data-h="1080">1080p</span>
          <span class="preset" data-w="1280" data-h="720">720p</span>
          <span class="preset" data-w="800" data-h="600">800x600</span>
          <span class="preset" data-w="512" data-h="512">512x512</span>
          <span class="preset" data-w="256" data-h="256">256x256</span>
        </div>
      </div>
    </div>
    </div>
    <div class="divider"></div>
    <p class="hint">Drag to select. Drag inside box to move. Drag corners/edges to resize. Double-click or Enter to apply. Esc to reset.</p>
    <button class="btn primary btn-block" id="cropApply">Apply Crop</button>
    <button class="btn btn-block" id="cropResizeApply">Resize Full Image</button>
    <button class="btn btn-block" id="cropReset">Reset Selection</button>
  `;

  const presetsEl = document.getElementById('cropPresets');
  if (presetsEl) {
    presetsEl.addEventListener('click', e => {
      const pr = e.target.closest('.preset');
      if (!pr) return;
      presetsEl.querySelectorAll('.preset').forEach(x => x.classList.remove('active'));
      pr.classList.add('active');
      if (pr.dataset.ratio === 'custom') {
        const wEl = document.getElementById('customRatioW');
        const hEl = document.getElementById('customRatioH');
        const row = document.getElementById('customRatioRow');
        if (wEl) wEl.style.display = '';
        if (hEl) hEl.style.display = '';
        if (row) row.style.display = 'flex';
        const cw = wEl ? +wEl.value || 16 : 16;
        const ch = hEl ? +hEl.value || 9 : 9;
        S.crop.aspect = cw + ':' + ch;
      } else {
        const row = document.getElementById('customRatioRow');
        if (row) row.style.display = 'none';
        S.crop.aspect = pr.dataset.ratio === 'free' ? null : pr.dataset.ratio;
      }
      if (S.crop.w > 0) constrainCropAspect();
      drawCropOverlay();
    });
  }

  const customW = document.getElementById('customRatioW');
  const customH = document.getElementById('customRatioH');
  if (customW && customH) {
    const updateCustomRatio = () => {
      const cw = +customW.value || 16;
      const ch = +customH.value || 9;
      S.crop.aspect = cw + ':' + ch;
      if (S.crop.w > 0) constrainCropAspect();
      drawCropOverlay();
    };
    customW.addEventListener('input', updateCustomRatio);
    customH.addEventListener('input', updateCustomRatio);
  }

  // Resize output inputs
  const resW = $('cropResW');
  const resH = $('cropResH');
  const resLock = $('cropResLock');
  const ratio = S.img.width / S.img.height;

  S.resize.w = +resW.value || S.img.width;
  S.resize.h = +resH.value || S.img.height;
  S.resize.lock = resLock.checked;

  const syncResW = () => {
    S.resize.w = +resW.value || 1;
    if (resLock.checked) { S.resize.h = Math.round(S.resize.w / ratio); resH.value = S.resize.h; }
  };
  const syncResH = () => {
    S.resize.h = +resH.value || 1;
    if (resLock.checked) { S.resize.w = Math.round(S.resize.h * ratio); resW.value = S.resize.w; }
  };
  resW.addEventListener('input', syncResW);
  resH.addEventListener('input', syncResH);

  const resPresetsEl = $('cropResPresets');
  resPresetsEl.addEventListener('click', e => {
    const pr = e.target.closest('.preset');
    if (!pr) return;
    resW.value = +pr.dataset.w;
    resH.value = +pr.dataset.h;
    S.resize.w = +pr.dataset.w;
    S.resize.h = +pr.dataset.h;
    resLock.checked = true;
    S.resize.lock = true;
  });

  const applyBtn = $('cropApply');
  const resetBtn = $('cropReset');
  if (applyBtn) applyBtn.onclick = applyCrop;
  const resizeApplyBtn = $('cropResizeApply');
  if (resizeApplyBtn) resizeApplyBtn.onclick = applyResizeOnly;
  if (resetBtn) resetBtn.onclick = () => {
    S.crop = { x:0, y:0, w:0, h:0, dragging:false, dragCorner:null, aspect:S.crop.aspect, moving:false, moveStartX:0, moveStartY:0, moveOrigX:0, moveOrigY:0 };
    resW.value = S.img.width;
    resH.value = S.img.height;
    S.resize.w = S.img.width;
    S.resize.h = S.img.height;
    drawCropOverlay();
  };

  drawCropOverlay();

  // Expand controls
  const expandMinus = $('expandMinus');
  const expandPlus = $('expandPlus');
  const expandVal = $('expandVal');
  const fillColorPicker = $('fillColorPicker');
  const colorSwatch = $('colorSwatch');
  const expandReset = $('expandReset');
  const eyedropperBtn = $('eyedropperBtn');

  const updateExpand = (delta: number) => {
    S.crop.expand = Math.max(0, S.crop.expand + delta);
    expandVal.textContent = S.crop.expand + ' px';
    if (S.crop.expand > 0) {
      renderCropExpand();
    } else {
      restoreCropCanvas();
      renderAll();
    }
    drawCropOverlay();
  };

  expandMinus.onclick = () => updateExpand(-10);
  expandPlus.onclick = () => updateExpand(10);

  const applyFillColor = (color: string) => {
    S.crop.fillColor = color;
    fillColorPicker.value = color;
    colorSwatch.style.background = color;
    if (S.crop.expand > 0) {
      renderCropExpand();
      drawCropOverlay();
    }
  };

  colorSwatch.onclick = () => fillColorPicker.click();
  fillColorPicker.oninput = () => applyFillColor(fillColorPicker.value);

  const activateEyedropper = () => {
    S.crop.eyedropping = true;
    eyedropperBtn?.classList.add('active');
    oc.style.cursor = 'crosshair';
  };

  const deactivateEyedropper = () => {
    S.crop.eyedropping = false;
    eyedropperBtn?.classList.remove('active');
    oc.style.cursor = S.crop.w > 0 ? 'default' : 'crosshair';
  };

  eyedropperBtn.onclick = () => {
    if (S.crop.eyedropping) {
      deactivateEyedropper();
    } else {
      activateEyedropper();
    }
  };

  // Intercept overlay mousedown for eyedropper before crop events
  const origCropDown = oc.onmousedown;
  oc.onmousedown = (e: MouseEvent) => {
    if (S.crop.eyedropping) {
      const rect = oc.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const pad = S.crop.expand;
      // Only sample within image area
      if (mx >= pad && mx <= pad + S.viewW && my >= pad && my <= pad + S.viewH) {
        const pixel = ctx.getImageData(Math.round(mx), Math.round(my), 1, 1).data;
        const hex = '#' + [pixel[0], pixel[1], pixel[2]].map(c => c.toString(16).padStart(2, '0')).join('');
        applyFillColor(hex);
      }
      deactivateEyedropper();
      return;
    }
    if (origCropDown) origCropDown(e);
  };

  expandReset.onclick = () => {
    S.crop.expand = 0;
    S.crop.fillColor = '#FFFFFF';
    expandVal.textContent = '0 px';
    fillColorPicker.value = '#FFFFFF';
    colorSwatch.style.background = '#FFFFFF';
    restoreCropCanvas();
    renderAll();
    drawCropOverlay();
  };
}

function constrainCropAspect() {
  if (!S.crop.aspect) return;
  const [rw, rh] = S.crop.aspect.split(':').map(Number);
  const ratio = rw / rh;
  if (S.crop.w / S.crop.h > ratio) S.crop.w = S.crop.h * ratio;
  else S.crop.h = S.crop.w / ratio;
}

// ==================== EVENTS ====================
export function setupCropEvents() {
  oc.onmousedown = null; oc.onmousemove = null; oc.onmouseup = null; oc.ondblclick = null;
  oc.style.cursor = 'crosshair';
  oc.onmousedown = cropDown;
  oc.onmousemove = cropMove;
  oc.onmouseup = cropUp;
  oc.ondblclick = () => { applyCrop(); };
  document.addEventListener('mouseup', cropGlobalUp);
}

export function cleanupCropEvents() {
  document.removeEventListener('mouseup', cropGlobalUp);
}

function cropGlobalUp() {
  S.crop.dragging = false;
  S.crop.moving = false;
}

function getPos(e) {
  const rect = oc.getBoundingClientRect();
  return {
    mx: Math.min(Math.max(e.clientX - rect.left, 0), oc.width),
    my: Math.min(Math.max(e.clientY - rect.top, 0), oc.height)
  };
}

function hitTest(mx, my, cx, cy, threshold) {
  return Math.abs(mx - cx) < threshold && Math.abs(my - cy) < threshold;
}

function cropDown(e) {
  const { mx, my } = getPos(e);
  const c = S.crop;

  if (c.w > 0) {
    // Check corners
    const corners = [
      [c.x, c.y, 'tl'],
      [c.x + c.w, c.y, 'tr'],
      [c.x, c.y + c.h, 'bl'],
      [c.x + c.w, c.y + c.h, 'br']
    ];
    for (const [cx, cy, label] of corners) {
      if (hitTest(mx, my, cx, cy, 10)) {
        c.dragging = true; c.dragCorner = label; return;
      }
    }

    // Check edges
    const edges = [
      [c.x + c.w/2, c.y, 'n'],
      [c.x + c.w/2, c.y + c.h, 's'],
      [c.x, c.y + c.h/2, 'w'],
      [c.x + c.w, c.y + c.h/2, 'e']
    ];
    for (const [ex, ey, label] of edges) {
      if (hitTest(mx, my, ex, ey, 8)) {
        c.dragging = true; c.dragCorner = label; return;
      }
    }

    // Check inside box — move it
    if (mx >= c.x && mx <= c.x + c.w && my >= c.y && my <= c.y + c.h) {
      c.moving = true;
      c.moveStartX = mx; c.moveStartY = my;
      c.moveOrigX = c.x; c.moveOrigY = c.y;
      oc.style.cursor = 'move';
      return;
    }
  }

  // Start new selection
  c.dragging = true; c.dragCorner = 'new';
  c.x = mx; c.y = my; c.w = 0; c.h = 0;
}

function cropMove(e) {
  const c = S.crop;
  const { mx, my } = getPos(e);

  // Hover cursor changes
  if (!c.dragging && !c.moving && c.w > 0) {
    const corners = [[c.x,c.y],[c.x+c.w,c.y],[c.x,c.y+c.h],[c.x+c.w,c.y+c.h]];
    const edges = [[c.x+c.w/2,c.y],[c.x+c.w/2,c.y+c.h],[c.x,c.y+c.h/2],[c.x+c.w,c.y+c.h/2]];
    let cursor = 'crosshair';
    for (const [cx, cy] of corners) { if (hitTest(mx, my, cx, cy, 10)) { cursor = 'nesw-resize'; break; } }
    if (cursor === 'crosshair') {
      for (const [ex, ey] of edges) {
        if (hitTest(mx, my, ex, ey, 8)) {
          cursor = (Math.abs(ex - c.x) < 5 || Math.abs(ex - c.x - c.w) < 5) ? 'ew-resize' : 'ns-resize';
          break;
        }
      }
    }
    if (cursor === 'crosshair' && mx >= c.x && mx <= c.x + c.w && my >= c.y && my <= c.y + c.h) cursor = 'move';
    oc.style.cursor = cursor;
  }

  // Moving
  if (c.moving) {
    const dx = mx - c.moveStartX, dy = my - c.moveStartY;
    c.x = Math.max(0, Math.min(c.moveOrigX + dx, oc.width - c.w));
    c.y = Math.max(0, Math.min(c.moveOrigY + dy, oc.height - c.h));
    drawCropOverlay();
    return;
  }

  if (!c.dragging) return;

  if (c.dragCorner === 'new') {
    // Allow dragging in any direction — normalize negative dimensions
    let nx = c.x, ny = c.y, nw = mx - c.x, nh = my - c.y;
    if (nw < 0) { nx = mx; nw = -nw; }
    if (nh < 0) { ny = my; nh = -nh; }
    c.x = nx; c.y = ny; c.w = nw; c.h = nh;
    if (c.aspect) constrainCropAspect();
  } else {
    handleDrag(mx, my, c);
  }
  drawCropOverlay();
}

function handleDrag(mx, my, c) {
  const dc = c.dragCorner;
  if (dc === 'tl') { c.w += c.x - mx; c.h += c.y - my; c.x = mx; c.y = my; }
  else if (dc === 'tr') { c.w = mx - c.x; c.h += c.y - my; c.y = my; }
  else if (dc === 'bl') { c.w += c.x - mx; c.x = mx; c.h = my - c.y; }
  else if (dc === 'br') { c.w = mx - c.x; c.h = my - c.y; }
  else if (dc === 'n') { c.h += c.y - my; c.y = my; }
  else if (dc === 's') { c.h = my - c.y; }
  else if (dc === 'w') { c.w += c.x - mx; c.x = mx; }
  else if (dc === 'e') { c.w = mx - c.x; }
  if (c.w < 10) c.w = 10;
  if (c.h < 10) c.h = 10;
  if (c.aspect) constrainCropAspect();
}

function cropUp(e) {
  const c = S.crop;
  if (c.moving) {
    c.moving = false;
    oc.style.cursor = 'default';
    return;
  }
  if (!c.dragging) return;
  c.dragging = false;

  // Simple click outside = reset
  if (c.dragCorner === 'new' && (c.w < 5 || c.h < 5)) {
    c.x = 0; c.y = 0; c.w = 0; c.h = 0;
  }
  drawCropOverlay();
}

// ==================== APPLY ====================
function applyCrop() {
  const c = S.crop;
  if (c.w < 5 || c.h < 5) { toast('Select an area first'); return; }
  pushHistory('Crop');

  const scale = S.img.width / S.viewW;
  const sx = Math.round(c.x * scale), sy = Math.round(c.y * scale);
  const sw = Math.round(c.w * scale), sh = Math.round(c.h * scale);

  const tmp = document.createElement('canvas');
  tmp.width = sw; tmp.height = sh;
  tmp.getContext('2d').drawImage(S.img, sx, sy, sw, sh, 0, 0, sw, sh);

  const nimg = new Image();
  nimg.onload = () => {
    S.img = nimg;
    fitImage(); renderAll();
    S.crop = { x:0, y:0, w:0, h:0, dragging:false, dragCorner:null, aspect:S.crop.aspect, moving:false, moveStartX:0, moveStartY:0, moveOrigX:0, moveOrigY:0 };
    toast('Cropped to ' + sw + 'x' + sh);
  };
  nimg.src = tmp.toDataURL('image/png');
}

export function applyCropFromKeyboard() {
  if (S.tool === 'crop' && S.crop.w >= 5 && S.crop.h >= 5) {
    applyCrop();
  }
}

function canvasFromImage(img) {
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  c.getContext('2d').drawImage(img, 0, 0);
  return c;
}

function applyResizeOnly() {
  let outW = S.resize.w || S.img.width;
  let outH = S.resize.h || S.img.height;

  if (S.resize.lock) {
    const srcRatio = S.img.width / S.img.height;
    const dstRatio = outW / outH;
    if (dstRatio > srcRatio) {
      outW = Math.round(outH * srcRatio);
    } else {
      outH = Math.round(outW / srcRatio);
    }
  }

  if (outW === S.img.width && outH === S.img.height) { toast('Change dimensions first'); return; }
  pushHistory('Resize');
  const isDownscale = outW < S.img.width || outH < S.img.height;
  const result = isDownscale ? smartResize(canvasFromImage(S.img), outW, outH) : (() => {
    const c = document.createElement('canvas');
    c.width = outW; c.height = outH;
    c.getContext('2d').drawImage(S.img, 0, 0, outW, outH);
    return c;
  })();
  const nimg = new Image();
  nimg.onload = () => {
    S.img = nimg;
    fitImage(); renderAll();
    toast('Resized to ' + outW + 'x' + outH);
  };
  nimg.src = result.toDataURL('image/png');
}
