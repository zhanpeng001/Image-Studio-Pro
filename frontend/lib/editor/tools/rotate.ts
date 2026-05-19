// @ts-nocheck
import { S, resetRotatePreview } from '../state.js';
import { $ } from '../dom.js';
import { fitImage, renderAll, renderRotatePreview } from '../canvas.js';
import { pushHistory } from '../history.js';
import { toast } from '../ui.js';

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
  $('flipH').onclick = flipH;
  $('flipV').onclick = flipV;
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

export function commitRotation() {
  let deg = S.rotate.previewAngle;
  if (!S.rotate.previewActive) {
    const slider = $('angSlider');
    deg = slider ? +slider.value : 0;
  }
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
