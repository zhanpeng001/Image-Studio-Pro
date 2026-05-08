import { S, resetRotatePreview } from './state.js';
import { $, mc, oc, ctx, octx, panel, dropzone, canvasWrap, fileInput, canvasArea, statusTool } from './dom.js';
import { fitImage, renderAll } from './canvas.js';
import { undo, redo } from './history.js';
import { clearOverlay, drawCropOverlay, drawGridOverlay } from './overlay.js';
import { toast, updateStatus, setupKeys, setupShortcutsPanel, setupSaveModal, openSaveDialog } from './ui.js';
import { renderCropPanel, setupCropEvents, cleanupCropEvents, applyCropFromKeyboard } from './tools/crop.js';
import { renderResizePanel } from './tools/resize.js';
import { renderGridPanel, setupGridEvents } from './tools/grid.js';
import { renderBGPanel } from './tools/bgremove.js';
import { renderRotatePanel, commitRotation, applyRotationFromKeyboard } from './tools/rotate.js';

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
  // Discard uncommitted rotate preview
  if (S.tool === 'rotate' && S.rotate.previewActive) {
    resetRotatePreview();
  }
  // Cleanup old tool events and reset drag state
  if (S.tool === 'crop') {
    S.crop.dragging = false;
    S.crop.moving = false;
    cleanupCropEvents();
  }

  S.tool = tool;
  document.querySelectorAll('.side-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tool === tool);
  });
  clearOverlay();

  statusTool.textContent = toolStatusLabels[tool] || tool;

  if (!S.img) {
    panel.innerHTML = '<div class="panel-empty"><p>Load an image to start editing</p></div>';
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
      if (S.rotate.previewActive) resetRotatePreview();
      fitImage(); renderAll(); switchTool(S.tool);
    }
  });
  $('btnActual').addEventListener('click', () => {
    if (!S.img) return;
    if (S.rotate.previewActive) resetRotatePreview();
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

  // Tool-specific keyboard keys (Enter, Escape, Delete)
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
  $('btnUndo').classList.add('disabled');
  $('btnRedo').classList.add('disabled');
}

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
