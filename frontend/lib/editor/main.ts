// @ts-nocheck
import { S, resetRotatePreview } from './state.js';
import { $, refreshDomBindings, mc, oc, ctx, panel, dropzone, canvasWrap, canvasArea, statusTool, saveModal } from './dom.js';
import { fitImage, renderAll, renderRotatePreview } from './canvas.js';
import { undo, redo, updateUndoRedoButtons } from './history.js';
import { clearOverlay, drawCropOverlay, drawGridOverlay } from './overlay.js';
import { toast, updateStatus, setupKeys, setupShortcutsPanel, setupSaveModal, openSaveDialog } from './ui.js';
import { renderCropPanel, setupCropEvents, cleanupCropEvents, applyCropFromKeyboard } from './tools/crop.js';
import { renderScalePanel } from './tools/scale.js';
import { renderGridPanel, setupGridEvents } from './tools/grid.js';
import { renderBGPanel } from './tools/bgremove.js';
import { renderRotatePanel, commitRotation, applyRotationFromKeyboard } from './tools/rotate.js';
import { renderCompressorPanel } from './tools/compressor.js';
import { renderCanvaPanel, cleanupCanvaEvents, canvaMergeAll, canvaDeselect, canvaRemoveLayer, canvaFitZoom, canvaActualZoom, canvaHandleResize } from './tools/canva.js';

let initialized = false;
let cleanupEditor = () => {};
let initAbortController = null;

// ==================== TOOL SWITCHING ====================
const toolPanels = {
  crop: renderCropPanel,
  resize: renderScalePanel,
  grid: renderGridPanel,
  bgremove: renderBGPanel,
  rotate: renderRotatePanel,
  compressor: renderCompressorPanel,
  canva: renderCanvaPanel
};

const toolStatusLabels = {
  crop: 'Crop',
  resize: 'Scale',
  grid: 'Grid Split',
  bgremove: 'BG Remove',
  rotate: 'Rotate & Flip',
  compressor: 'Compressor',
  canva: 'Canva'
};

const lockedToolPreviews = {
  crop: `
    <div class="col"><label>Aspect Ratio</label><div class="presets"><span class="preset active">Free</span><span class="preset">1:1</span><span class="preset">16:9</span><span class="preset">Custom</span></div></div>
    <div class="col"><label>Output Size</label><div class="row"><input type="number" value="1920" disabled><input type="number" value="1080" disabled></div></div>
    <button class="btn primary btn-block" disabled>Apply Crop</button>
    <button class="btn btn-block" disabled>Resize Full Image</button>
  `,
  resize: `
    <div class="col"><label>Scale Presets</label><div class="presets"><span class="preset">25%</span><span class="preset">50%</span><span class="preset active">100%</span><span class="preset">200%</span></div></div>
    <div class="col"><label>Dimensions</label><div class="row"><input type="number" value="1920" disabled><input type="number" value="1080" disabled></div></div>
    <button class="btn primary btn-block" disabled>Apply Scale</button>
  `,
  grid: `
    <div class="col"><label>Rows: <span class="val">3</span></label><input type="range" value="3" disabled></div>
    <div class="col"><label>Columns: <span class="val">3</span></label><input type="range" value="3" disabled></div>
    <p class="hint">Grid split controls unlock after an image is loaded.</p>
    <button class="btn primary btn-block" disabled>Download All Cells as ZIP</button>
  `,
  bgremove: `
    <div class="col"><label>AI Model</label><select disabled><option>High quality foreground model</option></select></div>
    <div class="col"><label>Refinement</label><input type="range" value="30" disabled></div>
    <button class="btn primary btn-block" disabled>Remove Background</button>
  `,
  rotate: `
    <div class="col"><label>Quick Presets</label><div class="presets"><span class="preset">90&deg; CW</span><span class="preset">90&deg; CCW</span><span class="preset">180&deg;</span></div></div>
    <div class="col"><label>Custom Angle</label><div class="row"><input type="range" value="0" disabled><input type="number" value="0" disabled></div></div>
    <button class="btn primary btn-block" disabled>Apply Rotation</button>
    <button class="btn btn-block" disabled>Save Snapshot</button>
  `,
  compressor: `
    <div class="col"><label>Quality</label><div class="presets"><span class="preset">Small</span><span class="preset active">Balanced</span><span class="preset">Best</span></div></div>
    <div class="col"><label>Format</label><select disabled><option>WebP</option></select></div>
    <button class="btn primary btn-block" disabled>Preview Compression</button>
  `,
  canva: `
    <div class="col"><label>Layers</label><div class="locked-layer-row"><span>Background</span><span>locked</span></div><div class="locked-layer-row"><span>Layer 1</span><span>preview</span></div></div>
    <button class="btn primary btn-block" disabled>Add Layer</button>
    <button class="btn btn-block" disabled>Merge All & Flatten</button>
  `
};

function renderLockedToolPanel(tool) {
  const title = toolStatusLabels[tool] || 'Tool';
  const preview = lockedToolPreviews[tool] || lockedToolPreviews.crop;
  panel.innerHTML = `
    <div class="locked-panel">
      <div class="locked-panel-preview" aria-hidden="true">
        <h3>${title}</h3>
        ${preview}
      </div>
      <div class="locked-panel-overlay">
        <div class="locked-panel-card">
          <span class="locked-panel-kicker">Image required</span>
          <strong>Load an image to enable tools</strong>
          <p>The controls are ready. Open a file to start editing.</p>
          <button class="btn primary btn-block" id="lockedOpenImage">Open Image</button>
        </div>
      </div>
    </div>
  `;
  const openBtn = document.getElementById('lockedOpenImage');
  if (openBtn) openBtn.onclick = () => $('btnOpen').click();
}

function drawCheckerboard() {
  const size = 16;
  for (let y = 0; y < mc.height; y += size) {
    for (let x = 0; x < mc.width; x += size) {
      ctx.fillStyle = ((x / size + y / size) % 2 === 0) ? '#eee' : '#fff';
      ctx.fillRect(x, y, size, size);
    }
  }
}

function switchTool(tool) {
  // Discard uncommitted tool previews and restore canvas when switching tools
  const changingTool = S.tool !== tool;
  if (S.tool === 'rotate' && S.rotate.previewActive) {
    resetRotatePreview();
  }
  if (S.tool === 'crop') {
    S.crop.dragging = false;
    S.crop.moving = false;
    cleanupCropEvents();
  }
  if (S.tool === 'grid') {
    S.grid.drag = null;
  }
  if (S.tool === 'canva') {
    cleanupCanvaEvents();
  }

  if (S.img && changingTool) {
    if (tool === 'canva') {
      // Canva draws all layers (including base) on overlay canvas — clear main canvas
      ctx.clearRect(0, 0, mc.width, mc.height);
      drawCheckerboard();
    } else if (S.tool === 'canva') {
      // Leaving canva — restore base image on main canvas
      S.canva.layers = [];
      S.canva.selectedIdx = -1;
      S.canva.zoom = 1;
      S.canva.workspaceW = 0;
      S.canva.workspaceH = 0;
      cleanupCanvaEvents();
      canvasArea.style.overflow = 'hidden';
      canvasArea.style.alignItems = 'center';
      canvasArea.style.justifyContent = 'center';
      fitImage();
      renderAll();
    } else {
      renderAll();
    }
  }

  S.tool = tool;
  document.querySelectorAll('.side-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tool === tool);
  });
  clearOverlay();

  statusTool.textContent = toolStatusLabels[tool] || tool;

  if (!S.img) {
    renderLockedToolPanel(tool);
  } else {
    const fn = toolPanels[tool];
    if (fn) fn(panel);
  }

  setupCanvasEvents();
}

function setupCanvasEvents() {
  ['onmousedown','onmousemove','onmouseup','onmouseleave','ondblclick'].forEach(k => { oc[k] = null; });
  oc.style.cursor = 'default';
  if (!S.img) return;
  if (S.tool === 'crop') setupCropEvents();
  else if (S.tool === 'grid') setupGridEvents();
}

// ==================== UPLOAD ====================
function openFileDialog() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.style.display = 'none';
  document.body.appendChild(input);
  input.addEventListener('change', e => {
    const f = e.target.files[0];
    if (f) loadFile(f);
    input.remove();
  });
  input.click();
}

function setupUpload(signal) {
  const dz = dropzone;

  dz.addEventListener('click', () => openFileDialog(), { signal });
  $('btnOpen').addEventListener('click', () => openFileDialog(), { signal });

  let cnt = 0;
  canvasArea.addEventListener('dragenter', e => { e.preventDefault(); cnt++; dz.style.display = 'flex'; }, { signal });
  canvasArea.addEventListener('dragleave', () => { cnt--; if (cnt <= 0) { cnt = 0; if (S.img) dz.style.display = 'none'; } }, { signal });
  canvasArea.addEventListener('dragover', e => e.preventDefault(), { signal });
  canvasArea.addEventListener('drop', e => { e.preventDefault(); cnt = 0; const f = e.dataTransfer.files[0]; if (f) loadFile(f); }, { signal });
}

function loadFile(file) {
  if (!file.type.startsWith('image/')) return toast('Not an image file');
  S.fname = file.name.replace(/\.[^.]+$/, '') + '.png';
  S.history = []; S.redoHistory = []; S.histIdx = -1; updateUndoRedoButtons();
  S.grid.hLines = []; S.grid.vLines = []; S.grid.hCh = false; S.grid.vCh = false;
  S.crop = { x:0, y:0, w:0, h:0, dragging:false, dragCorner:null, aspect:null, moving:false, moveStartX:0, moveStartY:0, moveOrigX:0, moveOrigY:0 };
  S.canva.layers = []; S.canva.selectedIdx = -1; S.canva.workspaceW = 0; S.canva.workspaceH = 0;
  S.rotate.angle = 0;
  S.rotate.snapshots = [];
  S.rotate.nextSnapshotId = 1;
  resetRotatePreview();

  const r = new FileReader();
  r.onload = e => {
    const img = new Image();
    img.onload = () => {
      S.img = img; S.origImg = img;
      fitImage();
      if (S.tool === 'canva') {
        ctx.clearRect(0, 0, mc.width, mc.height);
        drawCheckerboard();
      } else {
        renderAll();
      }
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
function setupSidebar(signal) {
  document.querySelector('.sidebar').addEventListener('click', e => {
    const btn = e.target.closest('.side-btn');
    if (!btn) return;
    switchTool(btn.dataset.tool);
  }, { signal });
}

// ==================== TOPBAR ====================
function setupTopbar(signal) {
  $('btnUndo').addEventListener('click', undo, { signal });
  $('btnRedo').addEventListener('click', redo, { signal });
  $('btnSave').addEventListener('click', openSaveDialog, { signal });
  $('btnFit').addEventListener('click', () => {
    if (!S.img) return;
    if (S.rotate.previewActive) resetRotatePreview();
    if (S.tool === 'canva') {
      canvaFitZoom();
    } else {
      fitImage(); renderAll();
    }
  }, { signal });
  $('btnActual').addEventListener('click', () => {
    if (!S.img) return;
    if (S.rotate.previewActive) resetRotatePreview();
    if (S.tool === 'canva') {
      canvaActualZoom();
    } else {
      S.viewW = S.img.width; S.viewH = S.img.height; S.zoom = 1;
      mc.width = S.img.width; mc.height = S.img.height;
      oc.width = S.img.width; oc.height = S.img.height;
      mc.style.width = S.img.width + 'px'; mc.style.height = S.img.height + 'px';
      oc.style.width = S.img.width + 'px'; oc.style.height = S.img.height + 'px';
      renderAll();
    }
  }, { signal });
}

function handleToolKeys(e) {
  const shortcutsOv = document.getElementById('shortcutsOverlay');
  // Escape closes any open modal/overlay first
  if (e.key === 'Escape' && !e.ctrlKey && !e.metaKey) {
    if (shortcutsOv && shortcutsOv.style.display === 'flex') { shortcutsOv.style.display = 'none'; e.preventDefault(); return; }
    if (saveModal.style.display === 'flex') { saveModal.style.display = 'none'; e.preventDefault(); return; }
  }
  if (!S.img) return;
  // Don't fire tool shortcuts when a modal or overlay is open
  if (saveModal.style.display === 'flex') return;
  if (shortcutsOv && shortcutsOv.style.display === 'flex') return;
  if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && document.activeElement === document.body) {
    e.preventDefault();
    if (S.tool === 'crop') applyCropFromKeyboard();
    else if (S.tool === 'rotate') applyRotationFromKeyboard();
    else if (S.tool === 'canva') canvaMergeAll();
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
    } else if (S.tool === 'canva') {
      if (e.key === 'Escape') canvaDeselect();
      else if (e.key === 'Delete') canvaRemoveLayer();
    }
  }
}

// ==================== INIT ====================
function init(signal) {
  setupUpload(signal);
  setupSidebar(signal);
  setupTopbar(signal);
  setupSaveModal(signal);
  setupShortcutsPanel(signal);
  setupKeys(undo, redo, openSaveDialog, openFileDialog, signal);

  // Tool-specific keyboard keys (Enter, Escape, Delete)
  document.addEventListener('keydown', handleToolKeys, { signal });

  switchTool('crop');
  $('btnUndo').classList.add('disabled');
  $('btnRedo').classList.add('disabled');
}

function restoreMountedImage() {
  dropzone.style.display = 'none';
  canvasWrap.style.display = 'block';
  fitImage();
  if (S.rotate.previewActive) {
    renderRotatePreview(S.rotate.previewAngle);
  } else if (S.tool === 'canva') {
    ctx.clearRect(0, 0, mc.width, mc.height);
    drawCheckerboard();
  } else {
    renderAll();
  }
  updateStatus();
  updateUndoRedoButtons();
  switchTool(S.tool);
}

function handleResize() {
  if (S.img) {
    fitImage();
    if (S.rotate.previewActive) {
      renderRotatePreview(S.rotate.previewAngle);
    } else if (S.tool === 'canva') {
      ctx.clearRect(0, 0, mc.width, mc.height);
      drawCheckerboard();
      canvaHandleResize();
    } else {
      ctx.clearRect(0, 0, mc.width, mc.height);
      ctx.drawImage(S.img, 0, 0, mc.width, mc.height);
      S.origData = ctx.getImageData(0, 0, mc.width, mc.height);
      S.workData = new ImageData(new Uint8ClampedArray(S.origData.data), mc.width, mc.height);
    }
    if (S.tool === 'crop') drawCropOverlay();
    else if (S.tool === 'grid') drawGridOverlay();
    updateStatus();
  }
}

export function initEditor() {
  if (initialized) {
    return cleanupEditor;
  }

  refreshDomBindings();
  initAbortController = new AbortController();
  const { signal } = initAbortController;
  initialized = true;
  window.addEventListener('resize', handleResize);
  init(signal);
  if (S.img) {
    restoreMountedImage();
  }
  cleanupEditor = () => {
    if (!initialized) return;
    cleanupCropEvents();
    initAbortController?.abort();
    window.removeEventListener('resize', handleResize);
    document.getElementById('shortcutsOverlay')?.remove();
    ['onmousedown','onmousemove','onmouseup','onmouseleave','ondblclick'].forEach(k => { oc[k] = null; });
    initialized = false;
    initAbortController = null;
  };
  return cleanupEditor;
}
