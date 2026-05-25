// @ts-nocheck
import { S } from './state.js';
import { fitImage, renderAll } from './canvas.js';
import { drawCropOverlay, drawGridOverlay } from './overlay.js';
import { updateStatus, toast } from './ui.js';
import { canvasFromImage } from './utils.js';

function snapshot(label) {
  const tmp = canvasFromImage(S.img);
  return {
    dataURL: tmp.toDataURL('image/png'),
    w: S.img.width,
    h: S.img.height,
    label: label || 'Edit'
  };
}

export function pushHistory(label) {
  S.history = S.history.slice(0, S.histIdx + 1);
  S.redoHistory = [];
  S.history.push(snapshot(label));
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
  if (S.histIdx < 0) return;
  const label = S.history[S.histIdx].label;
  S.redoHistory.push(snapshot(label));
  restoreFromHistory(S.histIdx);
  S.histIdx--;
  toast('Undone: ' + label);
}

export function redo() {
  if (S.redoHistory.length === 0) return;
  S.histIdx++;
  const entry = S.redoHistory.pop();
  const label = entry.label;
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
  toast('Redone: ' + label);
}

export function updateUndoRedoButtons() {
  const btnUndo = document.getElementById('btnUndo');
  const btnRedo = document.getElementById('btnRedo');
  if (btnUndo) btnUndo.classList.toggle('disabled', S.histIdx < 0);
  if (btnRedo) btnRedo.classList.toggle('disabled', S.redoHistory.length === 0);
}
