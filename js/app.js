// ==================== STATE ====================
const S = {
  img: null, origImg: null, origData: null, workData: null,
  fname: 'image.png', tool: 'crop',
  zoom: 1, viewW: 0, viewH: 0,

  crop: { x:0, y:0, w:0, h:0, dragging:false, dragCorner:null, aspect:null },
  resize: { w:0, h:0, lock:true, pct:100 },
  grid: { rows:3, cols:3, hLines:[], vLines:[], hCh:false, vCh:false, drag:null, dIdx:-1 },
  bg: { aiLoaded:false, aiLoading:false, refine:false, tol:30, feather:3 },
  rotate: { angle:0 },

  history: [], histIdx:-1
};

// ==================== DOM REFS ====================
const $ = id => document.getElementById(id);
const mc = $('mainCanvas');
const oc = $('overlayCanvas');
const ctx = mc.getContext('2d', { willReadFrequently: true });
const octx = oc.getContext('2d');

// ==================== INIT ====================
function init() {
  setupUpload();
  setupSidebar();
  setupTopbar();
  setupSaveModal();
  setupKeys();
  switchTool('crop');
}

// ==================== UPLOAD ====================
function setupUpload() {
  const dz = $('dropzone');
  const fi = $('fileInput');

  dz.addEventListener('click', () => fi.click());
  $('btnOpen').addEventListener('click', () => fi.click());
  fi.addEventListener('change', e => { const f = e.target.files[0]; if (f) loadFile(f); });

  let cnt = 0;
  const area = $('canvasArea');
  area.addEventListener('dragenter', e => { e.preventDefault(); cnt++; dz.style.display = 'flex'; });
  area.addEventListener('dragleave', () => { cnt--; if (cnt <= 0) { cnt = 0; if (S.img) dz.style.display = 'none'; } });
  area.addEventListener('dragover', e => e.preventDefault());
  area.addEventListener('drop', e => { e.preventDefault(); cnt = 0; const f = e.dataTransfer.files[0]; if (f) loadFile(f); });
}

function loadFile(file) {
  if (!file.type.startsWith('image/')) return toast('Not an image file');
  S.fname = file.name.replace(/\.[^.]+$/, '') + '.png';
  S.history = []; S.histIdx = -1;
  S.grid.hLines = []; S.grid.vLines = []; S.grid.hCh = false; S.grid.vCh = false;
  S.crop = { x:0, y:0, w:0, h:0, dragging:false, dragCorner:null, aspect:null };
  S.rotate.angle = 0;

  const r = new FileReader();
  r.onload = e => {
    const img = new Image();
    img.onload = () => {
      S.img = img; S.origImg = img;
      fitImage(); renderAll();
      $('dropzone').style.display = 'none';
      $('canvasWrap').style.display = 'block';
      updateStatus();
      toast('Loaded ' + img.width + 'x' + img.height);
      switchTool(S.tool);
    };
    img.src = e.target.result;
  };
  r.readAsDataURL(file);
}

// ==================== CANVAS ====================
function fitImage() {
  if (!S.img) return;
  const maxW = window.innerWidth - 64 - 280 - 32;
  const maxH = window.innerHeight - 44 - 26 - 32;
  let w = S.img.width, h = S.img.height;
  if (w > maxW) { h = h * maxW / w; w = maxW; }
  if (h > maxH) { w = w * maxH / h; h = maxH; }
  S.viewW = w; S.viewH = h; S.zoom = w / S.img.width;
  mc.width = w; mc.height = h;
  oc.width = w; oc.height = h;
  mc.style.width = w + 'px'; mc.style.height = h + 'px';
  oc.style.width = w + 'px'; oc.style.height = h + 'px';
}

function renderAll() {
  if (!S.img) return;
  ctx.clearRect(0, 0, mc.width, mc.height);
  ctx.drawImage(S.img, 0, 0, mc.width, mc.height);
  S.origData = ctx.getImageData(0, 0, mc.width, mc.height);
  S.workData = new ImageData(new Uint8ClampedArray(S.origData.data), mc.width, mc.height);
  applyWork();
}

function applyWork() { ctx.putImageData(S.workData, 0, 0); }

function resetWork() {
  if (!S.origData) return;
  S.workData = new ImageData(new Uint8ClampedArray(S.origData.data), mc.width, mc.height);
  applyWork();
}

function pushHistory() {
  S.history = S.history.slice(0, S.histIdx + 1);
  // Save image at full resolution as compressed data URL
  const tmp = document.createElement('canvas');
  tmp.width = S.img.width;
  tmp.height = S.img.height;
  tmp.getContext('2d').drawImage(S.img, 0, 0);
  S.history.push({ dataURL: tmp.toDataURL('image/png'), w: S.img.width, h: S.img.height });
  S.histIdx = S.history.length - 1;
  if (S.history.length > 50) { S.history.shift(); S.histIdx--; }
}

function restoreFromHistory(idx) {
  const entry = S.history[idx];
  const img = new Image();
  img.onload = () => {
    S.img = img;
    fitImage(); renderAll();
    updateStatus();
    // Redraw overlay for current tool
    if (S.tool === 'crop') drawCropOverlay();
    else if (S.tool === 'grid') drawGridOverlay();
  };
  img.src = entry.dataURL;
}

function undo() {
  if (S.histIdx <= 0) {
    // Restore to the original loaded image
    S.img = S.origImg;
    S.histIdx = -1;
    fitImage(); renderAll(); updateStatus();
    switchTool(S.tool);
    return;
  }
  S.histIdx--;
  restoreFromHistory(S.histIdx);
}

function redo() {
  if (S.histIdx >= S.history.length - 1) return;
  S.histIdx++;
  restoreFromHistory(S.histIdx);
}

function updateImgFromCanvas() {
  const img = new Image();
  img.onload = () => { S.img = img; updateStatus(); };
  img.src = mc.toDataURL('image/png');
}

function updateStatus() {
  if (S.img) $('imageInfo').textContent = S.img.width + 'x' + S.img.height + 'px';
  else $('imageInfo').textContent = 'No image';
  $('statusDim').textContent = S.img ? S.img.width + ' x ' + S.img.height + ' px' : 'No image';
  $('statusZoom').textContent = S.zoom >= 0.95 ? '1:1' : Math.round(S.zoom * 100) + '%';
}

// ==================== SIDEBAR ====================
function setupSidebar() {
  document.querySelector('.sidebar').addEventListener('click', e => {
    const btn = e.target.closest('.side-btn');
    if (!btn) return;
    switchTool(btn.dataset.tool);
  });
}

function switchTool(tool) {
  S.tool = tool;
  document.querySelectorAll('.side-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tool === tool);
  });
  clearOverlay();
  $('statusTool').textContent = ({ crop:'Crop', resize:'Resize', grid:'Grid Split', bgremove:'BG Remove', rotate:'Rotate & Flip' })[tool];
  renderPanel();
  setupCanvasEvents();
}

function clearOverlay() {
  octx.clearRect(0, 0, oc.width, oc.height);
  oc.style.cursor = 'default';
  oc.onmousedown = oc.onmousemove = oc.onmouseup = oc.onmouseleave = null;
  mc.style.cursor = 'default';
  mc.onmousedown = mc.onmousemove = mc.onmouseup = mc.onmouseleave = mc.onclick = null;
}

// ==================== TOPBAR ====================
function setupTopbar() {
  $('btnUndo').addEventListener('click', undo);
  $('btnRedo').addEventListener('click', redo);
  $('btnSave').addEventListener('click', downloadCurrent);
  $('btnFit').addEventListener('click', () => { if (S.img) { fitImage(); renderAll(); switchTool(S.tool); } });
  $('btnActual').addEventListener('click', () => {
    if (!S.img) return;
    S.viewW = S.img.width; S.viewH = S.img.height; S.zoom = 1;
    mc.width = S.img.width; mc.height = S.img.height;
    oc.width = S.img.width; oc.height = S.img.height;
    mc.style.width = S.img.width + 'px'; mc.style.height = S.img.height + 'px';
    oc.style.width = S.img.width + 'px'; oc.style.height = S.img.height + 'px';
    renderAll(); switchTool(S.tool);
  });
}

// ==================== PANEL ====================
function renderPanel() {
  const p = $('panel');
  if (!S.img) { p.innerHTML = '<div class="panel-empty"><p>Load an image to start editing</p></div>'; return; }
  const fns = { crop: panelCrop, resize: panelResize, grid: panelGrid, bgremove: panelBG, rotate: panelRotate };
  (fns[S.tool] || panelCrop)(p);
}

// ==================== CROP TOOL ====================
function panelCrop(p) {
  p.innerHTML = `
    <h3>Crop Image</h3>
    <div class="col"><label>Aspect Ratio</label>
      <div class="presets" id="cropPresets">
        <span class="preset active" data-ratio="free">Free</span>
        <span class="preset" data-ratio="1:1">1:1</span>
        <span class="preset" data-ratio="4:3">4:3</span>
        <span class="preset" data-ratio="16:9">16:9</span>
        <span class="preset" data-ratio="3:2">3:2</span>
        <span class="preset" data-ratio="2:3">2:3</span>
        <span class="preset" data-ratio="9:16">9:16</span>
      </div>
    </div>
    <div class="divider"></div>
    <p class="hint">Drag on the image to select crop area. Drag corners to adjust. Double-click to apply.</p>
    <button class="btn primary btn-block" id="cropApply">Apply Crop</button>
    <button class="btn btn-block" id="cropReset">Reset Selection</button>
  `;
  document.getElementById('cropPresets').addEventListener('click', e => {
    const pr = e.target.closest('.preset');
    if (!pr) return;
    document.querySelectorAll('#cropPresets .preset').forEach(x => x.classList.remove('active'));
    pr.classList.add('active');
    S.crop.aspect = pr.dataset.ratio === 'free' ? null : pr.dataset.ratio;
    if (S.crop.w > 0) constrainCropAspect();
    drawCropOverlay();
  });
  $('cropApply').onclick = applyCrop;
  $('cropReset').onclick = () => { S.crop = { x:0, y:0, w:0, h:0, dragging:false, dragCorner:null, aspect:S.crop.aspect }; drawCropOverlay(); };
  drawCropOverlay();
}

function constrainCropAspect() {
  if (!S.crop.aspect) return;
  const [rw, rh] = S.crop.aspect.split(':').map(Number);
  const ratio = rw / rh;
  if (S.crop.w / S.crop.h > ratio) S.crop.w = S.crop.h * ratio;
  else S.crop.h = S.crop.w / ratio;
}

function drawCropOverlay() {
  octx.clearRect(0, 0, oc.width, oc.height);
  const c = S.crop;
  if (c.w <= 0 || c.h <= 0) { oc.style.cursor = 'crosshair'; return; }

  // Dim outside
  octx.fillStyle = 'rgba(0,0,0,0.55)';
  octx.fillRect(0, 0, oc.width, oc.height);
  octx.clearRect(c.x, c.y, c.w, c.h);

  // Border
  octx.strokeStyle = '#58a6ff'; octx.lineWidth = 2;
  octx.setLineDash([6, 3]);
  octx.strokeRect(c.x, c.y, c.w, c.h);
  octx.setLineDash([]);

  // Corner handles
  octx.fillStyle = '#fff'; octx.strokeStyle = '#58a6ff'; octx.lineWidth = 1.5;
  [[c.x, c.y], [c.x+c.w, c.y], [c.x, c.y+c.h], [c.x+c.w, c.y+c.h]].forEach(([hx, hy]) => {
    octx.fillRect(hx-4, hy-4, 8, 8);
    octx.strokeRect(hx-4, hy-4, 8, 8);
  });

  // Rule of thirds
  const tw = c.w/3, th = c.h/3;
  octx.strokeStyle = 'rgba(255,255,255,0.15)'; octx.lineWidth = 1;
  [1,2].forEach(i => {
    octx.beginPath(); octx.moveTo(c.x+tw*i, c.y); octx.lineTo(c.x+tw*i, c.y+c.h); octx.stroke();
    octx.beginPath(); octx.moveTo(c.x, c.y+th*i); octx.lineTo(c.x+c.w, c.y+th*i); octx.stroke();
  });

  oc.style.cursor = 'default';
}

function applyCrop() {
  const c = S.crop;
  if (c.w < 5 || c.h < 5) { toast('Select an area first'); return; }
  pushHistory();

  const scale = S.img.width / S.viewW;
  const sx = Math.round(c.x * scale), sy = Math.round(c.y * scale);
  const sw = Math.round(c.w * scale), sh = Math.round(c.h * scale);

  const tmp = document.createElement('canvas');
  tmp.width = sw; tmp.height = sh;
  tmp.getContext('2d').drawImage(S.img, sx, sy, sw, sh, 0, 0, sw, sh);

  const nimg = new Image();
  nimg.onload = () => {
    S.img = nimg;
    fitImage(); renderAll();
    S.crop = { x:0, y:0, w:0, h:0, dragging:false, dragCorner:null, aspect:S.crop.aspect };
    toast('Cropped to ' + sw + 'x' + sh);
    switchTool('crop');
  };
  nimg.src = tmp.toDataURL('image/png');
}

// ==================== RESIZE TOOL ====================
function panelResize(p) {
  S.resize.w = S.img.width; S.resize.h = S.img.height;
  p.innerHTML = `
    <h3>Resize Image</h3>
    <div class="row"><label style="flex:1">Width (px)</label><label style="flex:1">Height (px)</label></div>
    <div class="row">
      <input type="number" id="resW" value="${S.img.width}" style="flex:1">
      <input type="number" id="resH" value="${S.img.height}" style="flex:1">
    </div>
    <label><input type="checkbox" id="resLock" checked> Lock aspect ratio</label>
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

  const wEl = $('resW'), hEl = $('resH'), lockEl = $('resLock'), pctEl = $('resPct');
  const ratio = S.img.width / S.img.height;

  wEl.oninput = () => {
    S.resize.w = +wEl.value || 1;
    if (lockEl.checked) { S.resize.h = Math.round(S.resize.w / ratio); hEl.value = S.resize.h; }
    pctEl.value = Math.round(S.resize.w / S.img.width * 100);
    $('resPctVal').textContent = pctEl.value + '%';
  };
  hEl.oninput = () => {
    S.resize.h = +hEl.value || 1;
    if (lockEl.checked) { S.resize.w = Math.round(S.resize.h * ratio); wEl.value = S.resize.w; }
  };
  pctEl.oninput = () => {
    const p = +pctEl.value;
    $('resPctVal').textContent = p + '%';
    S.resize.w = Math.round(S.img.width * p / 100);
    S.resize.h = Math.round(S.img.height * p / 100);
    wEl.value = S.resize.w; hEl.value = S.resize.h;
  };

  $('resPresets').addEventListener('click', e => {
    const pr = e.target.closest('.preset');
    if (!pr) return;
    S.resize.w = +pr.dataset.w; S.resize.h = +pr.dataset.h;
    wEl.value = S.resize.w; hEl.value = S.resize.h;
    pctEl.value = Math.round(S.resize.w / S.img.width * 100);
    $('resPctVal').textContent = pctEl.value + '%';
  });

  $('resApply').onclick = () => {
    pushHistory();
    const tmp = document.createElement('canvas');
    tmp.width = S.resize.w; tmp.height = S.resize.h;
    tmp.getContext('2d').drawImage(S.img, 0, 0, S.resize.w, S.resize.h);
    const nimg = new Image();
    nimg.onload = () => { S.img = nimg; fitImage(); renderAll(); toast('Resized to ' + S.resize.w + 'x' + S.resize.h); switchTool('resize'); };
    nimg.src = tmp.toDataURL('image/png');
  };
}

// ==================== GRID SPLIT TOOL ====================
function panelGrid(p) {
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
    <p class="hint">Drag the red handles to reposition lines. Lines snap to avoid overlap.</p>
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

function drawGridOverlay() {
  octx.clearRect(0, 0, oc.width, oc.height);
  if (S.tool !== 'grid') return;
  const g = S.grid, w = oc.width, h = oc.height;
  octx.setLineDash([8, 4]); octx.lineWidth = 2; octx.strokeStyle = '#58a6ff';
  g.hLines.forEach(p => { const y = p*h; octx.beginPath(); octx.moveTo(0,y); octx.lineTo(w,y); octx.stroke(); });
  g.vLines.forEach(p => { const x = p*w; octx.beginPath(); octx.moveTo(x,0); octx.lineTo(x,h); octx.stroke(); });
  octx.setLineDash([]); octx.fillStyle = '#58a6ff'; octx.strokeStyle = '#fff'; octx.lineWidth = 1.5;
  g.hLines.forEach(p => { const y = p*h; octx.fillRect(w/2-20, y-4, 40, 8); octx.strokeRect(w/2-20, y-4, 40, 8); });
  g.vLines.forEach(p => { const x = p*w; octx.fillRect(x-4, h/2-20, 8, 40); octx.strokeRect(x-4, h/2-20, 8, 40); });
  oc.style.cursor = 'crosshair';
}

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
      const sw = Math.round((ve[c+1] - ve[c]) * iw);
      const sh = Math.round((he[r+1] - he[r]) * ih);
      if (sw <= 0 || sh <= 0) continue;

      const cell = document.createElement('canvas');
      cell.width = sw; cell.height = sh;
      cell.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      const b64 = cell.toDataURL('image/png').split(',')[1];
      zip.file('cell_r' + (r+1) + '_c' + (c+1) + '.png', b64, { base64: true });
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

// ==================== BG REMOVE TOOL ====================
function panelBG(p) {
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
  if (refChk) refChk.onchange = () => { bg.refine = refChk.checked; panelBG(p); };
  const tolEl = $('bgTol');
  if (tolEl) tolEl.oninput = () => { bg.tol = +tolEl.value; $('bgTolV').textContent = bg.tol; };
  const feEl = $('bgFeath');
  if (feEl) feEl.oninput = () => { bg.feather = +feEl.value; $('bgFeathV').textContent = bg.feather + 'px'; };
  const refApply = $('bgRefineApply');
  if (refApply) refApply.onclick = () => { refineEdges(); };
}

async function loadAI() {
  S.bg.aiLoading = true;
  renderPanel();
  toast('Loading AI model...');

  try {
    const mod = await import('@imgly/background-removal');
    if (mod && mod.removeBackground) {
      window.__bgMod = mod;
      S.bg.aiLoaded = true;
      toast('AI model ready');
    } else {
      throw new Error('removeBackground not exported');
    }
  } catch (err) {
    toast('Failed: ' + (err.message || 'Check connection'));
  }
  S.bg.aiLoading = false;
  renderPanel();
}

async function runAIBG() {
  if (!window.__bgMod) { toast('Load AI model first'); return; }
  pushHistory();
  toast('Processing with AI...');

  try {
    // Use full-resolution image for AI processing
    const tmp = document.createElement('canvas');
    tmp.width = S.img.width; tmp.height = S.img.height;
    tmp.getContext('2d').drawImage(S.img, 0, 0);
    const blob = await new Promise(res => tmp.toBlob(res, 'image/png'));
    const resBlob = await window.__bgMod.removeBackground(blob);
    const url = URL.createObjectURL(resBlob);
    const nimg = new Image();
    nimg.onload = () => {
      S.img = nimg; fitImage(); renderAll();
      URL.revokeObjectURL(url);
      toast('Background removed');
      renderPanel();
    };
    nimg.onerror = () => { toast('Failed to decode result'); URL.revokeObjectURL(url); };
    nimg.src = url;
  } catch (err) {
    toast('Error: ' + (err.message || 'unknown'));
    renderPanel();
  }
}

function refineEdges() {
  const tol = S.bg.tol;
  const feather = S.bg.feather;
  const iw = S.img.width, ih = S.img.height;

  // Work at full resolution to preserve quality
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

      // Check if pixel is at an edge (neighbor is transparent)
      let atEdge = false;
      outer: for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = px + dx, ny = py + dy;
          if (nx >= 0 && nx < iw && ny >= 0 && ny < ih) {
            const ni = (ny * iw + nx) * 4;
            if (fullData.data[ni + 3] < 10) { atEdge = true; break outer; }
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
    renderPanel();
  };
  nimg.src = tmp.toDataURL('image/png');
}

// ==================== ROTATE & FLIP TOOL ====================
function panelRotate(p) {
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

  $('rotCCW').onclick = () => rotate(-90);
  $('rotCW').onclick = () => rotate(90);
  $('rot180').onclick = () => rotate(180);
  $('angSlider').oninput = () => { $('angVal').textContent = $('angSlider').value + ''; };
  $('rotApply').onclick = () => rotate(+$('angSlider').value);
  $('flipH').onclick = flipH;
  $('flipV').onclick = flipV;
}

function rotate(deg) {
  if (!S.img) return;
  pushHistory();
  const rad = deg * Math.PI / 180;
  const iw = S.img.width, ih = S.img.height;
  const c = Math.abs(Math.cos(rad)), s = Math.abs(Math.sin(rad));
  let nw, nh;
  if (Math.abs(deg % 180) < 0.01) { nw = iw; nh = ih; }
  else if (Math.abs(deg % 90) < 0.01) { nw = ih; nh = iw; }
  else { nw = Math.round(iw*c + ih*s); nh = Math.round(iw*s + ih*c); }

  const tmp = document.createElement('canvas'); tmp.width = nw; tmp.height = nh;
  const tx = tmp.getContext('2d');
  tx.translate(nw/2, nh/2); tx.rotate(rad);
  tx.drawImage(S.img, -iw/2, -ih/2);

  const nimg = new Image();
  nimg.onload = () => { S.img = nimg; fitImage(); renderAll(); toast('Rotated ' + deg); switchTool('rotate'); };
  nimg.src = tmp.toDataURL('image/png');
}

function flipH() {
  if (!S.img) return;
  pushHistory();
  const tmp = document.createElement('canvas');
  tmp.width = S.img.width; tmp.height = S.img.height;
  const tx = tmp.getContext('2d');
  tx.translate(S.img.width, 0); tx.scale(-1, 1);
  tx.drawImage(S.img, 0, 0);
  const nimg = new Image();
  nimg.onload = () => { S.img = nimg; fitImage(); renderAll(); toast('Flipped H'); switchTool('rotate'); };
  nimg.src = tmp.toDataURL('image/png');
}

function flipV() {
  if (!S.img) return;
  pushHistory();
  const tmp = document.createElement('canvas');
  tmp.width = S.img.width; tmp.height = S.img.height;
  const tx = tmp.getContext('2d');
  tx.translate(0, S.img.height); tx.scale(1, -1);
  tx.drawImage(S.img, 0, 0);
  const nimg = new Image();
  nimg.onload = () => { S.img = nimg; fitImage(); renderAll(); toast('Flipped V'); switchTool('rotate'); };
  nimg.src = tmp.toDataURL('image/png');
}

// ==================== CANVAS EVENTS ====================
function setupCanvasEvents() {
  clearOverlay();
  if (!S.img) return;

  if (S.tool === 'crop') {
    oc.style.cursor = 'crosshair';
    oc.onmousedown = cropDown;
    oc.onmousemove = cropMove;
    oc.onmouseup = cropUp;
    oc.ondblclick = () => { applyCrop(); };
  } else if (S.tool === 'grid') {
    oc.onmousedown = gridDown;
    oc.onmousemove = gridMove;
    oc.onmouseup = gridUp;
    oc.onmouseleave = gridUp;
  }
}

// --- CROP EVENTS ---
function cropDown(e) {
  const rect = oc.getBoundingClientRect();
  const mx = e.clientX - rect.left, my = e.clientY - rect.top;
  const c = S.crop;

  // Check corner drag
  if (c.w > 0) {
    const corners = [[c.x,c.y],[c.x+c.w,c.y],[c.x,c.y+c.h],[c.x+c.w,c.y+c.h]];
    const labels = ['tl','tr','bl','br'];
    for (let i = 0; i < 4; i++) {
      const [cx, cy] = corners[i];
      if (Math.abs(mx-cx) < 10 && Math.abs(my-cy) < 10) {
        c.dragging = true; c.dragCorner = labels[i]; return;
      }
    }
  }

  // Start new selection
  c.dragging = true; c.dragCorner = 'new';
  c.x = mx; c.y = my; c.w = 0; c.h = 0;
}

function cropMove(e) {
  const c = S.crop;
  if (!c.dragging) return;
  const rect = oc.getBoundingClientRect();
  const mx = Math.min(Math.max(e.clientX - rect.left, 0), oc.width);
  const my = Math.min(Math.max(e.clientY - rect.top, 0), oc.height);

  if (c.dragCorner === 'new') {
    c.w = mx - c.x; c.h = my - c.y;
    if (c.aspect) constrainCropAspect();
  } else {
    const dc = c.dragCorner;
    if (dc === 'tl') { c.w += c.x - mx; c.h += c.y - my; c.x = mx; c.y = my; }
    else if (dc === 'tr') { c.w = mx - c.x; c.h += c.y - my; c.y = my; }
    else if (dc === 'bl') { c.w += c.x - mx; c.x = mx; c.h = my - c.y; }
    else if (dc === 'br') { c.w = mx - c.x; c.h = my - c.y; }
    if (c.w < 10) c.w = 10;
    if (c.h < 10) c.h = 10;
  }
  drawCropOverlay();
}

function cropUp() {
  S.crop.dragging = false;
  if (S.crop.w < 5 || S.crop.h < 5) S.crop = { x:0, y:0, w:0, h:0, dragging:false, dragCorner:null, aspect:S.crop.aspect };
  drawCropOverlay();
}

// --- GRID EVENTS ---
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
    for (let i = 0; i < g.hLines.length; i++) { if (Math.abs(my-g.hLines[i])<th) { oc.style.cursor='row-resize'; f=true; break; } }
    if (!f) for (let i = 0; i < g.vLines.length; i++) { if (Math.abs(mx-g.vLines[i])<th) { oc.style.cursor='col-resize'; f=true; break; } }
    if (!f) oc.style.cursor = 'crosshair';
    return;
  }

  if (g.drag === 'h') {
    const v = Math.max(0.03, Math.min(0.97, my));
    if (g.dIdx > 0 && v <= g.hLines[g.dIdx-1] + 0.025) return;
    if (g.dIdx < g.hLines.length-1 && v >= g.hLines[g.dIdx+1] - 0.025) return;
    g.hLines[g.dIdx] = v; g.hCh = true;
  } else {
    const v = Math.max(0.03, Math.min(0.97, mx));
    if (g.dIdx > 0 && v <= g.vLines[g.dIdx-1] + 0.025) return;
    if (g.dIdx < g.vLines.length-1 && v >= g.vLines[g.dIdx+1] - 0.025) return;
    g.vLines[g.dIdx] = v; g.vCh = true;
  }
  drawGridOverlay();
}

function gridUp() { S.grid.drag = null; if (S.tool==='grid') oc.style.cursor='crosshair'; }

// ==================== DOWNLOAD ====================
function downloadCurrent() {
  if (!S.img) { toast('No image to save'); return; }
  $('saveFilename').value = S.fname;
  $('saveFormat').value = 'png';
  $('qualityRow').style.display = 'none';
  $('saveModal').style.display = 'flex';
}

function setupSaveModal() {
  $('saveCancel').addEventListener('click', () => {
    $('saveModal').style.display = 'none';
  });
  $('saveModal').addEventListener('click', e => {
    if (e.target === $('saveModal')) $('saveModal').style.display = 'none';
  });
  $('qualityRow').style.display = 'none'; // hidden initially (PNG default)
  $('saveQuality').addEventListener('input', () => {
    $('qualVal').textContent = $('saveQuality').value + '%';
  });
  $('saveFormat').addEventListener('change', () => {
    $('qualityRow').style.display = $('saveFormat').value === 'jpeg' ? 'flex' : 'none';
  });
  $('saveConfirm').addEventListener('click', () => {
    const fmt = $('saveFormat').value;
    const qual = +$('saveQuality').value / 100;
    const fname = $('saveFilename').value || 'image';

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

    if (fmt === 'png') {
      const link = document.createElement('a');
      link.download = dlName;
      link.href = tmp.toDataURL('image/png');
      link.click();
    } else {
      tmp.toBlob(blob => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = dlName;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
      }, mime, qual);
    }

    $('saveModal').style.display = 'none';
    toast('Saved: ' + dlName);
  });
}

// ==================== KEYBOARD ====================
function setupKeys() {
  document.addEventListener('keydown', e => {
    if (!S.img) return;
    if (e.ctrlKey && e.shiftKey && e.key === 'Z') { e.preventDefault(); redo(); }
    if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo(); }
    if (e.ctrlKey && e.key === 's') { e.preventDefault(); downloadCurrent(); }
    if (e.ctrlKey && e.key === 'o') { e.preventDefault(); $('fileInput').click(); }
  });
}

// ==================== TOAST ====================
function toast(msg) {
  const old = document.querySelector('.toast');
  if (old) old.remove();
  const d = document.createElement('div');
  d.className = 'toast'; d.textContent = msg;
  document.body.appendChild(d);
  setTimeout(() => { if (d.parentNode) d.remove(); }, 2600);
}

// ==================== RESIZE ====================
window.addEventListener('resize', () => {
  if (S.img) {
    fitImage();
    ctx.clearRect(0, 0, mc.width, mc.height);
    ctx.drawImage(S.img, 0, 0, mc.width, mc.height);
    S.origData = ctx.getImageData(0, 0, mc.width, mc.height);
    S.workData = new ImageData(new Uint8ClampedArray(S.origData.data), mc.width, mc.height);
    applyWork();
    // Redraw overlay without resetting panel
    if (S.tool === 'crop') drawCropOverlay();
    else if (S.tool === 'grid') drawGridOverlay();
    updateStatus();
  }
});

init();