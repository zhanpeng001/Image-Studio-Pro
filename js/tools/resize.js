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
  ctx.clearRect(0, 0, mc.width, mc.height);
  ctx.drawImage(tmp, 0, 0, mc.width, mc.height);
  S.origData = ctx.getImageData(0, 0, mc.width, mc.height);
  S.workData = new ImageData(new Uint8ClampedArray(S.origData.data), mc.width, mc.height);
}
