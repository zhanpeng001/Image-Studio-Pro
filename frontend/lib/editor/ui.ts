// @ts-nocheck
import { S } from './state.js';
import { $, imageInfo, statusDim, statusZoom, saveModal } from './dom.js';
import { triggerDownload } from './utils.js';

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

// ==================== KEYBOARD SHORTCUTS PANEL ====================
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

export function setupShortcutsPanel(signal) {
  document.getElementById('shortcutsOverlay')?.remove();
  const overlay = document.createElement('div');
  overlay.id = 'shortcutsOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:999;display:none;align-items:center;justify-content:center;';
  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.style.display = 'none';
  }, { signal });

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
let _undoFn, _redoFn, _saveFn, _openFn;

export function setupKeys(undoFn, redoFn, saveFn, openFn, signal) {
  _undoFn = undoFn; _redoFn = redoFn; _saveFn = saveFn; _openFn = openFn;

  document.addEventListener('keydown', e => {
    // Shortcuts panel toggle
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
    else if (e.ctrlKey && e.key === 'o') { e.preventDefault(); if (_openFn) _openFn(); }
  }, { signal });
}

// ==================== SAVE MODAL ====================
export function setupSaveModal(signal) {
  const saveCancel = $('saveCancel');
  const saveConfirm = $('saveConfirm');
  const saveFormat = $('saveFormat');
  const saveFilename = $('saveFilename');

  saveCancel.addEventListener('click', () => { saveModal.style.display = 'none'; }, { signal });
  saveModal.addEventListener('click', e => { if (e.target === saveModal) saveModal.style.display = 'none'; }, { signal });

  saveConfirm.addEventListener('click', () => {
    const fmt = saveFormat.value;
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

    tmp.toBlob(blob => {
      triggerDownload(blob, dlName);
    }, mime, fmt === 'png' ? undefined : 0.92);

    saveModal.style.display = 'none';
    toast('Saved: ' + dlName);
  }, { signal });
}

export function openSaveDialog() {
  if (!S.img) { toast('No image to save'); return; }
  const saveFilename = $('saveFilename');
  const saveFormat = $('saveFormat');
  saveFilename.value = S.fname;
  saveFormat.value = 'png';
  saveModal.style.display = 'flex';
}
