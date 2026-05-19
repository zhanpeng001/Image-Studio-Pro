// @ts-nocheck
import { S } from '../state.js';
import { $ } from '../dom.js';
import { fitImage, renderAll } from '../canvas.js';
import { pushHistory } from '../history.js';
import { toast } from '../ui.js';
import { removeBackground } from '@imgly/background-removal';

export function renderBGPanel(p) {
  const bg = S.bg;
  let html = '<h3>Background Removal</h3>';

  if (!bg.aiLoaded && !bg.aiLoading) {
    html += '<p class="hint">Uses AI neural network running locally in your browser. First load ~15MB (cached after).</p>';
    html += '<button class="btn primary btn-block" id="bgLoad">Download AI Model</button>';
  } else if (bg.aiLoading) {
    html += '<div class="row" style="align-items:center;gap:10px;"><div class="spinner"></div><span>Loading model...</span></div>';
  } else {
    html += '<p style="color:var(--success);font-size:12px;margin-bottom:4px;">AI model ready</p>';
    html += '<button class="btn primary btn-block" id="bgRun">Remove Background</button>';

    html += '<div class="divider"></div>';
    html += '<label><input type="checkbox" id="bgRefine"> Refine result</label>';
    if (bg.refine) {
      html += '<div class="col" style="margin-top:6px;"><label>Edge Tolerance: <span class="val" id="bgTolV">' + bg.tol + '</span></label>';
      html += '<input type="range" id="bgTol" min="1" max="100" value="' + bg.tol + '"></div>';
      html += '<div class="col"><label>Feather: <span class="val" id="bgFeathV">' + bg.feather + 'px</span></label>';
      html += '<input type="range" id="bgFeath" min="0" max="10" value="' + bg.feather + '"></div>';
      html += '<button class="btn btn-block" id="bgRefineApply" style="margin-top:4px;">Apply Refinement</button>';
    }
  }
  p.innerHTML = html;

  const loadBtn = $('bgLoad');
  if (loadBtn) loadBtn.onclick = () => { loadAI(); };
  const runBtn = $('bgRun');
  if (runBtn) runBtn.onclick = () => { runAIBG(); };
  const refChk = $('bgRefine');
  if (refChk) refChk.onchange = () => { bg.refine = refChk.checked; renderBGPanel(p); };
  const tolEl = $('bgTol');
  if (tolEl) tolEl.oninput = () => { bg.tol = +tolEl.value; $('bgTolV').textContent = bg.tol; };
  const feEl = $('bgFeath');
  if (feEl) feEl.oninput = () => { bg.feather = +feEl.value; $('bgFeathV').textContent = bg.feather + 'px'; };
  const refApply = $('bgRefineApply');
  if (refApply) refApply.onclick = () => { refineEdges(); };
}

async function loadAI() {
  S.bg.aiLoading = true;
  document.querySelector('.side-btn[data-tool="bgremove"]').click();
  toast('Loading AI model...');

  try {
    S.bg.aiLoaded = true;
    toast('AI model ready');
  } catch (err) {
    toast('Failed: ' + (err.message || 'Check connection'));
  }
  S.bg.aiLoading = false;
  document.querySelector('.side-btn[data-tool="bgremove"]').click();
}

async function runAIBG() {
  if (!S.bg.aiLoaded) { toast('Load AI model first'); return; }
  pushHistory('BG Remove');
  toast('Processing with AI...');

  try {
    const tmp = document.createElement('canvas');
    tmp.width = S.img.width; tmp.height = S.img.height;
    tmp.getContext('2d').drawImage(S.img, 0, 0);
    const blob = await new Promise(res => tmp.toBlob(res, 'image/png'));
    const resBlob = await removeBackground(blob);
    const url = URL.createObjectURL(resBlob);
    const nimg = new Image();
    nimg.onload = () => {
      S.img = nimg; fitImage(); renderAll();
      URL.revokeObjectURL(url);
      toast('Background removed');
      document.querySelector('.side-btn[data-tool="bgremove"]').click();
    };
    nimg.onerror = () => { toast('Failed to decode result'); URL.revokeObjectURL(url); };
    nimg.src = url;
  } catch (err) {
    toast('Error: ' + (err.message || 'unknown'));
    document.querySelector('.side-btn[data-tool="bgremove"]').click();
  }
}

function refineEdges() {
  const tol = S.bg.tol;
  const feather = S.bg.feather;
  const iw = S.img.width, ih = S.img.height;

  const tmp = document.createElement('canvas');
  tmp.width = iw; tmp.height = ih;
  const tx = tmp.getContext('2d');
  tx.drawImage(S.img, 0, 0);
  const fullData = tx.getImageData(0, 0, iw, ih);
  const newPx = new Uint8ClampedArray(fullData.data);

  for (let py = 0; py < ih; py++) {
    for (let px = 0; px < iw; px++) {
      const idx = (py * iw + px) * 4;
      if (newPx[idx + 3] === 0) continue;

      let atEdge = false;
      outer: for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = px + dx, ny = py + dy;
          if (nx >= 0 && nx < iw && ny >= 0 && ny < ih) {
            if (fullData.data[(ny * iw + nx) * 4 + 3] < 10) { atEdge = true; break outer; }
          }
        }
      }

      if (atEdge && feather > 0) {
        let tCount = 0, total = 0;
        for (let dy = -feather; dy <= feather; dy++) {
          for (let dx = -feather; dx <= feather; dx++) {
            const nx = px + dx, ny = py + dy;
            if (nx >= 0 && nx < iw && ny >= 0 && ny < ih) {
              total++;
              if (fullData.data[(ny * iw + nx) * 4 + 3] < 10) tCount++;
            }
          }
        }
        const frac = 1 - (tCount / Math.max(1, total));
        newPx[idx + 3] = Math.round(newPx[idx + 3] * Math.pow(frac, tol / 50));
      }
    }
  }

  tx.putImageData(new ImageData(newPx, iw, ih), 0, 0);

  const nimg = new Image();
  nimg.onload = () => {
    S.img = nimg;
    fitImage(); renderAll();
    toast('Edges refined');
    document.querySelector('.side-btn[data-tool="bgremove"]').click();
  };
  nimg.src = tmp.toDataURL('image/png');
}
