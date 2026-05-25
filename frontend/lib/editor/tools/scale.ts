import { S } from '../state.js';
import { $, mc, ctx } from '../dom.js';
import { fitImage, renderAll } from '../canvas.js';
import { pushHistory } from '../history.js';
import { toast } from '../ui.js';
import { smartResize } from '../lanczos.js';
import { canvasFromImage, loadImageFromCanvas } from '../utils.js';

const SCALE_PRESETS = [25, 50, 75, 150, 200, 400];

export function renderScalePanel(p: HTMLElement) {
  S.resize.pct = 100;

  p.innerHTML = `
    <h3>Scale Image</h3>
    <div class="col"><label>Percentage</label>
      <div class="row" style="align-items:center;">
        <input type="range" id="scalePct" min="1" max="400" value="100" style="flex:1;">
        <span class="val" id="scalePctVal" style="min-width:42px;">100%</span>
      </div>
    </div>
    <div class="divider"></div>
    <label>Quick Presets</label>
    <div class="presets" id="scalePresets">
      ${SCALE_PRESETS.map(p => `<span class="preset" data-pct="${p}">${p}%</span>`).join('')}
    </div>
    <label><input type="checkbox" id="scaleLive"> Live preview on canvas</label>
    <button class="btn primary btn-block" id="scaleApply">Apply Scale</button>
  `;

  const slider = $('scalePct');
  const pctVal = $('scalePctVal');

  const doLive = () => $('scaleLive').checked;

  slider.addEventListener('input', () => {
    if (!S.img) return;
    const p = +slider.value;
    pctVal.textContent = p + '%';
    if (doLive()) {
      const w = Math.round(S.img.width * p / 100);
      const h = Math.round(S.img.height * p / 100);
      renderLivePreview(w, h);
    }
  });

  $('scaleLive').addEventListener('change', () => {
    if (!S.img) return;
    if (doLive()) {
      const p = +slider.value;
      const w = Math.round(S.img.width * p / 100);
      const h = Math.round(S.img.height * p / 100);
      renderLivePreview(w, h);
    } else {
      renderAll();
    }
  });

  const presetsEl = $('scalePresets');
  presetsEl.addEventListener('click', e => {
    if (!S.img) return;
    const pr = (e.target as HTMLElement).closest('.preset');
    if (!pr) return;
    const p = +(pr as HTMLElement).dataset.pct!;
    slider.value = String(p);
    pctVal.textContent = p + '%';
    const w = Math.round(S.img.width * p / 100);
    const h = Math.round(S.img.height * p / 100);
    if (doLive()) renderLivePreview(w, h);
  });

  $('scaleApply').addEventListener('click', () => {
    if (!S.img) return;
    const p = +slider.value;
    applyScale(p);
  });
}

function renderLivePreview(w: number, h: number) {
  if (!S.img) return;
  const tmp = document.createElement('canvas');
  tmp.width = w; tmp.height = h;
  tmp.getContext('2d')!.drawImage(S.img, 0, 0, w, h);
  ctx.clearRect(0, 0, mc.width, mc.height);
  ctx.drawImage(tmp, 0, 0, mc.width, mc.height);
}

async function applyScale(pct: number) {
  if (!S.img) return;
  pushHistory('Scale ' + pct + '%');
  const w = Math.round(S.img.width * pct / 100);
  const h = Math.round(S.img.height * pct / 100);

  const src = canvasFromImage(S.img!);

  const result = pct < 100 ? smartResize(src, w, h) : (() => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    c.getContext('2d')!.drawImage(S.img!, 0, 0, w, h);
    return c;
  })();

  S.img = await loadImageFromCanvas(result);
  fitImage(); renderAll();
  toast('Scaled to ' + w + 'x' + h);
}
