import { S } from '../state.js';
import { $ } from '../dom.js';
import { toast } from '../ui.js';
import { canvasFromImage, triggerDownload } from '../utils.js';

const QUALITY_PRESETS = [
  { label: 'Low', pct: 30 },
  { label: 'Med', pct: 60 },
  { label: 'High', pct: 85 },
  { label: 'Max', pct: 100 },
];

export function renderCompressorPanel(p: HTMLElement) {
  p.innerHTML = `
    <h3>Compress Image</h3>
    <div class="col"><label>Format</label>
      <select id="compFormat">
        <option value="jpeg">JPEG</option>
        <option value="webp">WebP</option>
      </select>
    </div>
    <div class="col">
      <label>Quality: <span class="val" id="compQualVal">85%</span></label>
      <input type="range" id="compQuality" min="10" max="100" value="85">
    </div>
    <div class="presets" id="compPresets">
      ${QUALITY_PRESETS.map(q => `<span class="preset" data-pct="${q.pct}">${q.label}</span>`).join('')}
    </div>
    <div class="divider"></div>
    <div class="col" id="compResult" style="display:none;">
      <div class="row" style="justify-content:space-between;">
        <span style="font-size:11px;color:var(--text2);">Original</span>
        <span id="compOrigSize" style="font-size:11px;">-</span>
      </div>
      <div class="row" style="justify-content:space-between;">
        <span style="font-size:11px;color:var(--text2);">Compressed</span>
        <span id="compNewSize" style="font-size:11px;color:var(--success);">-</span>
      </div>
      <div class="row" style="justify-content:space-between;">
        <span style="font-size:11px;color:var(--text2);">Saved</span>
        <span id="compSaved" style="font-size:11px;color:var(--success);">-</span>
      </div>
    </div>
    <button class="btn primary btn-block" id="compRun">Preview Compression</button>
    <button class="btn primary btn-block" id="compDownload" style="display:none;">Download Compressed</button>
  `;

  const slider = $('compQuality');
  const qualVal = $('compQualVal');
  let lastBlob: Blob | null = null;

  slider.addEventListener('input', () => {
    qualVal.textContent = slider.value + '%';
  });

  const presetsEl = $('compPresets');
  presetsEl.addEventListener('click', e => {
    const pr = (e.target as HTMLElement).closest('.preset') as HTMLElement | null;
    if (!pr) return;
    slider.value = String(+pr.dataset.pct!);
    qualVal.textContent = slider.value + '%';
  });

  $('compRun').addEventListener('click', () => {
    const fmt = $('compFormat').value;
    const qual = +slider.value / 100;
    const mime = fmt === 'jpeg' ? 'image/jpeg' : 'image/webp';

    if (!S.img) return;
    const tmp = canvasFromImage(S.img);

    const dataUrl = tmp.toDataURL('image/png');
    const origBytes = Math.round(dataUrl.length * 0.75); // base64 → bytes approx

    if (fmt === 'png') {
      $('compOrigSize').textContent = formatSize(origBytes);
      $('compNewSize').textContent = formatSize(origBytes);
      $('compSaved').textContent = '0%';
      $('compResult').style.display = 'flex';
      return;
    }

    tmp.toBlob(blob => {
      if (!blob) return;
      lastBlob = blob;
      $('compOrigSize').textContent = formatSize(origBytes);
      $('compNewSize').textContent = formatSize(blob.size);
      const saved = origBytes > 0 ? Math.round((1 - blob.size / origBytes) * 100) : 0;
      $('compSaved').textContent = saved + '%';
      $('compResult').style.display = 'flex';
      $('compDownload').style.display = 'block';
    }, mime, qual);
  });

  $('compDownload').addEventListener('click', () => {
    if (!lastBlob) return;
    const fmt = $('compFormat').value;
    const fname = S.fname.replace(/\.[^.]+$/, '') + (fmt === 'jpeg' ? '.jpg' : '.webp');
    triggerDownload(lastBlob, fname);
    toast('Downloaded: ' + fname);
  });
}

function formatSize(bytes: number) {
  if (bytes >= 1_000_000) return (bytes / 1_000_000).toFixed(1) + ' MB';
  if (bytes >= 1_000) return (bytes / 1_000).toFixed(1) + ' KB';
  return bytes + ' B';
}
