// @ts-nocheck
import { S, resetRotatePreview } from '../state.js';
import { $ } from '../dom.js';
import { fitImage, renderAll, renderRotatePreview } from '../canvas.js';
import { pushHistory } from '../history.js';
import { toast } from '../ui.js';
import { triggerDownload } from '../utils.js';
import JSZip from 'jszip';

const COMMON_ANGLES = [-180, -90, -45, 0, 45, 90, 180];
const SNAP_THRESHOLD = 3;

function snapAngle(deg) {
  for (const a of COMMON_ANGLES) {
    if (Math.abs(deg - a) <= SNAP_THRESHOLD) return a;
  }
  return deg;
}

export function renderRotatePanel(p) {
  const currentAngle = S.rotate.previewActive ? S.rotate.previewAngle : 0;
  const snapshotCount = S.rotate.snapshots.length;
  p.innerHTML = `
    <h3>Rotate & Flip</h3>
    <div class="col"><label>Quick Presets</label>
      <div class="presets" id="rotPresets">
        <span class="preset" data-deg="90">90&deg; CW</span>
        <span class="preset" data-deg="-90">90&deg; CCW</span>
        <span class="preset" data-deg="180">180&deg;</span>
        <span class="preset" data-deg="45">45&deg; CW</span>
        <span class="preset" data-deg="-45">45&deg; CCW</span>
        <span class="preset" data-deg="0">Reset 0&deg;</span>
      </div>
    </div>
    <div class="divider"></div>
    <div class="col"><label>Fine Tune</label>
      <div class="row">
        <button class="btn btn-sm" id="rotN1">-1&deg;</button>
        <button class="btn btn-sm" id="rotN01">-0.1&deg;</button>
        <button class="btn btn-sm" id="rotP01">+0.1&deg;</button>
        <button class="btn btn-sm" id="rotP1">+1&deg;</button>
      </div>
    </div>
    <div class="divider"></div>
    <div class="col"><label>Custom Angle</label>
      <div class="row" style="align-items:center;">
        <input type="range" id="angSlider" min="-180" max="180" value="${currentAngle}" style="flex:1;">
        <input type="number" id="angInput" value="${currentAngle}" style="width:62px;text-align:center;" step="0.1">
        <span style="font-size:13px;color:var(--text2);">deg</span>
      </div>
    </div>
    <button class="btn primary btn-block" id="rotApply">Apply Rotation</button>
    <button class="btn btn-block" id="rotSaveSnapshot">Save Snapshot</button>
    <div class="rotate-snapshot-strip">
      <div>
        <strong>${snapshotCount}</strong>
        <span>${snapshotCount === 1 ? 'saved angle' : 'saved angles'}</span>
      </div>
      <div class="rotate-snapshot-actions">
        <button class="btn btn-sm" id="rotClearAll" ${snapshotCount === 0 ? 'disabled' : ''}>Clear</button>
        <button class="btn btn-sm" id="rotDownloadAll" ${snapshotCount === 0 ? 'disabled' : ''}>Download All</button>
      </div>
    </div>
    <div class="rotate-snapshot-list" id="rotSnapshotList">
      ${renderSnapshotList()}
    </div>
    <div class="divider"></div>
    <div class="col"><label>Flip</label>
      <div class="row">
        <button class="btn btn-block btn-sm" id="flipH">Flip Horizontal</button>
        <button class="btn btn-block btn-sm" id="flipV">Flip Vertical</button>
      </div>
    </div>
  `;

  // Quick presets
  const presetsEl = $('rotPresets');
  if (presetsEl) {
    presetsEl.addEventListener('click', e => {
      const pr = e.target.closest('.preset');
      if (!pr) return;
      const deg = +pr.dataset.deg;
      setAngle(deg);
    });
  }

  // Fine tune buttons
  $('rotN1').onclick = () => adjustAngle(-1);
  $('rotN01').onclick = () => adjustAngle(-0.1);
  $('rotP01').onclick = () => adjustAngle(0.1);
  $('rotP1').onclick = () => adjustAngle(1);

  // Slider
  $('angSlider').oninput = () => {
    const raw = +$('angSlider').value;
    const snapped = snapAngle(raw);
    $('angInput').value = snapped;
    startLivePreview(snapped);
  };
  $('angSlider').onchange = () => {
    // On release, snap to common angle
    const raw = +$('angSlider').value;
    const snapped = snapAngle(raw);
    $('angSlider').value = snapped;
    $('angInput').value = snapped;
    startLivePreview(snapped);
  };

  // Numeric input
  $('angInput').oninput = () => {
    const v = parseFloat($('angInput').value);
    if (isNaN(v)) return;
    const clamped = Math.max(-180, Math.min(180, v));
    $('angSlider').value = clamped;
    startLivePreview(clamped);
  };
  $('angInput').onchange = () => {
    const v = parseFloat($('angInput').value);
    if (isNaN(v)) { $('angInput').value = 0; $('angSlider').value = 0; return; }
    const clamped = Math.max(-180, Math.min(180, v));
    $('angInput').value = clamped;
    $('angSlider').value = clamped;
    startLivePreview(clamped);
  };

  $('rotApply').onclick = commitRotation;
  $('rotSaveSnapshot').onclick = () => saveRotationSnapshot(p);
  $('rotClearAll').onclick = () => clearRotationSnapshots(p);
  $('rotDownloadAll').onclick = downloadRotationSnapshots;
  $('flipH').onclick = flipH;
  $('flipV').onclick = flipV;

  const list = $('rotSnapshotList');
  if (list) {
    list.addEventListener('click', e => {
      const btn = e.target.closest('[data-delete-snapshot]');
      if (!btn) return;
      deleteRotationSnapshot(+btn.dataset.deleteSnapshot, p);
    });
  }
}

function renderSnapshotList() {
  if (S.rotate.snapshots.length === 0) {
    return '<div class="rotate-snapshot-empty">Saved snapshots will appear here.</div>';
  }
  return S.rotate.snapshots.map((snap, idx) => `
    <div class="rotate-snapshot-item">
      <img src="${snap.dataURL}" alt="">
      <div class="rotate-snapshot-meta">
        <strong>Snapshot ${idx + 1}</strong>
        <span>${formatAngle(snap.angle)}&deg; &middot; ${snap.width}x${snap.height}</span>
      </div>
      <button class="btn btn-icon danger" data-delete-snapshot="${snap.id}" title="Delete snapshot" aria-label="Delete snapshot">&times;</button>
    </div>
  `).join('');
}

function setAngle(deg) {
  $('angSlider').value = deg;
  $('angInput').value = deg;
  startLivePreview(deg);
}

function adjustAngle(delta) {
  let current = S.rotate.previewActive ? S.rotate.previewAngle : 0;
  current = Math.round((current + delta) * 10) / 10; // avoid floating point issues
  current = Math.max(-180, Math.min(180, current));
  setAngle(current);
}

function startLivePreview(deg) {
  S.rotate.previewActive = true;
  S.rotate.previewAngle = deg;
  renderRotatePreview(deg);
}

function getCurrentAngle() {
  if (S.rotate.previewActive) return S.rotate.previewAngle;
  const input = $('angInput');
  if (!input) return 0;
  const deg = parseFloat(input.value);
  return Number.isFinite(deg) ? Math.max(-180, Math.min(180, deg)) : 0;
}

function formatAngle(deg) {
  return Number.isInteger(deg) ? String(deg) : String(Math.round(deg * 10) / 10);
}

export function commitRotation() {
  let deg = getCurrentAngle();
  resetRotatePreview();
  applyRotation(deg);
}

function renderRotatedCanvas(deg) {
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
  return tmp;
}

function applyRotation(deg) {
  if (!S.img) return;
  pushHistory('Rotate ' + deg + '\u00B0');
  const tmp = renderRotatedCanvas(deg);

  const nimg = new Image();
  nimg.onload = () => { S.img = nimg; fitImage(); renderAll(); toast('Rotated ' + deg + '\u00B0'); };
  nimg.src = tmp.toDataURL('image/png');
}

function saveRotationSnapshot(p) {
  if (!S.img) return;
  const deg = getCurrentAngle();
  const tmp = renderRotatedCanvas(deg);
  S.rotate.snapshots.push({
    id: S.rotate.nextSnapshotId++,
    angle: deg,
    width: tmp.width,
    height: tmp.height,
    dataURL: tmp.toDataURL('image/png'),
    createdAt: Date.now(),
  });
  renderRotatePanel(p);
  toast('Snapshot saved: ' + formatAngle(deg) + '\u00B0');
}

function deleteRotationSnapshot(id, p) {
  const before = S.rotate.snapshots.length;
  S.rotate.snapshots = S.rotate.snapshots.filter(s => s.id !== id);
  if (S.rotate.snapshots.length !== before) {
    renderRotatePanel(p);
    toast('Snapshot deleted');
  }
}

function clearRotationSnapshots(p) {
  if (S.rotate.snapshots.length === 0) return;
  S.rotate.snapshots = [];
  renderRotatePanel(p);
  toast('Snapshots cleared');
}

async function downloadRotationSnapshots() {
  if (S.rotate.snapshots.length === 0) {
    toast('No snapshots to download');
    return;
  }

  toast('Building ZIP with ' + S.rotate.snapshots.length + ' snapshots...');
  const zip = new JSZip();
  const baseName = S.fname.replace(/\.[^.]+$/, '') || 'image';

  S.rotate.snapshots.forEach((snap, idx) => {
    const angle = formatAngle(snap.angle).replace('-', 'neg').replace('.', 'p');
    const b64 = snap.dataURL.split(',')[1];
    zip.file(baseName + '_rotate_' + String(idx + 1).padStart(2, '0') + '_' + angle + 'deg.png', b64, { base64: true });
  });

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  triggerDownload(blob, baseName + '_rotation_snapshots.zip');
  toast('ZIP downloaded: ' + S.rotate.snapshots.length + ' snapshots');
}

export function applyRotationFromKeyboard() {
  if (S.tool === 'rotate' && S.rotate.previewActive) {
    commitRotation();
  }
}

function flipH() {
  if (!S.img) return;
  if (S.rotate.previewActive) resetRotatePreview();
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
  if (S.rotate.previewActive) resetRotatePreview();
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
