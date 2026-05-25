import { S } from '../state.js';
import { $, optional$ } from '../dom.js';
import { fitImage, renderAll } from '../canvas.js';
import { pushHistory } from '../history.js';
import { toast } from '../ui.js';
import { canvasFromImage, loadImageFromCanvas } from '../utils.js';
import { removeBackground } from '@imgly/background-removal';

const MODEL_LABELS = {
  isnet_quint8: 'Fast (lower quality)',
  isnet_fp16: 'Balanced (recommended)',
  isnet: 'Quality (slowest)',
};

export function renderBGPanel(p: HTMLElement) {
  const bg = S.bg;
  let html = '<h3>Background Removal</h3>';

  if (!bg.aiLoaded && !bg.aiLoading) {
    html += '<p class="hint">Uses AI neural network running locally in your browser. First load ~15MB (cached after).</p>';
    html += '<button class="btn primary btn-block" id="bgLoad">Download AI Model</button>';
  } else if (bg.aiLoading) {
    html += '<div class="row" style="align-items:center;gap:10px;"><div class="spinner"></div><span>Loading model...</span></div>';
  } else {
    html += '<p style="color:var(--success);font-size:12px;margin-bottom:4px;">AI model ready</p>';

    html += '<div class="col"><label>Model</label><select id="bgModel">';
    for (const [val, label] of Object.entries(MODEL_LABELS)) {
      html += `<option value="${val}"${bg.model === val ? ' selected' : ''}>${label}</option>`;
    }
    html += '</select></div>';

    html += '<label><input type="checkbox" id="bgEnhance"' + (bg.enhance ? ' checked' : '') + '> Enhance difficult edges</label>';
    html += '<p class="hint" style="margin-top:2px;">Pre-processes image to help AI distinguish subject from similar-color backgrounds.</p>';

    html += '<button class="btn primary btn-block" id="bgRun">Remove Background</button>';

    html += '<div class="divider"></div>';
    html += '<label><input type="checkbox" id="bgRefine"' + (bg.refine ? ' checked' : '') + '> Refine result</label>';
    if (bg.refine) {
      html += '<div class="col" style="margin-top:6px;"><label>Edge Tolerance: <span class="val" id="bgTolV">' + bg.tol + '</span></label>';
      html += '<input type="range" id="bgTol" min="1" max="100" value="' + bg.tol + '"></div>';
      html += '<div class="col"><label>Feather: <span class="val" id="bgFeathV">' + bg.feather + 'px</span></label>';
      html += '<input type="range" id="bgFeath" min="0" max="10" value="' + bg.feather + '"></div>';
      html += '<button class="btn btn-block" id="bgRefineApply" style="margin-top:4px;">Apply Refinement</button>';
    }
  }
  p.innerHTML = html;

  const loadBtn = optional$('bgLoad');
  if (loadBtn) loadBtn.onclick = () => { loadAI(); };
  const runBtn = optional$('bgRun');
  if (runBtn) runBtn.onclick = () => { runAIBG(); };
  const modelSel = optional$('bgModel');
  if (modelSel) modelSel.onchange = () => { bg.model = modelSel.value as typeof bg.model; };
  const enhChk = optional$('bgEnhance');
  if (enhChk) enhChk.onchange = () => { bg.enhance = enhChk.checked; renderBGPanel(p); };
  const refChk = optional$('bgRefine');
  if (refChk) refChk.onchange = () => { bg.refine = refChk.checked; renderBGPanel(p); };
  const tolEl = optional$('bgTol');
  if (tolEl) tolEl.oninput = () => { bg.tol = +tolEl.value; $('bgTolV').textContent = String(bg.tol); };
  const feEl = optional$('bgFeath');
  if (feEl) feEl.oninput = () => { bg.feather = +feEl.value; $('bgFeathV').textContent = bg.feather + 'px'; };
  const refApply = optional$('bgRefineApply');
  if (refApply) refApply.onclick = () => { refineEdges(); };
}

async function loadAI() {
  S.bg.aiLoading = true;
  (document.querySelector('.side-btn[data-tool="bgremove"]') as HTMLElement)?.click();
  toast('Loading AI model...');

  try {
    S.bg.aiLoaded = true;
    toast('AI model ready');
  } catch (err) {
    toast('Failed: ' + ((err as Error).message || 'Check connection'));
  }
  S.bg.aiLoading = false;
  (document.querySelector('.side-btn[data-tool="bgremove"]') as HTMLElement)?.click();
}

// Apply unsharp mask to enhance edges before AI processing.
// This helps the model distinguish subject from background in low-contrast areas.
function enhanceEdges(source: HTMLCanvasElement): HTMLCanvasElement {
  const w = source.width, h = source.height;
  const ctx = source.getContext('2d')!;
  const srcData = ctx.getImageData(0, 0, w, h);

  // Gaussian blur with small radius (sigma ~1.5)
  const blurred = blurCanvas(source, 1.5);

  const out = document.createElement('canvas');
  out.width = w; out.height = h;
  const outCtx = out.getContext('2d')!;
  const outData = outCtx.createImageData(w, h);

  const amount = 1.2; // unsharp mask strength
  const threshold = 8; // ignore tiny differences (noise)

  for (let i = 0; i < srcData.data.length; i += 4) {
    const diffR = srcData.data[i] - blurred.data[i];
    const diffG = srcData.data[i + 1] - blurred.data[i + 1];
    const diffB = srcData.data[i + 2] - blurred.data[i + 2];
    const mag = Math.abs(diffR) + Math.abs(diffG) + Math.abs(diffB);

    if (mag > threshold) {
      outData.data[i] = Math.min(255, Math.max(0, srcData.data[i] + diffR * amount));
      outData.data[i + 1] = Math.min(255, Math.max(0, srcData.data[i + 1] + diffG * amount));
      outData.data[i + 2] = Math.min(255, Math.max(0, srcData.data[i + 2] + diffB * amount));
    } else {
      outData.data[i] = srcData.data[i];
      outData.data[i + 1] = srcData.data[i + 1];
      outData.data[i + 2] = srcData.data[i + 2];
    }
    outData.data[i + 3] = srcData.data[i + 3];
  }

  outCtx.putImageData(outData, 0, 0);
  return out;
}

// Fast box-blur approximation of gaussian blur
function blurCanvas(canvas: HTMLCanvasElement, sigma: number): ImageData {
  const w = canvas.width, h = canvas.height;
  const radius = Math.ceil(sigma * 3);
  const ctx = canvas.getContext('2d')!;
  const src = ctx.getImageData(0, 0, w, h);

  // 3-pass box blur approximates gaussian
  let current = src;
  for (let pass = 0; pass < 3; pass++) {
    current = boxBlur(current, radius, w, h);
  }
  return current;
}

function boxBlur(src: ImageData, radius: number, w: number, h: number): ImageData {
  const dst = new ImageData(w, h);
  const size = radius * 2 + 1;
  const area = size * size;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = Math.min(w - 1, Math.max(0, x + dx));
          const ny = Math.min(h - 1, Math.max(0, y + dy));
          const i = (ny * w + nx) * 4;
          r += src.data[i];
          g += src.data[i + 1];
          b += src.data[i + 2];
          a += src.data[i + 3];
        }
      }
      const o = (y * w + x) * 4;
      dst.data[o] = r / area;
      dst.data[o + 1] = g / area;
      dst.data[o + 2] = b / area;
      dst.data[o + 3] = a / area;
    }
  }
  return dst;
}

async function runAIBG() {
  if (!S.bg.aiLoaded) { toast('Load AI model first'); return; }
  if (!S.img) return;
  pushHistory('BG Remove');
  toast('Processing with AI...');

  try {
    const tmp = canvasFromImage(S.img);

    const processed = S.bg.enhance ? enhanceEdges(tmp) : tmp;

    const blob = await new Promise(res => processed.toBlob(res, 'image/png'));
    const resBlob = await removeBackground(blob, {
      model: S.bg.model,
      progress: (key, current, total) => {
        const pct = Math.round((current / total) * 100);
        // update status bar with progress
        const statusEl = document.getElementById('statusTool');
        if (statusEl) statusEl.textContent = `BG Remove ${pct}%`;
      },
    });

    const url = URL.createObjectURL(resBlob);
    const nimg = new Image();
    nimg.onload = () => {
      S.img = nimg; fitImage(); renderAll();
      URL.revokeObjectURL(url);
      toast('Background removed');
      (document.querySelector('.side-btn[data-tool="bgremove"]') as HTMLElement)?.click();
    };
    nimg.onerror = () => { toast('Failed to decode result'); URL.revokeObjectURL(url); };
    nimg.src = url;
  } catch (err) {
    toast('Error: ' + ((err as Error).message || 'unknown'));
    (document.querySelector('.side-btn[data-tool="bgremove"]') as HTMLElement)?.click();
  }
}

async function refineEdges() {
  if (!S.img) return;
  const tol = S.bg.tol;
  const feather = S.bg.feather;
  const iw = S.img.width, ih = S.img.height;
  pushHistory('BG Refine');

  const tmp = canvasFromImage(S.img!);
  const tx = tmp.getContext('2d')!;
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

  S.img = await loadImageFromCanvas(tmp);
  fitImage(); renderAll();
  toast('Edges refined');
  (document.querySelector('.side-btn[data-tool="bgremove"]') as HTMLElement)?.click();
}
