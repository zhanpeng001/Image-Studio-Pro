// @ts-nocheck
import { S } from './state.js';
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

export function updateUndoRedoButtons() {
  const btnUndo = document.getElementById('btnUndo');
  const btnRedo = document.getElementById('btnRedo');
  if (btnUndo) btnUndo.classList.toggle('disabled', S.histIdx < 0);
  if (btnRedo) btnRedo.classList.toggle('disabled', S.histIdx >= S.history.length - 1);
}
