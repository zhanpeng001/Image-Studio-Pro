import { S, resetRotatePreview } from '../state.js';
import { $ } from '../dom.js';
import { fitImage, renderAll, renderRotatePreview } from '../canvas.js';
import { pushHistory } from '../history.js';
import { toast } from '../ui.js';

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

  $('rotCCW').onclick = () => { startLivePreview(-90); };
  $('rotCW').onclick = () => { startLivePreview(90); };
  $('rot180').onclick = () => { startLivePreview(180); };

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
