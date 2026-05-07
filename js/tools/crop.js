import { S } from '../state.js';
import { $, mc, oc, ctx, octx } from '../dom.js';
import { fitImage, renderAll } from '../canvas.js';
import { pushHistory } from '../history.js';
import { drawCropOverlay } from '../overlay.js';
import { toast } from '../ui.js';

// ==================== PANEL ====================
export function renderCropPanel(p) {
  p.innerHTML = `
    <h3>Crop Image</h3>
    <div class="col"><label>Aspect Ratio</label>
      <div class="presets" id="cropPresets">
        <span class="preset active" data-ratio="free">Free</span>
        <span class="preset" data-ratio="1:1">1:1</span>
        <span class="preset" data-ratio="4:3">4:3</span>
        <span class="preset" data-ratio="16:9">16:9</span>
        <span class="preset" data-ratio="3:2">3:2</span>
        <span class="preset" data-ratio="2:3">2:3</span>
        <span class="preset" data-ratio="9:16">9:16</span>
      </div>
    </div>
    <div class="divider"></div>
    <p class="hint">Drag to select. Drag inside box to move. Drag corners/edges to resize. Double-click or Enter to apply. Esc to reset.</p>
    <button class="btn primary btn-block" id="cropApply">Apply Crop</button>
    <button class="btn btn-block" id="cropReset">Reset Selection</button>
  `;

  const presetsEl = document.getElementById('cropPresets');
  if (presetsEl) {
    presetsEl.addEventListener('click', e => {
      const pr = e.target.closest('.preset');
      if (!pr) return;
      presetsEl.querySelectorAll('.preset').forEach(x => x.classList.remove('active'));
      pr.classList.add('active');
      S.crop.aspect = pr.dataset.ratio === 'free' ? null : pr.dataset.ratio;
      if (S.crop.w > 0) constrainCropAspect();
      drawCropOverlay();
    });
  }

  const applyBtn = $('cropApply');
  const resetBtn = $('cropReset');
  if (applyBtn) applyBtn.onclick = applyCrop;
  if (resetBtn) resetBtn.onclick = () => {
    S.crop = { x:0, y:0, w:0, h:0, dragging:false, dragCorner:null, aspect:S.crop.aspect, moving:false, moveStartX:0, moveStartY:0, moveOrigX:0, moveOrigY:0 };
    drawCropOverlay();
  };

  drawCropOverlay();
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
    c.w = mx - c.x; c.h = my - c.y;
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
