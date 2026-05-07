# UX Polish & Real-Time Interactions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the single-file app into ES modules, add live previews to Rotate/Crop/Resize tools, add undo/redo action labels, and a keyboard shortcut reference panel.

**Architecture:** Split `js/app.js` into `js/state.js` (data), `js/dom.js` (DOM refs), `js/canvas.js` (rendering), `js/history.js` (undo/redo), `js/overlay.js` (crop/grid overlays), `js/ui.js` (toast/modal/shortcuts), `js/tools/*.js` (one per tool), and `js/main.js` (init/wiring). All loaded via `<script type="module">`. HTML import map already exists.

**Tech Stack:** Vanilla JS ES modules, Canvas 2D API, CSS custom properties, no bundler

---

## File Structure

```
js/
  state.js        — Shared state singleton (S object, reset function)
  dom.js          — DOM references ($, mc, oc, ctx, octx)
  canvas.js       — fitImage, renderAll, applyWork, resetWork, renderPreview
  history.js      — pushHistory(label), undo, redo, restoreFromHistory
  overlay.js      — drawCropOverlay, drawGridOverlay, clearOverlay, drawRotatePreview
  ui.js           — toast, setupSaveModal, setupKeys, setupShortcutsPanel
  tools/
    crop.js       — renderCropPanel, setupCropEvents
    resize.js     — renderResizePanel
    grid.js       — renderGridPanel, setupGridEvents
    bgremove.js   — renderBGPanel, loadAI, runAIBG, refineEdges
    rotate.js     — renderRotatePanel, setupRotateLivePreview
  main.js         — init, switchTool, setupSidebar, setupTopbar
```

### Dependency Graph

```
state.js          (no deps)
dom.js            -> state.js
canvas.js         -> state.js, dom.js
overlay.js        -> state.js, dom.js
ui.js             -> state.js, dom.js
history.js        -> state.js, canvas.js, ui.js
tools/crop.js     -> state.js, dom.js, canvas.js, history.js, overlay.js, ui.js
tools/resize.js   -> state.js, dom.js, canvas.js, history.js, ui.js
tools/grid.js     -> state.js, dom.js, overlay.js, ui.js
tools/bgremove.js -> state.js, dom.js, canvas.js, history.js, ui.js
tools/rotate.js   -> state.js, dom.js, canvas.js, history.js, ui.js
main.js           -> state.js, dom.js, canvas.js, history.js, overlay.js, ui.js, tools/*
```

---

### Task 1: Create state.js module

**Files:**
- Create: `js/state.js`

- [ ] **Step 1: Write state.js**

```js
// ==================== SHARED STATE ====================
export const S = {
  img: null, origImg: null, origData: null, workData: null,
  fname: 'image.png', tool: 'crop',
  zoom: 1, viewW: 0, viewH: 0,

  crop: { x:0, y:0, w:0, h:0, dragging:false, dragCorner:null, aspect:null, moving:false, moveStartX:0, moveStartY:0, moveOrigX:0, moveOrigY:0 },
  resize: { w:0, h:0, lock:true, pct:100, livePreview:true },
  grid: { rows:3, cols:3, hLines:[], vLines:[], hCh:false, vCh:false, drag:null, dIdx:-1 },
  bg: { aiLoaded:false, aiLoading:false, refine:false, tol:30, feather:3 },
  rotate: { angle:0, previewAngle:0, previewActive:false },

  history: [], histIdx:-1
};

// Reset rotation preview state
export function resetRotatePreview() {
  S.rotate.previewAngle = 0;
  S.rotate.previewActive = false;
}
```

- [ ] **Step 2: Commit**

```bash
git add js/state.js
git commit -m "feat: add state.js module with shared state"
```

---

### Task 2: Create dom.js module

**Files:**
- Create: `js/dom.js`

- [ ] **Step 1: Write dom.js**

```js
import { S } from './state.js';

export const $ = id => document.getElementById(id);

// Canvas elements — created once, reused everywhere
export const mc = $('mainCanvas');
export const oc = $('overlayCanvas');
export const ctx = mc.getContext('2d', { willReadFrequently: true });
export const octx = oc.getContext('2d');

// Other commonly used elements
export const panel = $('panel');
export const dropzone = $('dropzone');
export const canvasWrap = $('canvasWrap');
export const fileInput = $('fileInput');
export const imageInfo = $('imageInfo');
export const statusDim = $('statusDim');
export const statusTool = $('statusTool');
export const statusZoom = $('statusZoom');
export const canvasArea = $('canvasArea');
export const saveModal = $('saveModal');
```

- [ ] **Step 2: Commit**

```bash
git add js/dom.js
git commit -m "feat: add dom.js module with DOM references"
```

---

### Task 3: Create canvas.js module

**Files:**
- Create: `js/canvas.js`

- [ ] **Step 1: Write canvas.js**

```js
import { S } from './state.js';
import { mc, oc, ctx } from './dom.js';

export function fitImage() {
  if (!S.img) return;
  const maxW = window.innerWidth - 64 - 280 - 32;
  const maxH = window.innerHeight - 44 - 26 - 32;
  let w = S.img.width, h = S.img.height;
  if (w > maxW) { h = h * maxW / w; w = maxW; }
  if (h > maxH) { w = w * maxH / h; h = maxH; }
  S.viewW = w; S.viewH = h; S.zoom = w / S.img.width;
  mc.width = w; mc.height = h;
  oc.width = w; oc.height = h;
  mc.style.width = w + 'px'; mc.style.height = h + 'px';
  oc.style.width = w + 'px'; oc.style.height = h + 'px';
}

export function renderAll() {
  if (!S.img) return;
  ctx.clearRect(0, 0, mc.width, mc.height);
  ctx.drawImage(S.img, 0, 0, mc.width, mc.height);
  S.origData = ctx.getImageData(0, 0, mc.width, mc.height);
  S.workData = new ImageData(new Uint8ClampedArray(S.origData.data), mc.width, mc.height);
  applyWork();
}

export function applyWork() { ctx.putImageData(S.workData, 0, 0); }

export function resetWork() {
  if (!S.origData) return;
  S.workData = new ImageData(new Uint8ClampedArray(S.origData.data), mc.width, mc.height);
  applyWork();
}

// Render preview: draws S.img transformed (rotated) to canvas without modifying S.img
export function renderPreview(angleDeg) {
  if (!S.img) return;
  const rad = angleDeg * Math.PI / 180;
  const iw = S.img.width, ih = S.img.height;
  const c = Math.abs(Math.cos(rad)), s = Math.abs(Math.sin(rad));
  let pw, ph;
  if (Math.abs(angleDeg % 180) < 0.01) { pw = iw; ph = ih; }
  else if (Math.abs(angleDeg % 90) < 0.01) { pw = ih; ph = iw; }
  else { pw = Math.round(iw*c + ih*s); ph = Math.round(iw*s + ih*c); }

  // Scale preview to fit current view
  const scaleX = S.viewW / mc.width;
  const scaleY = S.viewH / mc.height;
  const maxW = S.viewW, maxH = S.viewH;
  let vw = pw, vh = ph;
  if (vw > maxW) { vh = vh * maxW / vw; vw = maxW; }
  if (vh > maxH) { vw = vw * maxH / vh; vh = maxH; }

  ctx.clearRect(0, 0, mc.width, mc.height);
  ctx.save();
  ctx.translate(mc.width/2, mc.height/2);
  ctx.rotate(rad);
  ctx.drawImage(S.img, -iw/2, -ih/2, iw, ih);
  ctx.restore();

  // Update workData from preview so overlays render on top
  S.origData = ctx.getImageData(0, 0, mc.width, mc.height);
  S.workData = new ImageData(new Uint8ClampedArray(S.origData.data), mc.width, mc.height);
}

// Update status bar info
export function updateStatus() {
  const { imageInfo, statusDim, statusZoom } = await import('./dom.js');
  if (S.img) imageInfo.textContent = S.img.width + 'x' + S.img.height + 'px';
  else imageInfo.textContent = 'No image';
  statusDim.textContent = S.img ? S.img.width + ' x ' + S.img.height + ' px' : 'No image';
  statusZoom.textContent = S.zoom >= 0.95 ? '1:1' : Math.round(S.zoom * 100) + '%';
}
```

Wait, `updateStatus` using dynamic import is ugly. Let me put `updateStatus` in `ui.js` instead where it has access to dom refs. Actually, let me rethink — canvas.js should focus purely on canvas rendering. Status bar updates belong in ui.js. Let me fix this.

- [ ] **Step 1 (revised): Write canvas.js without updateStatus**

```js
import { S } from './state.js';
import { mc, oc, ctx } from './dom.js';

export function fitImage() {
  if (!S.img) return;
  const maxW = window.innerWidth - 64 - 280 - 32;
  const maxH = window.innerHeight - 44 - 26 - 32;
  let w = S.img.width, h = S.img.height;
  if (w > maxW) { h = h * maxW / w; w = maxW; }
  if (h > maxH) { w = w * maxH / h; h = maxH; }
  S.viewW = w; S.viewH = h; S.zoom = w / S.img.width;
  mc.width = w; mc.height = h;
  oc.width = w; oc.height = h;
  mc.style.width = w + 'px'; mc.style.height = h + 'px';
  oc.style.width = w + 'px'; oc.style.height = h + 'px';
}

export function renderAll() {
  if (!S.img) return;
  ctx.clearRect(0, 0, mc.width, mc.height);
  ctx.drawImage(S.img, 0, 0, mc.width, mc.height);
  S.origData = ctx.getImageData(0, 0, mc.width, mc.height);
  S.workData = new ImageData(new Uint8ClampedArray(S.origData.data), mc.width, mc.height);
  applyWork();
}

export function applyWork() { ctx.putImageData(S.workData, 0, 0); }

export function resetWork() {
  if (!S.origData) return;
  S.workData = new ImageData(new Uint8ClampedArray(S.origData.data), mc.width, mc.height);
  applyWork();
}

// Render a rotated preview of S.img onto the main canvas (live preview)
export function renderRotatePreview(angleDeg) {
  if (!S.img) return;
  const rad = angleDeg * Math.PI / 180;
  const iw = S.img.width, ih = S.img.height;
  ctx.clearRect(0, 0, mc.width, mc.height);
  ctx.save();
  ctx.translate(mc.width / 2, mc.height / 2);
  ctx.rotate(rad);
  ctx.drawImage(S.img, -iw / 2, -ih / 2, iw, ih);
  ctx.restore();
  S.origData = ctx.getImageData(0, 0, mc.width, mc.height);
  S.workData = new ImageData(new Uint8ClampedArray(S.origData.data), mc.width, mc.height);
}
```

- [ ] **Step 2: Commit**

```bash
git add js/canvas.js
git commit -m "feat: add canvas.js module with rendering functions"
```

---

### Task 4: Create ui.js module

**Files:**
- Create: `js/ui.js`

- [ ] **Step 1: Write ui.js**

```js
import { S } from './state.js';
import { $, imageInfo, statusDim, statusZoom, fileInput, saveModal } from './dom.js';

// ==================== TOAST ====================
export function toast(msg) {
  const old = document.querySelector('.toast');
  if (old) old.remove();
  const d = document.createElement('div');
  d.className = 'toast'; d.textContent = msg;
  document.body.appendChild(d);
  setTimeout(() => { if (d.parentNode) d.remove(); }, 2600);
}

// ==================== STATUS BAR ====================
export function updateStatus() {
  if (S.img) {
    imageInfo.textContent = S.img.width + 'x' + S.img.height + 'px';
  } else {
    imageInfo.textContent = 'No image';
  }
  statusDim.textContent = S.img ? S.img.width + ' x ' + S.img.height + ' px' : 'No image';
  statusZoom.textContent = S.zoom >= 0.95 ? '1:1' : Math.round(S.zoom * 100) + '%';
}

// ==================== KEYBOARD SHORTCUTS ====================
const SHORTCUTS = [
  ['Ctrl+O', 'Open image'],
  ['Ctrl+S', 'Save image'],
  ['Ctrl+Z', 'Undo'],
  ['Ctrl+Shift+Z', 'Redo'],
  ['Enter', 'Apply current tool'],
  ['Esc', 'Cancel / reset tool'],
  ['Del', 'Reset selection'],
  ['?', 'Toggle this panel'],
];

export function setupShortcutsPanel() {
  const overlay = document.createElement('div');
  overlay.id = 'shortcutsOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:999;display:none;align-items:center;justify-content:center;';
  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.style.display = 'none';
  });

  const box = document.createElement('div');
  box.style.cssText = 'background:var(--surface,#161b22);border:1px solid var(--border,#30363d);border-radius:10px;padding:24px;max-width:400px;width:90vw;box-shadow:0 16px 48px rgba(0,0,0,0.5);';
  box.innerHTML = `
    <h3 style="margin:0 0 16px;font-size:16px;font-weight:600;padding-bottom:8px;border-bottom:1px solid var(--border,#30363d);">Keyboard Shortcuts</h3>
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      ${SHORTCUTS.map(([key, desc]) => `
        <tr>
          <td style="padding:6px 12px 6px 0;text-align:right;"><kbd style="background:var(--surface2,#21262d);border:1px solid var(--border,#30363d);border-radius:4px;padding:2px 8px;font-family:monospace;font-size:12px;">${key}</kbd></td>
          <td style="padding:6px 0;color:var(--text2,#8b949e);">${desc}</td>
        </tr>
      `).join('')}
    </table>
    <p style="margin:16px 0 0;font-size:11px;color:var(--text2,#8b949e);text-align:center;">Press <kbd style="background:var(--surface2,#21262d);border:1px solid var(--border,#30363d);border-radius:3px;padding:1px 6px;font-family:monospace;">?</kbd> or click outside to close</p>
  `;

  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

// ==================== KEYBOARD ====================
let _undoFn, _redoFn, _saveFn;

export function setupKeys(undoFn, redoFn, saveFn) {
  _undoFn = undoFn; _redoFn = redoFn; _saveFn = saveFn;

  document.addEventListener('keydown', e => {
    // Shortcuts panel toggle (works even without image)
    if (e.key === '?' && !e.ctrlKey && !e.metaKey && document.activeElement === document.body) {
      e.preventDefault();
      const ov = document.getElementById('shortcutsOverlay');
      if (ov) ov.style.display = ov.style.display === 'flex' ? 'none' : 'flex';
      return;
    }

    if (!S.img) return;

    if (e.ctrlKey && e.shiftKey && (e.key === 'Z' || e.key === 'z')) { e.preventDefault(); if (_redoFn) _redoFn(); }
    else if (e.ctrlKey && e.key === 'z') { e.preventDefault(); if (_undoFn) _undoFn(); }
    else if (e.ctrlKey && e.key === 's') { e.preventDefault(); if (_saveFn) _saveFn(); }
    else if (e.ctrlKey && e.key === 'o') { e.preventDefault(); fileInput.click(); }
  });
}

// ==================== SAVE MODAL ====================
export function setupSaveModal() {
  const saveCancel = $('saveCancel');
  const saveConfirm = $('saveConfirm');
  const saveFormat = $('saveFormat');
  const saveQuality = $('saveQuality');
  const saveFilename = $('saveFilename');
  const qualVal = $('qualVal');
  const qualityRow = $('qualityRow');

  qualityRow.style.display = 'none';

  saveCancel.addEventListener('click', () => { saveModal.style.display = 'none'; });
  saveModal.addEventListener('click', e => { if (e.target === saveModal) saveModal.style.display = 'none'; });
  saveQuality.addEventListener('input', () => { qualVal.textContent = saveQuality.value + '%'; });
  saveFormat.addEventListener('change', () => {
    qualityRow.style.display = saveFormat.value === 'jpeg' ? 'flex' : 'none';
  });

  saveConfirm.addEventListener('click', () => {
    const fmt = saveFormat.value;
    const qual = +saveQuality.value / 100;
    const fname = saveFilename.value || 'image';

    const tmp = document.createElement('canvas');
    tmp.width = S.img.width;
    tmp.height = S.img.height;
    tmp.getContext('2d').drawImage(S.img, 0, 0);

    let mime;
    if (fmt === 'jpeg') mime = 'image/jpeg';
    else if (fmt === 'webp') mime = 'image/webp';
    else mime = 'image/png';

    const ext = fmt === 'jpeg' ? '.jpg' : '.' + fmt;
    const dlName = fname.replace(/\.[^.]+$/, '') + ext;

    if (fmt === 'png') {
      const link = document.createElement('a');
      link.download = dlName;
      link.href = tmp.toDataURL('image/png');
      link.click();
    } else {
      tmp.toBlob(blob => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = dlName;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
      }, mime, qual);
    }

    saveModal.style.display = 'none';
    toast('Saved: ' + dlName);
  });
}

export function openSaveDialog() {
  if (!S.img) { toast('No image to save'); return; }
  const saveFilename = $('saveFilename');
  const saveFormat = $('saveFormat');
  const qualityRow = $('qualityRow');
  saveFilename.value = S.fname;
  saveFormat.value = 'png';
  qualityRow.style.display = 'none';
  saveModal.style.display = 'flex';
}
```

- [ ] **Step 2: Commit**

```bash
git add js/ui.js
git commit -m "feat: add ui.js module with toast, keyboard, save modal, shortcuts panel"
```

---

### Task 5: Create overlay.js module

**Files:**
- Create: `js/overlay.js`

- [ ] **Step 1: Write overlay.js**

```js
import { S } from './state.js';
import { oc, octx } from './dom.js';

export function clearOverlay() {
  octx.clearRect(0, 0, oc.width, oc.height);
  oc.style.cursor = 'default';
  // Clear only overlay events, main canvas events are tool-specific
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
  octx.fillStyle = '#fff'; octx.strokeStyle = '#58a6ff'; octx.lineWidth = 1.5;
  [[c.x, c.y], [c.x + c.w, c.y], [c.x, c.y + c.h], [c.x + c.w, c.y + c.h]].forEach(([hx, hy]) => {
    octx.fillRect(hx - 4, hy - 4, 8, 8);
    octx.strokeRect(hx - 4, hy - 4, 8, 8);
  });

  // Edge midpoints (for edge-drag resize)
  octx.fillStyle = 'rgba(255,255,255,0.6)'; octx.strokeStyle = 'rgba(88,166,255,0.6)'; octx.lineWidth = 1;
  [
    [c.x + c.w/2, c.y, 'n'],
    [c.x + c.w/2, c.y + c.h, 's'],
    [c.x, c.y + c.h/2, 'w'],
    [c.x + c.w, c.y + c.h/2, 'e']
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
```

- [ ] **Step 2: Commit**

```bash
git add js/overlay.js
git commit -m "feat: add overlay.js module with crop and grid overlay drawing"
```

---

### Task 6: Create history.js module

**Files:**
- Create: `js/history.js`

- [ ] **Step 1: Write history.js**

```js
import { S } from './state.js';
import { mc } from './dom.js';
import { fitImage, renderAll } from './canvas.js';
import { drawCropOverlay, drawGridOverlay } from './overlay.js';
import { updateStatus, toast } from './ui.js';

export function pushHistory(label) {
  S.history = S.history.slice(0, S.histIdx + 1);
  const tmp = document.createElement('canvas');
  tmp.width = S.img.width;
  tmp.height = S.img.height;
  tmp.getContext('2d').drawImage(S.img, 0, 0);
  S.history.push({
    dataURL: tmp.toDataURL('image/png'),
    w: S.img.width,
    h: S.img.height,
    label: label || 'Edit'
  });
  S.histIdx = S.history.length - 1;
  if (S.history.length > 100) { S.history.shift(); S.histIdx--; }
  updateUndoRedoButtons();
}

function restoreFromHistory(idx) {
  const entry = S.history[idx];
  const img = new Image();
  img.onload = () => {
    S.img = img;
    fitImage(); renderAll();
    updateStatus();
    if (S.tool === 'crop') drawCropOverlay();
    else if (S.tool === 'grid') drawGridOverlay();
    updateUndoRedoButtons();
  };
  img.src = entry.dataURL;
}

export function undo() {
  if (S.histIdx <= 0) {
    S.img = S.origImg;
    S.histIdx = -1;
    fitImage(); renderAll(); updateStatus();
    updateUndoRedoButtons();
    return;
  }
  const label = S.history[S.histIdx].label;
  S.histIdx--;
  restoreFromHistory(S.histIdx);
  toast('Undone: ' + label);
}

export function redo() {
  if (S.histIdx >= S.history.length - 1) return;
  S.histIdx++;
  const label = S.history[S.histIdx].label;
  restoreFromHistory(S.histIdx);
  toast('Redone: ' + label);
}

function updateUndoRedoButtons() {
  const btnUndo = document.getElementById('btnUndo');
  const btnRedo = document.getElementById('btnRedo');
  if (btnUndo) btnUndo.classList.toggle('disabled', S.histIdx < 0);
  if (btnRedo) btnRedo.classList.toggle('disabled', S.histIdx >= S.history.length - 1);
}
```

- [ ] **Step 2: Commit**

```bash
git add js/history.js
git commit -m "feat: add history.js module with labeled undo/redo"
```

---

### Task 7: Create tools/crop.js module with movable selection

**Files:**
- Create: `js/tools/crop.js`

- [ ] **Step 1: Write tools/crop.js**

```js
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
  // Clean up old handlers
  oc.onmousedown = null; oc.onmousemove = null; oc.onmouseup = null; oc.ondblclick = null;

  oc.style.cursor = 'crosshair';
  oc.onmousedown = cropDown;
  oc.onmousemove = cropMove;
  oc.onmouseup = cropUp;
  oc.ondblclick = () => { applyCrop(); };

  // Global mouseup to catch drag-end outside canvas
  document.addEventListener('mouseup', cropGlobalUp);
}

export function cleanupCropEvents() {
  document.removeEventListener('mouseup', cropGlobalUp);
}

function cropGlobalUp() {
  const c = S.crop;
  c.dragging = false;
  c.moving = false;
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

    // Check inside — move the box
    if (mx >= c.x && mx <= c.x + c.w && my >= c.y && my <= c.y + c.h) {
      c.moving = true;
      c.moveStartX = mx; c.moveStartY = my;
      c.moveOrigX = c.x; c.moveOrigY = c.y;
      oc.style.cursor = 'move';
      return;
    }
  }

  // Click outside without drag — will be handled in cropUp
  // Start potential new selection on drag
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
    if (cursor === 'crosshair') for (const [ex, ey] of edges) {
      if (hitTest(mx, my, ex, ey, 8)) { cursor = (Math.abs(ex - c.x) < 5 || Math.abs(ex - c.x - c.w) < 5) ? 'ew-resize' : 'ns-resize'; break; }
    }
    if (cursor === 'crosshair' && mx >= c.x && mx <= c.x + c.w && my >= c.y && my <= c.y + c.h) cursor = 'move';
    oc.style.cursor = cursor;
  }

  // Moving the box
  if (c.moving) {
    const dx = mx - c.moveStartX, dy = my - c.moveStartY;
    let nx = c.moveOrigX + dx, ny = c.moveOrigY + dy;
    nx = Math.max(0, Math.min(nx, oc.width - c.w));
    ny = Math.max(0, Math.min(ny, oc.height - c.h));
    c.x = nx; c.y = ny;
    drawCropOverlay();
    return;
  }

  // Resizing / new selection
  if (!c.dragging) return;

  if (c.dragCorner === 'new') {
    c.w = mx - c.x; c.h = my - c.y;
    if (c.aspect) constrainCropAspect();
  } else {
    handleCornerDrag(mx, my, c);
  }
  drawCropOverlay();
}

function handleCornerDrag(mx, my, c) {
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

  // If it was a simple click outside (tiny or negative selection), reset
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

// Handle Enter key from ui.js
export function applyCropFromKeyboard() {
  if (S.tool === 'crop' && S.crop.w >= 5 && S.crop.h >= 5) {
    applyCrop();
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add js/tools/crop.js
git commit -m "feat: add crop.js with movable selection, edge resize, better cursor feedback"
```

---

### Task 8: Create tools/resize.js module with live preview

**Files:**
- Create: `js/tools/resize.js`

- [ ] **Step 1: Write tools/resize.js**

```js
import { S } from '../state.js';
import { $, mc, ctx } from '../dom.js';
import { fitImage, renderAll } from '../canvas.js';
import { pushHistory } from '../history.js';
import { toast } from '../ui.js';

export function renderResizePanel(p) {
  S.resize.w = S.img.width; S.resize.h = S.img.height;
  p.innerHTML = `
    <h3>Resize Image</h3>
    <div class="row"><label style="flex:1">Width (px)</label><label style="flex:1">Height (px)</label></div>
    <div class="row">
      <input type="number" id="resW" value="${S.img.width}" style="flex:1">
      <input type="number" id="resH" value="${S.img.height}" style="flex:1">
    </div>
    <label><input type="checkbox" id="resLock" checked> Lock aspect ratio</label>
    <label><input type="checkbox" id="resLive"> Live preview on canvas</label>
    <div class="divider"></div>
    <label>Scale: <span class="val" id="resPctVal">100%</span></label>
    <input type="range" id="resPct" min="1" max="400" value="100">
    <div class="divider"></div>
    <label>Quick Presets</label>
    <div class="presets" id="resPresets">
      <span class="preset" data-w="1920" data-h="1080">1080p</span>
      <span class="preset" data-w="1280" data-h="720">720p</span>
      <span class="preset" data-w="800" data-h="600">800x600</span>
      <span class="preset" data-w="512" data-h="512">512x512</span>
      <span class="preset" data-w="256" data-h="256">256x256</span>
    </div>
    <button class="btn primary btn-block" id="resApply">Apply Resize</button>
  `;

  const wEl = $('resW'), hEl = $('resH'), lockEl = $('resLock'), pctEl = $('resPct'), liveEl = $('resLive');
  const ratio = S.img.width / S.img.height;
  const pctVal = $('resPctVal');

  const doLive = () => liveEl && liveEl.checked;

  function updateW() {
    S.resize.w = +wEl.value || 1;
    if (lockEl.checked) { S.resize.h = Math.round(S.resize.w / ratio); hEl.value = S.resize.h; }
    pctEl.value = Math.round(S.resize.w / S.img.width * 100);
    pctVal.textContent = pctEl.value + '%';
    if (doLive()) renderLivePreview();
  }

  function updateH() {
    S.resize.h = +hEl.value || 1;
    if (lockEl.checked) { S.resize.w = Math.round(S.resize.h * ratio); wEl.value = S.resize.w; }
    if (doLive()) renderLivePreview();
  }

  function updatePct() {
    const p = +pctEl.value;
    pctVal.textContent = p + '%';
    S.resize.w = Math.round(S.img.width * p / 100);
    S.resize.h = Math.round(S.img.height * p / 100);
    wEl.value = S.resize.w; hEl.value = S.resize.h;
    if (doLive()) renderLivePreview();
  }

  wEl.oninput = updateW;
  hEl.oninput = updateH;
  pctEl.oninput = updatePct;
  if (liveEl) liveEl.onchange = () => {
    if (doLive()) renderLivePreview();
    else renderAll();
  };

  const presetsEl = $('resPresets');
  if (presetsEl) {
    presetsEl.addEventListener('click', e => {
      const pr = e.target.closest('.preset');
      if (!pr) return;
      S.resize.w = +pr.dataset.w; S.resize.h = +pr.dataset.h;
      wEl.value = S.resize.w; hEl.value = S.resize.h;
      pctEl.value = Math.round(S.resize.w / S.img.width * 100);
      pctVal.textContent = pctEl.value + '%';
      if (doLive()) renderLivePreview();
    });
  }

  const applyBtn = $('resApply');
  if (applyBtn) applyBtn.onclick = () => {
    pushHistory('Resize');
    const tmp = document.createElement('canvas');
    tmp.width = S.resize.w; tmp.height = S.resize.h;
    tmp.getContext('2d').drawImage(S.img, 0, 0, S.resize.w, S.resize.h);
    const nimg = new Image();
    nimg.onload = () => { S.img = nimg; fitImage(); renderAll(); toast('Resized to ' + S.resize.w + 'x' + S.resize.h); };
    nimg.src = tmp.toDataURL('image/png');
  };
}

function renderLivePreview() {
  const tmp = document.createElement('canvas');
  tmp.width = S.resize.w; tmp.height = S.resize.h;
  tmp.getContext('2d').drawImage(S.img, 0, 0, S.resize.w, S.resize.h);

  // Draw preview to main canvas (scaled to fit view)
  ctx.clearRect(0, 0, mc.width, mc.height);
  ctx.drawImage(tmp, 0, 0, mc.width, mc.height);
  S.origData = ctx.getImageData(0, 0, mc.width, mc.height);
  S.workData = new ImageData(new Uint8ClampedArray(S.origData.data), mc.width, mc.height);
}
```

- [ ] **Step 2: Commit**

```bash
git add js/tools/resize.js
git commit -m "feat: add resize.js with live preview toggle"
```

---

### Task 9: Create tools/grid.js module

**Files:**
- Create: `js/tools/grid.js`

- [ ] **Step 1: Write tools/grid.js**

```js
import { S } from '../state.js';
import { $, oc } from '../dom.js';
import { drawGridOverlay } from '../overlay.js';
import { toast } from '../ui.js';

export function renderGridPanel(p) {
  const g = S.grid;
  if (!g.hCh || g.hLines.length === 0) g.hLines = even(g.rows);
  if (!g.vCh || g.vLines.length === 0) g.vLines = even(g.cols);

  p.innerHTML = `
    <h3>Grid Split</h3>
    <div class="col"><label>Rows: <span class="val" id="gRowsVal">${g.rows}</span></label>
    <input type="range" id="gRows" min="1" max="20" value="${g.rows}"></div>
    <div class="col"><label>Columns: <span class="val" id="gColsVal">${g.cols}</span></label>
    <input type="range" id="gCols" min="1" max="20" value="${g.cols}"></div>
    <div class="divider"></div>
    <p class="hint">Drag the blue handles to reposition lines. Lines snap to avoid overlap.</p>
    <p class="hint" id="gridCount">${g.rows}x${g.cols} = ${g.rows * g.cols} cells</p>
    <button class="btn primary btn-block" id="gridZip">Download All Cells as ZIP</button>
  `;

  $('gRows').oninput = () => {
    g.rows = +$('gRows').value; $('gRowsVal').textContent = g.rows;
    g.hLines = even(g.rows); g.hCh = false;
    $('gridCount').textContent = g.rows + 'x' + g.cols + ' = ' + (g.rows * g.cols) + ' cells';
    drawGridOverlay();
  };
  $('gCols').oninput = () => {
    g.cols = +$('gCols').value; $('gColsVal').textContent = g.cols;
    g.vLines = even(g.cols); g.vCh = false;
    $('gridCount').textContent = g.rows + 'x' + g.cols + ' = ' + (g.rows * g.cols) + ' cells';
    drawGridOverlay();
  };
  $('gridZip').onclick = downloadGridZip;

  drawGridOverlay();
}

function even(n) { const a = []; for (let i = 1; i < n; i++) a.push(i / n); return a; }

// ==================== EVENTS ====================
export function setupGridEvents() {
  oc.onmousedown = gridDown;
  oc.onmousemove = gridMove;
  oc.onmouseup = gridUp;
  oc.onmouseleave = gridUp;
}

function gridDown(e) {
  const g = S.grid;
  const rect = oc.getBoundingClientRect();
  const mx = (e.clientX - rect.left) / oc.width;
  const my = (e.clientY - rect.top) / oc.height;
  const th = 0.035;

  for (let i = 0; i < g.hLines.length; i++) {
    if (Math.abs(my - g.hLines[i]) < th) { g.drag = 'h'; g.dIdx = i; oc.style.cursor = 'row-resize'; return; }
  }
  for (let i = 0; i < g.vLines.length; i++) {
    if (Math.abs(mx - g.vLines[i]) < th) { g.drag = 'v'; g.dIdx = i; oc.style.cursor = 'col-resize'; return; }
  }
}

function gridMove(e) {
  const g = S.grid;
  const rect = oc.getBoundingClientRect();
  const mx = (e.clientX - rect.left) / oc.width;
  const my = (e.clientY - rect.top) / oc.height;
  const th = 0.035;

  if (!g.drag) {
    let f = false;
    for (let i = 0; i < g.hLines.length; i++) { if (Math.abs(my - g.hLines[i]) < th) { oc.style.cursor = 'row-resize'; f = true; break; } }
    if (!f) for (let i = 0; i < g.vLines.length; i++) { if (Math.abs(mx - g.vLines[i]) < th) { oc.style.cursor = 'col-resize'; f = true; break; } }
    if (!f) oc.style.cursor = 'crosshair';
    return;
  }

  if (g.drag === 'h') {
    const v = Math.max(0.03, Math.min(0.97, my));
    if (g.dIdx > 0 && v <= g.hLines[g.dIdx - 1] + 0.025) return;
    if (g.dIdx < g.hLines.length - 1 && v >= g.hLines[g.dIdx + 1] - 0.025) return;
    g.hLines[g.dIdx] = v; g.hCh = true;
  } else {
    const v = Math.max(0.03, Math.min(0.97, mx));
    if (g.dIdx > 0 && v <= g.vLines[g.dIdx - 1] + 0.025) return;
    if (g.dIdx < g.vLines.length - 1 && v >= g.vLines[g.dIdx + 1] - 0.025) return;
    g.vLines[g.dIdx] = v; g.vCh = true;
  }
  drawGridOverlay();
}

function gridUp() { S.grid.drag = null; if (S.tool === 'grid') oc.style.cursor = 'crosshair'; }

// ==================== ZIP DOWNLOAD ====================
async function downloadGridZip() {
  const g = S.grid;
  if (typeof JSZip === 'undefined') { toast('JSZip not loaded. Check internet.'); return; }

  const img = S.img, iw = img.width, ih = img.height;
  const he = [0, ...g.hLines, 1];
  const ve = [0, ...g.vLines, 1];
  const total = g.rows * g.cols;

  toast('Building ZIP with ' + total + ' cells...');
  const zip = new JSZip();

  for (let r = 0; r < g.rows; r++) {
    for (let c = 0; c < g.cols; c++) {
      const sx = Math.round(ve[c] * iw);
      const sy = Math.round(he[r] * ih);
      const sw = Math.round((ve[c + 1] - ve[c]) * iw);
      const sh = Math.round((he[r + 1] - he[r]) * ih);
      if (sw <= 0 || sh <= 0) continue;

      const cell = document.createElement('canvas');
      cell.width = sw; cell.height = sh;
      cell.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      const b64 = cell.toDataURL('image/png').split(',')[1];
      zip.file('cell_r' + (r + 1) + '_c' + (c + 1) + '.png', b64, { base64: true });
    }
  }

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = S.fname.replace('.png', '') + '_grid.zip';
  a.click();
  URL.revokeObjectURL(url);
  toast('ZIP downloaded: ' + total + ' cells');
}
```

- [ ] **Step 2: Commit**

```bash
git add js/tools/grid.js
git commit -m "feat: add grid.js module"
```

---

### Task 10: Create tools/bgremove.js module

**Files:**
- Create: `js/tools/bgremove.js`

- [ ] **Step 1: Write tools/bgremove.js**

```js
import { S } from '../state.js';
import { $, mc } from '../dom.js';
import { fitImage, renderAll } from '../canvas.js';
import { pushHistory } from '../history.js';
import { toast } from '../ui.js';

export function renderBGPanel(p) {
  const bg = S.bg;
  let html = '<h3>Background Removal</h3>';

  if (!bg.aiLoaded && !bg.aiLoading) {
    html += '<p class="hint">Uses AI neural network running locally in your browser. First load ~15MB (cached after).</p>';
    html += '<button class="btn primary btn-block" id="bgLoad">Download AI Model</button>';
  } else if (bg.aiLoading) {
    html += '<div class="row" style="align-items:center;gap:10px;"><div class="spinner"></div><span>Loading model...</span></div>';
  } else {
    html += '<p style="color:var(--success);font-size:12px;margin-bottom:4px;">AI model ready</p>';
    html += '<button class="btn primary btn-block" id="bgRun">Remove Background</button>';

    html += '<div class="divider"></div>';
    html += '<label><input type="checkbox" id="bgRefine"> Refine result</label>';
    if (bg.refine) {
      html += '<div class="col" style="margin-top:6px;"><label>Edge Tolerance: <span class="val" id="bgTolV">' + bg.tol + '</span></label>';
      html += '<input type="range" id="bgTol" min="1" max="100" value="' + bg.tol + '"></div>';
      html += '<div class="col"><label>Feather: <span class="val" id="bgFeathV">' + bg.feather + 'px</span></label>';
      html += '<input type="range" id="bgFeath" min="0" max="10" value="' + bg.feather + '"></div>';
      html += '<button class="btn btn-block" id="bgRefineApply" style="margin-top:4px;">Apply Refinement</button>';
    }
  }
  p.innerHTML = html;

  const loadBtn = $('bgLoad');
  if (loadBtn) loadBtn.onclick = () => { loadAI(); };
  const runBtn = $('bgRun');
  if (runBtn) runBtn.onclick = () => { runAIBG(); };
  const refChk = $('bgRefine');
  if (refChk) refChk.onchange = () => { bg.refine = refChk.checked; renderBGPanel(p); };
  const tolEl = $('bgTol');
  if (tolEl) tolEl.oninput = () => { bg.tol = +tolEl.value; $('bgTolV').textContent = bg.tol; };
  const feEl = $('bgFeath');
  if (feEl) feEl.oninput = () => { bg.feather = +feEl.value; $('bgFeathV').textContent = bg.feather + 'px'; };
  const refApply = $('bgRefineApply');
  if (refApply) refApply.onclick = () => { refineEdges(); };
}

async function loadAI() {
  S.bg.aiLoading = true;
  // re-render via switchTool in main.js
  document.querySelector('.side-btn[data-tool="bgremove"]').click();
  toast('Loading AI model...');

  try {
    const mod = await import('@imgly/background-removal');
    if (mod && mod.removeBackground) {
      window.__bgMod = mod;
      S.bg.aiLoaded = true;
      toast('AI model ready');
    } else {
      throw new Error('removeBackground not exported');
    }
  } catch (err) {
    toast('Failed: ' + (err.message || 'Check connection'));
  }
  S.bg.aiLoading = false;
  document.querySelector('.side-btn[data-tool="bgremove"]').click();
}

async function runAIBG() {
  if (!window.__bgMod) { toast('Load AI model first'); return; }
  pushHistory('BG Remove');
  toast('Processing with AI...');

  try {
    const tmp = document.createElement('canvas');
    tmp.width = S.img.width; tmp.height = S.img.height;
    tmp.getContext('2d').drawImage(S.img, 0, 0);
    const blob = await new Promise(res => tmp.toBlob(res, 'image/png'));
    const resBlob = await window.__bgMod.removeBackground(blob);
    const url = URL.createObjectURL(resBlob);
    const nimg = new Image();
    nimg.onload = () => {
      S.img = nimg; fitImage(); renderAll();
      URL.revokeObjectURL(url);
      toast('Background removed');
      document.querySelector('.side-btn[data-tool="bgremove"]').click();
    };
    nimg.onerror = () => { toast('Failed to decode result'); URL.revokeObjectURL(url); };
    nimg.src = url;
  } catch (err) {
    toast('Error: ' + (err.message || 'unknown'));
    document.querySelector('.side-btn[data-tool="bgremove"]').click();
  }
}

function refineEdges() {
  const tol = S.bg.tol;
  const feather = S.bg.feather;
  const iw = S.img.width, ih = S.img.height;

  const tmp = document.createElement('canvas');
  tmp.width = iw; tmp.height = ih;
  const tx = tmp.getContext('2d');
  tx.drawImage(S.img, 0, 0);
  const fullData = tx.getImageData(0, 0, iw, ih);
  const newPx = new Uint8ClampedArray(fullData.data);

  for (let py = 0; py < ih; py++) {
    for (let px = 0; px < iw; px++) {
      const idx = (py * iw + px) * 4;
      if (newPx[idx + 3] === 0) continue;

      let atEdge = false;
      outer: for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = px + dx, ny = py + dy;
          if (nx >= 0 && nx < iw && ny >= 0 && ny < ih) {
            if (fullData.data[(ny * iw + nx) * 4 + 3] < 10) { atEdge = true; break outer; }
          }
        }
      }

      if (atEdge && feather > 0) {
        let tCount = 0, total = 0;
        for (let dy = -feather; dy <= feather; dy++) {
          for (let dx = -feather; dx <= feather; dx++) {
            const nx = px + dx, ny = py + dy;
            if (nx >= 0 && nx < iw && ny >= 0 && ny < ih) {
              total++;
              if (fullData.data[(ny * iw + nx) * 4 + 3] < 10) tCount++;
            }
          }
        }
        const frac = 1 - (tCount / Math.max(1, total));
        newPx[idx + 3] = Math.round(newPx[idx + 3] * Math.pow(frac, tol / 50));
      }
    }
  }

  tx.putImageData(new ImageData(newPx, iw, ih), 0, 0);

  const nimg = new Image();
  nimg.onload = () => {
    S.img = nimg;
    fitImage(); renderAll();
    toast('Edges refined');
    document.querySelector('.side-btn[data-tool="bgremove"]').click();
  };
  nimg.src = tmp.toDataURL('image/png');
}
```

- [ ] **Step 2: Commit**

```bash
git add js/tools/bgremove.js
git commit -m "feat: add bgremove.js module"
```

---

### Task 11: Create tools/rotate.js module with live preview

**Files:**
- Create: `js/tools/rotate.js`

- [ ] **Step 1: Write tools/rotate.js**

```js
import { S, resetRotatePreview } from '../state.js';
import { $, mc, oc, ctx, octx } from '../dom.js';
import { fitImage, renderAll, renderRotatePreview } from '../canvas.js';
import { pushHistory } from '../history.js';
import { toast } from '../ui.js';

// Debounce helper
let previewTimer = null;

export function renderRotatePanel(p) {
  p.innerHTML = `
    <h3>Rotate & Flip</h3>
    <div class="col"><label>Quick Rotate</label>
      <div class="row">
        <button class="btn btn-sm" id="rotCCW">90 CCW</button>
        <button class="btn btn-sm" id="rotCW">90 CW</button>
        <button class="btn btn-sm" id="rot180">180</button>
      </div>
    </div>
    <div class="divider"></div>
    <div class="col"><label>Custom Angle: <span class="val" id="angVal">0</span></label>
    <input type="range" id="angSlider" min="-180" max="180" value="0"></div>
    <button class="btn primary btn-block" id="rotApply">Apply Rotation</button>
    <div class="divider"></div>
    <div class="col"><label>Flip</label>
      <div class="row">
        <button class="btn btn-block btn-sm" id="flipH">Flip Horizontal</button>
        <button class="btn btn-block btn-sm" id="flipV">Flip Vertical</button>
      </div>
    </div>
  `;

  // Quick rotate buttons — instant preview
  $('rotCCW').onclick = () => { startLivePreview(-90); };
  $('rotCW').onclick = () => { startLivePreview(90); };
  $('rot180').onclick = () => { startLivePreview(180); };

  // Slider — live preview with debounce
  $('angSlider').oninput = () => {
    const deg = +$('angSlider').value;
    $('angVal').textContent = deg;
    startLivePreview(deg);
  };

  $('rotApply').onclick = commitRotation;
  $('flipH').onclick = flipH;
  $('flipV').onclick = flipV;
}

function startLivePreview(deg) {
  S.rotate.previewActive = true;
  S.rotate.previewAngle = deg;
  renderRotatePreview(deg);
}

// Called from ui.js keyboard handler
export function commitRotation() {
  if (!S.rotate.previewActive) return;
  const deg = S.rotate.previewAngle;
  resetRotatePreview();
  applyRotation(deg);
}

function applyRotation(deg) {
  if (!S.img) return;
  pushHistory('Rotate ' + deg + '\u00B0');
  const rad = deg * Math.PI / 180;
  const iw = S.img.width, ih = S.img.height;
  const c = Math.abs(Math.cos(rad)), s = Math.abs(Math.sin(rad));
  let nw, nh;
  if (Math.abs(deg % 180) < 0.01) { nw = iw; nh = ih; }
  else if (Math.abs(deg % 90) < 0.01) { nw = ih; nh = iw; }
  else { nw = Math.round(iw * c + ih * s); nh = Math.round(iw * s + ih * c); }

  const tmp = document.createElement('canvas'); tmp.width = nw; tmp.height = nh;
  const tx = tmp.getContext('2d');
  tx.translate(nw / 2, nh / 2); tx.rotate(rad);
  tx.drawImage(S.img, -iw / 2, -ih / 2);

  const nimg = new Image();
  nimg.onload = () => { S.img = nimg; fitImage(); renderAll(); toast('Rotated ' + deg + '\u00B0'); };
  nimg.src = tmp.toDataURL('image/png');
}

// Handle Enter key from ui.js
export function applyRotationFromKeyboard() {
  if (S.tool === 'rotate' && S.rotate.previewActive) {
    commitRotation();
  }
}

function flipH() {
  if (!S.img) return;
  pushHistory('Flip Horizontal');
  const tmp = document.createElement('canvas');
  tmp.width = S.img.width; tmp.height = S.img.height;
  const tx = tmp.getContext('2d');
  tx.translate(S.img.width, 0); tx.scale(-1, 1);
  tx.drawImage(S.img, 0, 0);
  const nimg = new Image();
  nimg.onload = () => { S.img = nimg; fitImage(); renderAll(); toast('Flipped H'); };
  nimg.src = tmp.toDataURL('image/png');
}

function flipV() {
  if (!S.img) return;
  pushHistory('Flip Vertical');
  const tmp = document.createElement('canvas');
  tmp.width = S.img.width; tmp.height = S.img.height;
  const tx = tmp.getContext('2d');
  tx.translate(0, S.img.height); tx.scale(1, -1);
  tx.drawImage(S.img, 0, 0);
  const nimg = new Image();
  nimg.onload = () => { S.img = nimg; fitImage(); renderAll(); toast('Flipped V'); };
  nimg.src = tmp.toDataURL('image/png');
}
```

- [ ] **Step 2: Commit**

```bash
git add js/tools/rotate.js
git commit -m "feat: add rotate.js with live preview on slider and quick buttons"
```

---

### Task 12: Create main.js — wire everything together

**Files:**
- Create: `js/main.js`
- Modify: `index.html` (change script tag to type="module")

- [ ] **Step 1: Write main.js**

```js
import { S, resetRotatePreview } from './state.js';
import { $, mc, oc, ctx, octx, panel, dropzone, canvasWrap, fileInput, canvasArea } from './dom.js';
import { fitImage, renderAll, renderRotatePreview } from './canvas.js';
import { pushHistory, undo, redo } from './history.js';
import { clearOverlay, drawCropOverlay, drawGridOverlay } from './overlay.js';
import { toast, updateStatus, setupKeys, setupShortcutsPanel, setupSaveModal, openSaveDialog } from './ui.js';
import { renderCropPanel, setupCropEvents, cleanupCropEvents } from './tools/crop.js';
import { renderResizePanel } from './tools/resize.js';
import { renderGridPanel, setupGridEvents } from './tools/grid.js';
import { renderBGPanel } from './tools/bgremove.js';
import { renderRotatePanel, commitRotation, applyRotationFromKeyboard } from './tools/rotate.js';
import { applyCropFromKeyboard } from './tools/crop.js';

// ==================== TOOL SWITCHING ====================
const toolPanels = {
  crop: renderCropPanel,
  resize: renderResizePanel,
  grid: renderGridPanel,
  bgremove: renderBGPanel,
  rotate: renderRotatePanel
};

const toolStatusLabels = {
  crop: 'Crop',
  resize: 'Resize',
  grid: 'Grid Split',
  bgremove: 'BG Remove',
  rotate: 'Rotate & Flip'
};

function switchTool(tool) {
  // If leaving rotate with uncommitted preview, discard it
  if (S.tool === 'rotate' && S.rotate.previewActive) {
    resetRotatePreview();
  }
  // Cleanup old tool events
  if (S.tool === 'crop') cleanupCropEvents();

  S.tool = tool;
  document.querySelectorAll('.side-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tool === tool);
  });
  clearOverlay();

  const statusTool = document.getElementById('statusTool');
  if (statusTool) statusTool.textContent = toolStatusLabels[tool] || tool;

  // Render the tool panel
  if (!S.img) {
    panel.innerHTML = '<div class="panel-empty"><p>Load an image to start editing</p></div>';
  } else {
    const renderFn = toolPanels[tool];
    if (renderFn) renderFn(panel);
  }

  setupCanvasEvents();
}

function setupCanvasEvents() {
  // Clear all overlay canvas handlers
  ['onmousedown','onmousemove','onmouseup','onmouseleave','ondblclick'].forEach(k => { oc[k] = null; });
  oc.style.cursor = 'default';

  if (!S.img) return;

  if (S.tool === 'crop') {
    setupCropEvents();
  } else if (S.tool === 'grid') {
    setupGridEvents();
  }
}

// ==================== UPLOAD ====================
function setupUpload() {
  const dz = dropzone;
  const fi = fileInput;

  dz.addEventListener('click', () => fi.click());
  $('btnOpen').addEventListener('click', () => fi.click());
  fi.addEventListener('change', e => { const f = e.target.files[0]; if (f) loadFile(f); });

  let cnt = 0;
  canvasArea.addEventListener('dragenter', e => { e.preventDefault(); cnt++; dz.style.display = 'flex'; });
  canvasArea.addEventListener('dragleave', () => { cnt--; if (cnt <= 0) { cnt = 0; if (S.img) dz.style.display = 'none'; } });
  canvasArea.addEventListener('dragover', e => e.preventDefault());
  canvasArea.addEventListener('drop', e => { e.preventDefault(); cnt = 0; const f = e.dataTransfer.files[0]; if (f) loadFile(f); });
}

function loadFile(file) {
  if (!file.type.startsWith('image/')) return toast('Not an image file');
  S.fname = file.name.replace(/\.[^.]+$/, '') + '.png';
  S.history = []; S.histIdx = -1;
  S.grid.hLines = []; S.grid.vLines = []; S.grid.hCh = false; S.grid.vCh = false;
  S.crop = { x:0, y:0, w:0, h:0, dragging:false, dragCorner:null, aspect:null, moving:false, moveStartX:0, moveStartY:0, moveOrigX:0, moveOrigY:0 };
  S.rotate.angle = 0;
  resetRotatePreview();

  const r = new FileReader();
  r.onload = e => {
    const img = new Image();
    img.onload = () => {
      S.img = img; S.origImg = img;
      fitImage(); renderAll();
      dropzone.style.display = 'none';
      canvasWrap.style.display = 'block';
      updateStatus();
      toast('Loaded ' + img.width + 'x' + img.height);
      switchTool(S.tool);
    };
    img.src = e.target.result;
  };
  r.readAsDataURL(file);
}

// ==================== SIDEBAR ====================
function setupSidebar() {
  document.querySelector('.sidebar').addEventListener('click', e => {
    const btn = e.target.closest('.side-btn');
    if (!btn) return;
    switchTool(btn.dataset.tool);
  });
}

// ==================== TOPBAR ====================
function setupTopbar() {
  $('btnUndo').addEventListener('click', undo);
  $('btnRedo').addEventListener('click', redo);
  $('btnSave').addEventListener('click', openSaveDialog);
  $('btnFit').addEventListener('click', () => {
    if (S.img) {
      // Discard rotate preview if any
      if (S.rotate.previewActive) { resetRotatePreview(); }
      fitImage(); renderAll(); switchTool(S.tool);
    }
  });
  $('btnActual').addEventListener('click', () => {
    if (!S.img) return;
    if (S.rotate.previewActive) { resetRotatePreview(); }
    S.viewW = S.img.width; S.viewH = S.img.height; S.zoom = 1;
    mc.width = S.img.width; mc.height = S.img.height;
    oc.width = S.img.width; oc.height = S.img.height;
    mc.style.width = S.img.width + 'px'; mc.style.height = S.img.height + 'px';
    oc.style.width = S.img.width + 'px'; oc.style.height = S.img.height + 'px';
    renderAll(); switchTool(S.tool);
  });
}

// ==================== INIT ====================
function init() {
  setupUpload();
  setupSidebar();
  setupTopbar();
  setupSaveModal();
  setupShortcutsPanel();
  setupKeys(undo, redo, openSaveDialog);

  // Tool-specific keyboard handling (Enter/Escape/Delete)
  document.addEventListener('keydown', e => {
    if (!S.img) return;
    if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && document.activeElement === document.body) {
      e.preventDefault();
      if (S.tool === 'crop') applyCropFromKeyboard();
      else if (S.tool === 'rotate') applyRotationFromKeyboard();
    }
    if ((e.key === 'Escape' || e.key === 'Delete') && document.activeElement === document.body) {
      e.preventDefault();
      if (S.tool === 'crop') {
        S.crop = { x:0, y:0, w:0, h:0, dragging:false, dragCorner:null, aspect:S.crop.aspect, moving:false, moveStartX:0, moveStartY:0, moveOrigX:0, moveOrigY:0 };
        drawCropOverlay();
      } else if (S.tool === 'rotate' && S.rotate.previewActive) {
        resetRotatePreview();
        renderAll();
        clearOverlay();
      }
    }
  });

  switchTool('crop');
  // Disable undo/redo buttons initially
  $('btnUndo').classList.add('disabled');
  $('btnRedo').classList.add('disabled');
}

// ==================== RESIZE ====================
window.addEventListener('resize', () => {
  if (S.img) {
    fitImage();
    ctx.clearRect(0, 0, mc.width, mc.height);
    ctx.drawImage(S.img, 0, 0, mc.width, mc.height);
    S.origData = ctx.getImageData(0, 0, mc.width, mc.height);
    S.workData = new ImageData(new Uint8ClampedArray(S.origData.data), mc.width, mc.height);
    ctx.putImageData(S.workData, 0, 0);
    if (S.tool === 'crop') drawCropOverlay();
    else if (S.tool === 'grid') drawGridOverlay();
    updateStatus();
  }
});

init();
```

- [ ] **Step 2: Update index.html — change script tag to module**

In `index.html`, change:
```html
<script src="js/app.js"></script>
```
To:
```html
<script type="module" src="js/main.js"></script>
```

- [ ] **Step 3: Commit**

```bash
git add js/main.js index.html
git commit -m "feat: add main.js wiring, switch to ES modules"
```

---

### Task 13: Add disabled button styles and final polish

**Files:**
- Modify: `css/style.css`

- [ ] **Step 1: Add disabled button styles**

Add after the existing `.btn:disabled` rule (line 263):

```css
.tb-btn.disabled { opacity: 0.35; pointer-events: none; }
```

- [ ] **Step 2: Verify the app loads without errors**

Open `index.html` in a browser (via local server or direct file open since ES modules require a server for cross-origin reasons — or use `file://` which some browsers support for modules).

Actually, ES modules require a server (CORS policy). The visual companion server is already running. Let's verify by navigating to the project.

- [ ] **Step 3: Commit**

```bash
git add css/style.css
git commit -m "feat: add disabled button styles"
```

---

### Task 14: Delete old app.js

**Files:**
- Delete: `js/app.js`

- [ ] **Step 1: Remove the old monolithic file**

```bash
rm js/app.js
```

- [ ] **Step 2: Commit**

```bash
git add js/app.js
git commit -m "refactor: remove old monolithic app.js, replaced by ES modules"
```

---

## Verification Checklist

After all tasks complete:
- [ ] Open index.html via HTTP server — app loads without console errors
- [ ] Drag-drop or click to load an image
- [ ] Crop: draw selection, drag inside to move, drag corners/edges to resize, click outside to deselect, double-click to apply
- [ ] Resize: change dimensions, toggle live preview, apply
- [ ] Grid: adjust rows/cols, drag lines, download ZIP
- [ ] BG Remove: load AI model, remove background, refine edges
- [ ] Rotate: move slider — live preview on canvas, click quick buttons — live preview, press Apply to commit
- [ ] Undo/Redo: toast shows action labels ("Undone: Crop"), buttons gray when unavailable
- [ ] Press `?` — shortcuts panel opens and closes
- [ ] Ctrl+Z, Ctrl+Shift+Z, Ctrl+S, Ctrl+O all work
- [ ] Save dialog: select format, adjust quality for JPEG, save
- [ ] Window resize: canvas adjusts, overlay redraws
