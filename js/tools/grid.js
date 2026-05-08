import { S } from '../state.js';
import { $, oc } from '../dom.js';
import { drawGridOverlay } from '../overlay.js';
import { toast } from '../ui.js';

export function renderGridPanel(p) {
  const g = S.grid;
  if (!g.hCh || g.hLines.length === 0) g.hLines = even(g.rows);
  if (!g.vCh || g.vLines.length === 0) g.vLines = even(g.cols);

  p.innerHTML = `
    <h3>Grid Split</h3>
    <div class="col"><label>Rows: <span class="val" id="gRowsVal">${g.rows}</span></label>
    <input type="range" id="gRows" min="1" max="20" value="${g.rows}"></div>
    <div class="col"><label>Columns: <span class="val" id="gColsVal">${g.cols}</span></label>
    <input type="range" id="gCols" min="1" max="20" value="${g.cols}"></div>
    <div class="divider"></div>
    <p class="hint">Drag the blue handles to reposition lines. Lines snap to avoid overlap.</p>
    <p class="hint" id="gridCount">${g.rows}x${g.cols} = ${g.rows * g.cols} cells</p>
    <button class="btn primary btn-block" id="gridZip">Download All Cells as ZIP</button>
  `;

  $('gRows').oninput = () => {
    g.rows = +$('gRows').value; $('gRowsVal').textContent = g.rows;
    g.hLines = even(g.rows); g.hCh = false;
    $('gridCount').textContent = g.rows + 'x' + g.cols + ' = ' + (g.rows * g.cols) + ' cells';
    drawGridOverlay();
  };
  $('gCols').oninput = () => {
    g.cols = +$('gCols').value; $('gColsVal').textContent = g.cols;
    g.vLines = even(g.cols); g.vCh = false;
    $('gridCount').textContent = g.rows + 'x' + g.cols + ' = ' + (g.rows * g.cols) + ' cells';
    drawGridOverlay();
  };
  $('gridZip').onclick = downloadGridZip;

  drawGridOverlay();
}

function even(n) { const a = []; for (let i = 1; i < n; i++) a.push(i / n); return a; }

export function setupGridEvents() {
  oc.onmousedown = gridDown;
  oc.onmousemove = gridMove;
  oc.onmouseup = gridUp;
  oc.onmouseleave = gridUp;
}

function gridDown(e) {
  const g = S.grid;
  const rect = oc.getBoundingClientRect();
  const mx = (e.clientX - rect.left) / oc.width;
  const my = (e.clientY - rect.top) / oc.height;
  const th = 0.035;

  for (let i = 0; i < g.hLines.length; i++) {
    if (Math.abs(my - g.hLines[i]) < th) { g.drag = 'h'; g.dIdx = i; oc.style.cursor = 'row-resize'; return; }
  }
  for (let i = 0; i < g.vLines.length; i++) {
    if (Math.abs(mx - g.vLines[i]) < th) { g.drag = 'v'; g.dIdx = i; oc.style.cursor = 'col-resize'; return; }
  }
}

function gridMove(e) {
  const g = S.grid;
  const rect = oc.getBoundingClientRect();
  const mx = (e.clientX - rect.left) / oc.width;
  const my = (e.clientY - rect.top) / oc.height;
  const th = 0.035;

  if (!g.drag) {
    let f = false;
    for (let i = 0; i < g.hLines.length; i++) { if (Math.abs(my - g.hLines[i]) < th) { oc.style.cursor = 'row-resize'; f = true; break; } }
    if (!f) for (let i = 0; i < g.vLines.length; i++) { if (Math.abs(mx - g.vLines[i]) < th) { oc.style.cursor = 'col-resize'; f = true; break; } }
    if (!f) oc.style.cursor = 'crosshair';
    return;
  }

  if (g.drag === 'h') {
    const v = Math.max(0.03, Math.min(0.97, my));
    if (g.dIdx > 0 && v <= g.hLines[g.dIdx - 1] + 0.025) return;
    if (g.dIdx < g.hLines.length - 1 && v >= g.hLines[g.dIdx + 1] - 0.025) return;
    g.hLines[g.dIdx] = v; g.hCh = true;
  } else {
    const v = Math.max(0.03, Math.min(0.97, mx));
    if (g.dIdx > 0 && v <= g.vLines[g.dIdx - 1] + 0.025) return;
    if (g.dIdx < g.vLines.length - 1 && v >= g.vLines[g.dIdx + 1] - 0.025) return;
    g.vLines[g.dIdx] = v; g.vCh = true;
  }
  drawGridOverlay();
}

function gridUp() { S.grid.drag = null; if (S.tool === 'grid') oc.style.cursor = 'crosshair'; }

async function downloadGridZip() {
  const g = S.grid;
  if (typeof JSZip === 'undefined') { toast('JSZip not loaded. Check internet.'); return; }

  const img = S.img, iw = img.width, ih = img.height;
  const he = [0, ...g.hLines, 1];
  const ve = [0, ...g.vLines, 1];
  const total = g.rows * g.cols;

  toast('Building ZIP with ' + total + ' cells...');
  const zip = new JSZip();

  for (let r = 0; r < g.rows; r++) {
    for (let c = 0; c < g.cols; c++) {
      const sx = Math.round(ve[c] * iw);
      const sy = Math.round(he[r] * ih);
      const sw = Math.round((ve[c + 1] - ve[c]) * iw);
      const sh = Math.round((he[r + 1] - he[r]) * ih);
      if (sw <= 0 || sh <= 0) continue;

      const cell = document.createElement('canvas');
      cell.width = sw; cell.height = sh;
      cell.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      const b64 = cell.toDataURL('image/png').split(',')[1];
      zip.file('cell_r' + (r + 1) + '_c' + (c + 1) + '.png', b64, { base64: true });
    }
  }

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = S.fname.replace('.png', '') + '_grid.zip';
  a.click();
  URL.revokeObjectURL(url);
  toast('ZIP downloaded: ' + total + ' cells');
}
