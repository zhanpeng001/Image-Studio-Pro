import { S } from '../state.js';
import type { CanvaLayer } from '../state.js';
import { oc, octx, mc } from '../dom.js';
import { pushHistory } from '../history.js';
import { toast, showLoading, hideLoading } from '../ui.js';
import { drawHandles } from '../overlay.js';
import { computeCanvaMergeGeometry } from './canva-geometry.js';
import { renderLayerToContext } from './canva-draw.js';
import { createLayer, createTextLayer, createIconLayer, loadOverlayLayer } from './canva-layers.js';
import { saveCanvaProject, loadCanvaProject } from './canva-project.js';
import { buildCanvaPanelHTML } from './canva-panel.js';
import {
  getCanvaTextOverlayRect,
  readCanvaEditableText,
} from './canva-layout.mjs';
import { highlightPreset, wireColorPresets } from '../utils.js';

let cleanupEvents: (() => void) | null = null;

interface CanvaHandlePoint {
  wx: number;
  wy: number;
}

type CanvaHandleKey = 'tl' | 'tr' | 'bl' | 'br' | 'n' | 's' | 'w' | 'e' | 'rot';
type CanvaHandles = Record<CanvaHandleKey, CanvaHandlePoint>;

// ==================== HELPERS ====================
function drawCheckerboardOnMc(w: number, h: number) {
  const ctx2 = mc.getContext('2d')!;
  const size = 16;
  for (let y = 0; y < h; y += size) {
    for (let x = 0; x < w; x += size) {
      ctx2.fillStyle = ((Math.floor(x / size) + Math.floor(y / size)) % 2 === 0) ? '#eee' : '#fff';
      ctx2.fillRect(x, y, size, size);
    }
  }
}

// ==================== PANEL ====================
export function renderCanvaPanel(p: HTMLElement) {
  const c = S.canva;

  const canvasAreaEl = document.getElementById('canvasArea')!;
  const viewW = canvasAreaEl.clientWidth;
  const viewH = canvasAreaEl.clientHeight;

  // Init workspace on first entry
  if (c.workspaceW === 0 || c.workspaceH === 0) {
    const wsW = Math.max(viewW * 3, 4000);
    const wsH = Math.max(viewH * 3, 3000);
    c.workspaceW = wsW;
    c.workspaceH = wsH;
    c.zoom = 1;

    mc.width = wsW; mc.height = wsH;
    oc.width = wsW; oc.height = wsH;
    mc.style.width = wsW + 'px'; mc.style.height = wsH + 'px';
    oc.style.width = wsW + 'px'; oc.style.height = wsH + 'px';

    drawCheckerboardOnMc(wsW, wsH);

    canvasAreaEl.style.overflow = 'auto';
    canvasAreaEl.style.alignItems = 'flex-start';
    canvasAreaEl.style.justifyContent = 'flex-start';

    canvasAreaEl.scrollLeft = Math.round((wsW - viewW) / 2);
    canvasAreaEl.scrollTop = Math.round((wsH - viewH) / 2);
  }

  // Create layer 0 from base image if no layers yet
  if (c.layers.length === 0 && S.img) {
    const wsW = c.workspaceW, wsH = c.workspaceH;
    const scale = Math.min(0.5, wsW * 0.4 / S.img.width, wsH * 0.4 / S.img.height);
    const w = Math.round(S.img.width * scale);
    const h = Math.round(S.img.height * scale);
    const x = Math.round((wsW - w) / 2);
    const y = Math.round((wsH - h) / 2);
    c.layers = [createLayer(S.img, x, y, w, h)];
    c.selectedIdx = 0;
  }
  // Undo/redo may have replaced S.img — keep layers in sync
  if (c.layers.length > 0 && c.layers[0].img !== S.img && S.img) {
    const oldLayers = c.layers;
    const wsW = c.workspaceW, wsH = c.workspaceH;
    const scale = Math.min(0.5, wsW * 0.4 / S.img.width, wsH * 0.4 / S.img.height);
    const w = Math.round(S.img.width * scale);
    const h = Math.round(S.img.height * scale);
    const x = Math.round((wsW - w) / 2);
    const y = Math.round((wsH - h) / 2);
    c.layers = [createLayer(S.img, x, y, w, h)];
    for (let i = 1; i < oldLayers.length; i++) {
      c.layers.push(oldLayers[i]);
    }
    if (c.selectedIdx >= c.layers.length) c.selectedIdx = c.layers.length - 1;
  }

  const sel = c.selectedIdx >= 0 ? c.layers[c.selectedIdx] : null;
  p.innerHTML = buildCanvaPanelHTML(c, sel);

  // Wire events
  const layerList = document.getElementById('canvaLayerList');
  if (layerList) {
    layerList.onclick = (e: MouseEvent) => {
      const row = (e.target as HTMLElement).closest('.layer-row') as HTMLElement | null;
      if (!row) return;
      c.selectedIdx = +(row.dataset.idx ?? '-1');
      drawCanvaAll();
      renderCanvaPanel(p);
    };
  }

  const opacitySlider = document.getElementById('canvaOpacity') as HTMLInputElement | null;
  if (opacitySlider && sel) {
    opacitySlider.oninput = () => {
      sel.opacity = +opacitySlider.value / 100;
      const valEl = document.getElementById('canvaOpacityVal');
      if (valEl) valEl.textContent = Math.round(sel.opacity * 100) + '%';
      drawCanvaAll();
    };
  }

  const angleSlider = document.getElementById('canvaAngle') as HTMLInputElement | null;
  if (angleSlider && sel) {
    angleSlider.oninput = () => {
      sel.angle = +angleSlider.value;
      const valEl = document.getElementById('canvaAngleVal');
      if (valEl) valEl.textContent = sel.angle + '°';
      drawCanvaAll();
    };
  }

  const lockChk = document.getElementById('canvaLockRatio') as HTMLInputElement | null;
  if (lockChk && sel) {
    lockChk.onchange = () => {
      sel.ratioLocked = lockChk.checked;
      if (sel.ratioLocked && sel.w > 0) sel.ratio = sel.w / sel.h;
    };
  }

  const addBtn = document.getElementById('canvaAddLayer');
  if (addBtn) addBtn.onclick = () => openLayerFilePicker();

  const addTextBtn = document.getElementById('canvaAddText');
  if (addTextBtn) addTextBtn.onclick = () => addTextLayer();

  const addIconBtn = document.getElementById('canvaAddIcon');
  if (addIconBtn) {
    addIconBtn.onclick = () => {
      // Scroll the picker into view
      const picker = document.getElementById('canvaIconPicker');
      if (picker) picker.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    };
  }

  // Wire icon picker buttons
  const iconPickerEl = document.getElementById('canvaIconPicker');
  if (iconPickerEl) {
    Array.from(iconPickerEl.querySelectorAll('.canva-icon-btn')).forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const iconName = (btn as HTMLElement).dataset.icon;
        if (iconName) addIconLayer(iconName);
      });
    });
  }

  const iconColorInput = document.getElementById('canvaIconColor') as HTMLInputElement | null;
  if (iconColorInput && sel && sel.type === 'icon') {
    iconColorInput.oninput = () => {
      sel.iconColor = iconColorInput.value;
      const hexEl = document.getElementById('canvaIconColorHex');
      if (hexEl) hexEl.textContent = iconColorInput.value;
      highlightPreset('canvaIconPresets', iconColorInput.value);
      drawCanvaAll();
    };
  }

  if (sel && sel.type === 'icon') {
    wireColorPresets('canvaIconPresets', c => {
      sel.iconColor = c;
      if (iconColorInput) iconColorInput.value = c;
      const hexEl = document.getElementById('canvaIconColorHex');
      if (hexEl) hexEl.textContent = c;
      highlightPreset('canvaIconPresets', c);
      drawCanvaAll();
    });
  }

  const iconSizeVal = document.getElementById('canvaIconSizeVal') as HTMLInputElement | null;
  const iconSizeMinus = document.getElementById('canvaIconSizeMinus');
  const iconSizePlus = document.getElementById('canvaIconSizePlus');
  if (sel && sel.type === 'icon') {
    const syncIconSize = (s: number) => {
      const clamped = Math.max(16, Math.min(2048, s));
      const ratio = sel.ratioLocked ? sel.ratio : sel.w / sel.h;
      sel.w = Math.round(clamped * ratio);
      sel.h = clamped;
      if (iconSizeVal) iconSizeVal.value = String(clamped);
      drawCanvaAll();
    };
    iconSizeMinus?.addEventListener('click', () => syncIconSize(Math.min(sel.w, sel.h) - 10));
    iconSizePlus?.addEventListener('click', () => syncIconSize(Math.min(sel.w, sel.h) + 10));
    iconSizeVal?.addEventListener('input', () => syncIconSize(+iconSizeVal.value || 120));
  }

  const fontSizeVal = document.getElementById('canvaFontSizeVal') as HTMLInputElement | null;
  const fontSizeMinus = document.getElementById('canvaFontSizeMinus');
  const fontSizePlus = document.getElementById('canvaFontSizePlus');
  if (sel && sel.type === 'text') {
    const syncFontSize = (s: number) => {
      sel.fontSize = Math.max(8, Math.min(512, s));
      if (fontSizeVal) fontSizeVal.value = String(sel.fontSize);
      showTextOverlay();
      drawCanvaAll();
    };
    fontSizeMinus?.addEventListener('click', () => syncFontSize((sel.fontSize || 24) - 1));
    fontSizePlus?.addEventListener('click', () => syncFontSize((sel.fontSize || 24) + 1));
    fontSizeVal?.addEventListener('input', () => syncFontSize(+fontSizeVal.value || 24));
  }

  // Bold (toggle button)
  const boldBtn = document.getElementById('canvaBold');
  if (boldBtn && sel && sel.type === 'text') {
    boldBtn.addEventListener('click', () => {
      sel.bold = !sel.bold;
      boldBtn.classList.toggle('active', sel.bold);
      showTextOverlay();
      drawCanvaAll();
    });
  }

  const fontColorInput = document.getElementById('canvaFontColor') as HTMLInputElement | null;
  if (fontColorInput && sel && sel.type === 'text') {
    fontColorInput.oninput = () => {
      sel.fontColor = fontColorInput.value;
      const hexEl = document.getElementById('canvaFontColorHex');
      if (hexEl) hexEl.textContent = fontColorInput.value;
      highlightPreset('canvaFontPresets', fontColorInput.value);
      showTextOverlay();
      drawCanvaAll();
    };
  }

  if (sel && sel.type === 'text') {
    wireColorPresets('canvaFontPresets', c => {
      sel.fontColor = c;
      if (fontColorInput) fontColorInput.value = c;
      const hexEl = document.getElementById('canvaFontColorHex');
      if (hexEl) hexEl.textContent = c;
      highlightPreset('canvaFontPresets', c);
      showTextOverlay();
      drawCanvaAll();
    });
  }

  // Font family
  const fontFamilySelect = document.getElementById('canvaFontFamily') as HTMLSelectElement | null;
  if (fontFamilySelect && sel && sel.type === 'text') {
    fontFamilySelect.onchange = () => {
      sel.fontFamily = fontFamilySelect.value;
      showTextOverlay();
      drawCanvaAll();
    };
  }

  // Italic
  const italicBtn = document.getElementById('canvaItalic');
  if (italicBtn && sel && sel.type === 'text') {
    italicBtn.addEventListener('click', () => {
      sel.italic = !sel.italic;
      italicBtn.classList.toggle('active', sel.italic);
      showTextOverlay();
      drawCanvaAll();
    });
  }

  // Underline
  const underlineBtn = document.getElementById('canvaUnderline');
  if (underlineBtn && sel && sel.type === 'text') {
    underlineBtn.addEventListener('click', () => {
      sel.underline = !sel.underline;
      underlineBtn.classList.toggle('active', sel.underline);
      showTextOverlay();
      drawCanvaAll();
    });
  }

  // Strikethrough
  const strikethroughBtn = document.getElementById('canvaStrikethrough');
  if (strikethroughBtn && sel && sel.type === 'text') {
    strikethroughBtn.addEventListener('click', () => {
      sel.strikethrough = !sel.strikethrough;
      strikethroughBtn.classList.toggle('active', sel.strikethrough);
      showTextOverlay();
      drawCanvaAll();
    });
  }

  // Text background color
  const textBgColorInput = document.getElementById('canvaTextBgColor') as HTMLInputElement | null;
  const textBgEnabled = document.getElementById('canvaTextBgEnabled') as HTMLInputElement | null;
  if (textBgColorInput && sel && sel.type === 'text') {
    textBgColorInput.oninput = () => {
      if (textBgEnabled?.checked) {
        sel.textBgColor = textBgColorInput.value;
      }
      const hexEl = document.getElementById('canvaTextBgColorHex');
      if (hexEl) hexEl.textContent = sel.textBgColor;
      highlightPreset('canvaTextBgPresets', sel.textBgColor);
      showTextOverlay();
      drawCanvaAll();
    };
  }
  if (textBgEnabled && sel && sel.type === 'text') {
    textBgEnabled.onchange = () => {
      sel.textBgColor = textBgEnabled.checked ? (textBgColorInput?.value || '#000000') : 'transparent';
      const hexEl = document.getElementById('canvaTextBgColorHex');
      if (hexEl) hexEl.textContent = sel.textBgColor;
      highlightPreset('canvaTextBgPresets', sel.textBgColor === 'transparent' ? '#000000' : sel.textBgColor);
      showTextOverlay();
      drawCanvaAll();
    };
  }
  if (sel && sel.type === 'text') {
    wireColorPresets('canvaTextBgPresets', c => {
      if (textBgEnabled) textBgEnabled.checked = true;
      sel.textBgColor = c;
      if (textBgColorInput) textBgColorInput.value = c;
      const hexEl = document.getElementById('canvaTextBgColorHex');
      if (hexEl) hexEl.textContent = c;
      highlightPreset('canvaTextBgPresets', c);
      showTextOverlay();
      drawCanvaAll();
    });
  }

  // Text shadow
  const textShadowChk = document.getElementById('canvaTextShadow') as HTMLInputElement | null;
  const textShadowColor = document.getElementById('canvaTextShadowColor') as HTMLInputElement | null;
  const textShadowBlur = document.getElementById('canvaTextShadowBlur') as HTMLInputElement | null;
  const textShadowBlurVal = document.getElementById('canvaTextShadowBlurVal');
  if (textShadowChk && sel && sel.type === 'text') {
    textShadowChk.onchange = () => {
      sel.textShadow = textShadowChk.checked;
      const opts = document.getElementById('canvaTextShadowOpts');
      if (opts) opts.style.display = sel.textShadow ? 'flex' : 'none';
      showTextOverlay();
      drawCanvaAll();
    };
  }
  if (textShadowColor && sel && sel.type === 'text') {
    textShadowColor.oninput = () => {
      sel.textShadowColor = textShadowColor.value;
      showTextOverlay();
      drawCanvaAll();
    };
  }
  if (textShadowBlur && sel && sel.type === 'text') {
    textShadowBlur.oninput = () => {
      sel.textShadowBlur = +textShadowBlur.value;
      if (textShadowBlurVal) textShadowBlurVal.textContent = sel.textShadowBlur + 'px';
      showTextOverlay();
      drawCanvaAll();
    };
  }

  // Text outline
  const textOutlineChk = document.getElementById('canvaTextOutline') as HTMLInputElement | null;
  const textOutlineColor = document.getElementById('canvaTextOutlineColor') as HTMLInputElement | null;
  const textOutlineWidth = document.getElementById('canvaTextOutlineWidth') as HTMLInputElement | null;
  const textOutlineWidthVal = document.getElementById('canvaTextOutlineWidthVal');
  if (textOutlineChk && sel && sel.type === 'text') {
    textOutlineChk.onchange = () => {
      sel.textOutline = textOutlineChk.checked;
      const opts = document.getElementById('canvaTextOutlineOpts');
      if (opts) opts.style.display = sel.textOutline ? 'flex' : 'none';
      showTextOverlay();
      drawCanvaAll();
    };
  }
  if (textOutlineColor && sel && sel.type === 'text') {
    textOutlineColor.oninput = () => {
      sel.textOutlineColor = textOutlineColor.value;
      showTextOverlay();
      drawCanvaAll();
    };
  }
  if (textOutlineWidth && sel && sel.type === 'text') {
    textOutlineWidth.oninput = () => {
      sel.textOutlineWidth = +textOutlineWidth.value;
      if (textOutlineWidthVal) textOutlineWidthVal.textContent = sel.textOutlineWidth + 'px';
      showTextOverlay();
      drawCanvaAll();
    };
  }

  const removeBtn = document.getElementById('canvaRemoveLayer');
  if (removeBtn) {
    removeBtn.onclick = () => {
      if (c.selectedIdx <= 0) return;
      c.layers.splice(c.selectedIdx, 1);
      c.selectedIdx = Math.min(c.selectedIdx, c.layers.length - 1);
      drawCanvaAll();
      renderCanvaPanel(p);
      toast('Layer removed');
    };
  }

  const backBtn = document.getElementById('canvaSendBackward');
  if (backBtn) {
    backBtn.onclick = () => {
      if (c.selectedIdx <= 0) return;
      [c.layers[c.selectedIdx], c.layers[c.selectedIdx - 1]] = [c.layers[c.selectedIdx - 1], c.layers[c.selectedIdx]];
      c.selectedIdx--;
      drawCanvaAll();
      renderCanvaPanel(p);
    };
  }

  const fwdBtn = document.getElementById('canvaBringForward');
  if (fwdBtn) {
    fwdBtn.onclick = () => {
      if (c.selectedIdx < 0 || c.selectedIdx >= c.layers.length - 1) return;
      [c.layers[c.selectedIdx], c.layers[c.selectedIdx + 1]] = [c.layers[c.selectedIdx + 1], c.layers[c.selectedIdx]];
      c.selectedIdx++;
      drawCanvaAll();
      renderCanvaPanel(p);
    };
  }

  const mergeBtn = document.getElementById('canvaMergeAll');
  if (mergeBtn) mergeBtn.onclick = mergeAllLayers;

  // Save / Load project
  const saveBtn = document.getElementById('canvaSaveProject');
  if (saveBtn) saveBtn.onclick = () => saveCanvaProject();

  const loadBtn = document.getElementById('canvaLoadProject');
  const loadFile = document.getElementById('canvaLoadFile') as HTMLInputElement | null;
  if (loadBtn && loadFile) {
    loadBtn.onclick = () => loadFile.click();
    loadFile.onchange = () => {
      if (!loadFile.files?.length) return;
      loadCanvaProject(loadFile.files[0], {
        applyZoom: applyCanvaZoom,
        draw: drawCanvaAll,
        renderPanel: renderCanvaPanel,
        showTextOverlay
      });
      loadFile.value = '';
    };
  }

  // Zoom controls
  const zoomSlider = document.getElementById('canvaZoom') as HTMLInputElement | null;
  const zoomVal = document.getElementById('canvaZoomVal');
  if (zoomSlider && zoomVal) {
    zoomSlider.oninput = () => {
      const z = +zoomSlider.value / 100;
      const canvasArea = document.getElementById('canvasArea')!;
      const vcx = canvasArea.scrollLeft + canvasArea.clientWidth / 2;
      const vcy = canvasArea.scrollTop + canvasArea.clientHeight / 2;
      applyCanvaZoom(z, { ax: vcx, ay: vcy });
      zoomVal.textContent = Math.round(z * 100) + '%';
    };
  }
  const zoomFitBtn = document.getElementById('canvaZoomFit');
  if (zoomFitBtn && zoomSlider) {
    zoomFitBtn.onclick = () => {
      zoomSlider.value = '100';
      const canvasArea = document.getElementById('canvasArea')!;
      const vcx = canvasArea.scrollLeft + canvasArea.clientWidth / 2;
      const vcy = canvasArea.scrollTop + canvasArea.clientHeight / 2;
      applyCanvaZoom(1, { ax: vcx, ay: vcy });
      if (zoomVal) zoomVal.textContent = '100%';
    };
  }

  setupCanvaEvents();
  drawCanvaAll();

  // Sync text overlay
  if (sel && sel.type === 'text') {
    showTextOverlay();
    if (!sel.text && !textOverlayEditing) {
      enterTextEdit();
    }
  } else {
    hideTextOverlay();
  }
}

function openLayerFilePicker() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.style.display = 'none';
  document.body.appendChild(input);
  input.addEventListener('change', (e: Event) => {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (f) loadOverlayLayer(f, () => {
      drawCanvaAll();
      const panel = document.getElementById('panel');
      if (panel) renderCanvaPanel(panel);
    });
    input.remove();
  });
  input.click();
}

function addTextLayer() {
  const c = S.canva;
  if (c.workspaceW === 0) return;
  const canvasArea = document.getElementById('canvasArea')!;
  const viewCX = (canvasArea.scrollLeft + canvasArea.clientWidth / 2) / c.zoom;
  const viewCY = (canvasArea.scrollTop + canvasArea.clientHeight / 2) / c.zoom;
  const w = 300;
  const h = 60;
  const x = Math.round(viewCX - w / 2);
  const y = Math.round(viewCY - h / 2);
  const layer = createTextLayer(x, y, w, h);
  c.layers.push(layer);
  c.selectedIdx = c.layers.length - 1;
  drawCanvaAll();
  const panel = document.getElementById('panel');
  if (panel) renderCanvaPanel(panel);
  setTimeout(() => { showTextOverlay(); enterTextEdit(); }, 50);
  toast('Text layer added — type to edit');
}

function addIconLayer(iconName: string) {
  const c = S.canva;
  if (c.workspaceW === 0) return;
  const canvasArea = document.getElementById('canvasArea')!;
  const viewCX = (canvasArea.scrollLeft + canvasArea.clientWidth / 2) / c.zoom;
  const viewCY = (canvasArea.scrollTop + canvasArea.clientHeight / 2) / c.zoom;
  const size = 120;
  const x = Math.round(viewCX - size / 2);
  const y = Math.round(viewCY - size / 2);
  const layer = createIconLayer(x, y, size, size, iconName);
  c.layers.push(layer);
  c.selectedIdx = c.layers.length - 1;
  drawCanvaAll();
  const panel = document.getElementById('panel');
  if (panel) renderCanvaPanel(panel);
  toast('Icon "' + iconName + '" added');
}

// ==================== TEXT OVERLAY ====================
let textOverlay: HTMLDivElement | null = null;
let textOverlayEditing = false;

function getTextOverlay(): HTMLDivElement {
  if (!textOverlay) {
    textOverlay = document.createElement('div');
    textOverlay.id = 'canvaTextOverlay';
    textOverlay.contentEditable = 'false';
    textOverlay.style.cssText = 'position:absolute;display:none;z-index:10;pointer-events:none;overflow:hidden;word-wrap:break-word;white-space:pre-wrap;font-family:sans-serif;line-height:1.3;border:0;border-radius:2px;background:transparent;';
    const canvasAreaEl = document.getElementById('canvasArea')!;
    canvasAreaEl.style.position = canvasAreaEl.style.position || 'relative';
    canvasAreaEl.appendChild(textOverlay);

    textOverlay.addEventListener('input', () => {
      const c = S.canva;
      if (c.selectedIdx >= 0) {
        const sel = c.layers[c.selectedIdx];
        if (sel.type === 'text') {
          sel.text = readCanvaEditableText(textOverlay!);
        }
      }
    });

    textOverlay.addEventListener('blur', () => {
      exitTextEdit();
    });
  }
  return textOverlay;
}

function showTextOverlay() {
  const overlay = getTextOverlay();
  const c = S.canva;
  if (c.selectedIdx < 0) { overlay.style.display = 'none'; return; }
  const sel = c.layers[c.selectedIdx];
  if (sel.type !== 'text') { overlay.style.display = 'none'; return; }

  const zoom = c.zoom;
  const rect = getCanvaTextOverlayRect(sel, zoom);

  overlay.style.display = 'block';
  overlay.style.left = rect.left + 'px';
  overlay.style.top = rect.top + 'px';
  overlay.style.width = rect.width + 'px';
  overlay.style.height = rect.height + 'px';
  overlay.style.fontSize = (sel.fontSize * zoom) + 'px';
  overlay.style.color = sel.fontColor;
  overlay.style.fontFamily = sel.fontFamily || 'sans-serif';
  overlay.style.fontWeight = sel.bold ? 'bold' : 'normal';
  overlay.style.fontStyle = sel.italic ? 'italic' : 'normal';
  const decorations: string[] = [];
  if (sel.underline) decorations.push('underline');
  if (sel.strikethrough) decorations.push('line-through');
  overlay.style.textDecoration = decorations.length ? decorations.join(' ') : 'none';
  overlay.style.opacity = String(sel.opacity);
  overlay.style.padding = (4 * zoom) + 'px';
  overlay.style.outlineWidth = (2 * zoom) + 'px';
  overlay.style.backgroundColor = sel.textBgColor === 'transparent' ? 'transparent' : (sel.textBgColor || 'transparent');

  // Text shadow
  if (sel.textShadow) {
    overlay.style.textShadow = `0 0 ${(sel.textShadowBlur || 0) * zoom}px ${sel.textShadowColor || '#000000'}`;
  } else {
    overlay.style.textShadow = 'none';
  }

  // Text outline (using -webkit-text-stroke for editable overlay)
  if (sel.textOutline) {
    overlay.style.webkitTextStroke = `${(sel.textOutlineWidth || 2) * zoom}px ${sel.textOutlineColor || '#000000'}`;
  } else {
    overlay.style.webkitTextStroke = 'none';
  }

  if (sel.angle !== 0) {
    overlay.style.transformOrigin = 'center center';
    overlay.style.transform = `rotate(${sel.angle}deg)`;
  } else {
    overlay.style.transform = '';
  }

  if (!textOverlayEditing) {
    overlay.textContent = sel.text || '';
    overlay.contentEditable = 'false';
    overlay.style.pointerEvents = 'none';
  }
}

function enterTextEdit() {
  const overlay = getTextOverlay();
  const c = S.canva;
  if (c.selectedIdx < 0) return;
  const sel = c.layers[c.selectedIdx];
  if (sel.type !== 'text') return;

  textOverlayEditing = true;
  overlay.contentEditable = 'true';
  overlay.style.pointerEvents = 'auto';
  overlay.textContent = sel.text || '';
  overlay.focus();

  if (!sel.text) {
    const range = document.createRange();
    range.selectNodeContents(overlay);
    const sel2 = window.getSelection();
    sel2?.removeAllRanges();
    sel2?.addRange(range);
  }
}

function exitTextEdit() {
  const overlay = getTextOverlay();
  textOverlayEditing = false;
  overlay.contentEditable = 'false';
  overlay.style.pointerEvents = 'none';
  drawCanvaAll();
}

function hideTextOverlay() {
  if (textOverlay) {
    textOverlay.style.display = 'none';
  }
  textOverlayEditing = false;
}

// ==================== EVENTS ====================
function setupCanvaEvents() {
  cleanupCanvaEvents();
  oc.style.cursor = 'default';

  const onDown = (e: MouseEvent) => canvaDown(e);
  const onMove = (e: MouseEvent) => canvaMove(e);
  const onUp = () => canvaUp();
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const c = S.canva;
    const rect = oc.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const step = e.deltaY < 0 ? 1.1 : 0.9;
    const newZoom = Math.max(0.25, Math.min(4, c.zoom * step));
    applyCanvaZoom(newZoom, { ax: mx, ay: my });
    const slider = document.getElementById('canvaZoom') as HTMLInputElement | null;
    const val = document.getElementById('canvaZoomVal');
    if (slider) slider.value = String(Math.round(newZoom * 100));
    if (val) val.textContent = Math.round(newZoom * 100) + '%';
  };

  oc.addEventListener('mousedown', onDown);
  oc.addEventListener('mousemove', onMove);
  oc.addEventListener('mouseup', onUp);
  oc.addEventListener('mouseleave', onUp);
  oc.addEventListener('wheel', onWheel, { passive: false });

  const onDblClick = (e: MouseEvent) => {
    const c = S.canva;
    const { mx, my } = getPos(e);
    if (c.selectedIdx >= 0) {
      const sel = c.layers[c.selectedIdx];
      if (sel.type === 'text' && isInsideLayer(mx, my, sel)) {
        e.preventDefault();
        enterTextEdit();
        return;
      }
    }
    for (let i = c.layers.length - 1; i >= 0; i--) {
      if (isInsideLayer(mx, my, c.layers[i])) {
        if (c.layers[i].type === 'text') {
          c.selectedIdx = i;
          drawCanvaAll();
          const panel = document.getElementById('panel');
          if (panel) renderCanvaPanel(panel);
          setTimeout(() => enterTextEdit(), 50);
        }
        return;
      }
    }
  };
  oc.addEventListener('dblclick', onDblClick);

  cleanupEvents = () => {
    oc.removeEventListener('mousedown', onDown);
    oc.removeEventListener('mousemove', onMove);
    oc.removeEventListener('mouseup', onUp);
    oc.removeEventListener('mouseleave', onUp);
    oc.removeEventListener('wheel', onWheel);
    oc.removeEventListener('dblclick', onDblClick);
    S.canva.dragging = false;
    S.canva.moving = false;
    S.canva.panning = false;
  };
}

export function cleanupCanvaEvents() {
  if (cleanupEvents) { cleanupEvents(); cleanupEvents = null; }
}

function applyCanvaZoom(newZoom: number, anchor?: { ax: number; ay: number }) {
  const c = S.canva;
  const oldZoom = c.zoom;
  if (oldZoom === newZoom || c.workspaceW === 0) return;
  c.zoom = newZoom;

  const canvasArea = document.getElementById('canvasArea')!;

  // Anchor is in canvas pixels from the wheel event. Convert to workspace coords.
  const ax = (anchor ? anchor.ax : oc.width / 2) / oldZoom;
  const ay = (anchor ? anchor.ay : oc.height / 2) / oldZoom;

  // Where the anchor appears on screen (relative to canvasArea)
  const areaRect = canvasArea.getBoundingClientRect();
  const viewX = ax * oldZoom - canvasArea.scrollLeft;
  const viewY = ay * oldZoom - canvasArea.scrollTop;

  const newW = Math.round(c.workspaceW * newZoom);
  const newH = Math.round(c.workspaceH * newZoom);

  // New scroll: keep the workspace anchor point at the same screen position
  const newScrollLeft = Math.round(ax * newZoom - viewX);
  const newScrollTop = Math.round(ay * newZoom - viewY);

  // Resize both canvases
  mc.width = newW; mc.height = newH;
  oc.width = newW; oc.height = newH;
  mc.style.width = newW + 'px'; mc.style.height = newH + 'px';
  oc.style.width = newW + 'px'; oc.style.height = newH + 'px';

  // Apply scroll
  canvasArea.scrollLeft = Math.max(0, newScrollLeft);
  canvasArea.scrollTop = Math.max(0, newScrollTop);

  // Redraw checkerboard on mc
  drawCheckerboardOnMc(newW, newH);

  // Update zoom indicator
  const zi = document.getElementById('zoomIndicator');
  if (zi) zi.textContent = Math.round(newZoom * 100) + '%';

  drawCanvaAll();
}

// ==================== MATH HELPERS ====================
function worldToLocal(mx: number, my: number, cx: number, cy: number, angleDeg: number) {
  const rad = -angleDeg * Math.PI / 180;
  const dx = mx - cx;
  const dy = my - cy;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return { lx: dx * cos - dy * sin, ly: dx * sin + dy * cos };
}

function hitTestHandle(mx: number, my: number, hx: number, hy: number, threshold: number) {
  return Math.abs(mx - hx) < threshold && Math.abs(my - hy) < threshold;
}

function getLayerCenter(layer: CanvaLayer) {
  return { cx: layer.x + layer.w / 2, cy: layer.y + layer.h / 2 };
}

function computeHandlePositions(layer: CanvaLayer): CanvaHandles {
  const { cx, cy } = getLayerCenter(layer);
  const a = layer.angle * Math.PI / 180;
  const cos = Math.cos(a), sin = Math.sin(a);
  const hw = layer.w / 2, hh = layer.h / 2;
  const rotDist = 30;

  const local: Record<CanvaHandleKey, [number, number]> = {
    tl: [-hw, -hh], tr: [hw, -hh], bl: [-hw, hh], br: [hw, hh],
    n: [0, -hh], s: [0, hh], w: [-hw, 0], e: [hw, 0],
    rot: [0, -hh - rotDist],
  };

  const result = {} as CanvaHandles;
  for (const [key, [lx, ly]] of Object.entries(local) as Array<[CanvaHandleKey, [number, number]]>) {
    result[key] = {
      wx: cx + lx * cos - ly * sin,
      wy: cy + lx * sin + ly * cos,
    };
  }
  return result;
}

// ==================== DRAWING ====================
function drawCanvaAll() {
  octx.clearRect(0, 0, oc.width, oc.height);
  const c = S.canva;
  if (c.layers.length === 0) return;
  const zoom = c.zoom;

  // Draw layers (layer coords are workspace units, multiply by zoom for canvas pixels)
  for (const layer of c.layers) {
    const selected = c.selectedIdx >= 0 && c.layers[c.selectedIdx] === layer;
    const cx = (layer.x + layer.w / 2) * zoom;
    const cy = (layer.y + layer.h / 2) * zoom;
    const w = layer.w * zoom;
    const h = layer.h * zoom;
    octx.save();
    octx.translate(cx, cy);
    octx.rotate(layer.angle * Math.PI / 180);
    octx.globalAlpha = layer.opacity;

    renderLayerToContext(octx, layer, w, h, selected, zoom);

    octx.restore();
  }

  // Draw selection UI for selected layer
  if (c.selectedIdx >= 0 && c.selectedIdx < c.layers.length) {
    drawSelectionUI(c.layers[c.selectedIdx]);
  }

  // Re-sync overlay position after redraw (zoom/scroll may have changed)
  if (c.selectedIdx >= 0 && c.layers[c.selectedIdx]?.type === 'text') {
    showTextOverlay();
  }
}

function drawSelectionUI(layer: CanvaLayer) {
  const zoom = S.canva.zoom;
  const cx = (layer.x + layer.w / 2) * zoom;
  const cy = (layer.y + layer.h / 2) * zoom;
  const w = layer.w * zoom;
  const h = layer.h * zoom;
  const hraw = computeHandlePositions(layer);
  // Scale handle positions to canvas pixels
  const hs = {} as CanvaHandles;
  for (const k of Object.keys(hraw) as CanvaHandleKey[]) {
    hs[k] = { wx: hraw[k].wx * zoom, wy: hraw[k].wy * zoom };
  }
  const a = layer.angle * Math.PI / 180;

  // Dashed border
  octx.save();
  octx.translate(cx, cy);
  octx.rotate(a);
  octx.strokeStyle = '#58a6ff';
  octx.lineWidth = 2;
  octx.setLineDash([6, 3]);
  octx.strokeRect(-w / 2, -h / 2, w, h);
  octx.setLineDash([]);
  octx.restore();

  // Corner handles (fixed screen-pixel size)
  drawHandles(octx, (['tl', 'tr', 'bl', 'br'] as CanvaHandleKey[]).map(key => ({
    x: hs[key].wx,
    y: hs[key].wy
  })));

  // Edge handles
  octx.fillStyle = 'rgba(255,255,255,0.6)'; octx.strokeStyle = 'rgba(88,166,255,0.6)'; octx.lineWidth = 1;
  (['n', 's', 'w', 'e'] as CanvaHandleKey[]).forEach(k => {
    const p = hs[k];
    octx.fillRect(p.wx - 3, p.wy - 3, 6, 6);
    octx.strokeRect(p.wx - 3, p.wy - 3, 6, 6);
  });

  // Rotation handle
  const rp = hs.rot;
  octx.strokeStyle = '#58a6ff'; octx.lineWidth = 2;
  octx.beginPath();
  octx.moveTo(hs.n.wx, hs.n.wy);
  octx.lineTo(rp.wx, rp.wy);
  octx.stroke();
  octx.fillStyle = '#58a6ff'; octx.strokeStyle = '#fff'; octx.lineWidth = 1.5;
  octx.beginPath();
  octx.arc(rp.wx, rp.wy, 6, 0, Math.PI * 2);
  octx.fill();
  octx.stroke();
}

// ==================== INTERACTION ====================
function getPos(e: MouseEvent) {
  const rect = oc.getBoundingClientRect();
  const zoom = S.canva.zoom;
  const rawX = e.clientX - rect.left;
  const rawY = e.clientY - rect.top;
  return {
    mx: rawX / zoom,
    my: rawY / zoom,
  };
}

function isInsideLayer(mx: number, my: number, layer: CanvaLayer) {
  const { cx, cy } = getLayerCenter(layer);
  const { lx, ly } = worldToLocal(mx, my, cx, cy, layer.angle);
  return lx >= -layer.w / 2 && lx <= layer.w / 2 && ly >= -layer.h / 2 && ly <= layer.h / 2;
}

function canvaDown(e: MouseEvent) {
  const c = S.canva;
  if (c.layers.length === 0) return;
  const { mx, my } = getPos(e);
  const zoom = c.zoom;

  // Hit test thresholds in workspace coords (screen px / zoom)
  const cornerThresh = 10 / zoom;
  const edgeThresh = 8 / zoom;

  // First, check if clicking on a handle of the selected layer
  if (c.selectedIdx >= 0) {
    const sel = c.layers[c.selectedIdx];
    const h = computeHandlePositions(sel);

    // Check rotation handle first (highest priority)
    if (hitTestHandle(mx, my, h.rot.wx, h.rot.wy, cornerThresh)) {
      c.dragging = true;
      c.dragCorner = 'rot';
      const { cx, cy } = getLayerCenter(sel);
      c.rotateOrigAngle = sel.angle;
      c.rotateStartAngle = Math.atan2(my - cy, mx - cx) * 180 / Math.PI;
      return;
    }

    // Check corner handles
    for (const k of ['tl', 'tr', 'bl', 'br'] as CanvaHandleKey[]) {
      if (hitTestHandle(mx, my, h[k].wx, h[k].wy, cornerThresh)) {
        c.dragging = true;
        c.dragCorner = k;
        c.resizeOrigX = sel.x; c.resizeOrigY = sel.y;
        c.resizeOrigW = sel.w; c.resizeOrigH = sel.h;
        c.resizeOrigAngle = sel.angle;
        return;
      }
    }

    // Check edge handles
    for (const k of ['n', 's', 'w', 'e'] as CanvaHandleKey[]) {
      if (hitTestHandle(mx, my, h[k].wx, h[k].wy, edgeThresh)) {
        c.dragging = true;
        c.dragCorner = k;
        c.resizeOrigX = sel.x; c.resizeOrigY = sel.y;
        c.resizeOrigW = sel.w; c.resizeOrigH = sel.h;
        c.resizeOrigAngle = sel.angle;
        return;
      }
    }

    // Check if inside selected layer (move)
    if (isInsideLayer(mx, my, sel)) {
      c.moving = true;
      c.moveStartX = mx; c.moveStartY = my;
      c.moveOrigX = sel.x; c.moveOrigY = sel.y;
      oc.style.cursor = 'move';
      return;
    }
  }

  // Click on an unselected layer (select it)
  for (let i = c.layers.length - 1; i >= 0; i--) {
    if (isInsideLayer(mx, my, c.layers[i])) {
      c.selectedIdx = i;
      drawCanvaAll();
      const panel = document.getElementById('panel');
      if (panel) renderCanvaPanel(panel);
      // Start move on the newly selected layer
      c.moving = true;
      c.moveStartX = mx; c.moveStartY = my;
      c.moveOrigX = c.layers[i].x; c.moveOrigY = c.layers[i].y;
      oc.style.cursor = 'move';
      return;
    }
  }

  // Clicked empty space — deselect
  c.selectedIdx = -1;
  hideTextOverlay();
  drawCanvaAll();
  const panel = document.getElementById('panel');
  if (panel) renderCanvaPanel(panel);
}

function canvaMove(e: MouseEvent) {
  const c = S.canva;
  const { mx, my } = getPos(e);

  // Panning
  if (c.panning) {
    const dx = e.clientX - c.moveStartX;
    const dy = e.clientY - c.moveStartY;
    const canvasArea = document.getElementById('canvasArea')!;
    canvasArea.scrollLeft = c.moveOrigX - dx;
    canvasArea.scrollTop = c.moveOrigY - dy;
    return;
  }

  if (c.layers.length === 0) return;

  // Hover cursors when no drag
  if (!c.dragging && !c.moving) {
    updateHoverCursor(mx, my);
  }

  // Moving
  if (c.moving && c.selectedIdx >= 0) {
    const sel = c.layers[c.selectedIdx];
    const dx = mx - c.moveStartX, dy = my - c.moveStartY;
    sel.x = c.moveOrigX + dx;
    sel.y = c.moveOrigY + dy;
    drawCanvaAll();
    return;
  }

  // Resizing
  if (c.dragging && c.dragCorner !== 'rot' && c.selectedIdx >= 0) {
    handleRotatedResize(mx, my, c.layers[c.selectedIdx]);
    drawCanvaAll();
    return;
  }

  // Rotating
  if (c.dragging && c.dragCorner === 'rot' && c.selectedIdx >= 0) {
    const sel = c.layers[c.selectedIdx];
    const { cx, cy } = getLayerCenter(sel);
    const currentAngle = Math.atan2(my - cy, mx - cx) * 180 / Math.PI;
    let newAngle = c.rotateOrigAngle + (currentAngle - c.rotateStartAngle);
    if (e.shiftKey) newAngle = Math.round(newAngle / 5) * 5;
    sel.angle = Math.round(newAngle);
    drawCanvaAll();
    return;
  }
}

function updateHoverCursor(mx: number, my: number) {
  const c = S.canva;
  const zoom = c.zoom;
  oc.style.cursor = 'default';

  // Hit test thresholds in workspace coords
  const cornerThresh = 10 / zoom;
  const edgeThresh = 8 / zoom;

  if (c.selectedIdx >= 0) {
    const sel = c.layers[c.selectedIdx];
    const h = computeHandlePositions(sel);

    if (hitTestHandle(mx, my, h.rot.wx, h.rot.wy, cornerThresh)) {
      oc.style.cursor = 'grab';
      return;
    }

    // Corners — diagonal resize cursors
    const tl = h.tl, tr = h.tr, bl = h.bl, br = h.br;
    if (hitTestHandle(mx, my, tl.wx, tl.wy, cornerThresh)) { oc.style.cursor = 'nwse-resize'; return; }
    if (hitTestHandle(mx, my, br.wx, br.wy, cornerThresh)) { oc.style.cursor = 'nwse-resize'; return; }
    if (hitTestHandle(mx, my, tr.wx, tr.wy, cornerThresh)) { oc.style.cursor = 'nesw-resize'; return; }
    if (hitTestHandle(mx, my, bl.wx, bl.wy, cornerThresh)) { oc.style.cursor = 'nesw-resize'; return; }

    // Edges
    if (hitTestHandle(mx, my, h.n.wx, h.n.wy, edgeThresh)) { oc.style.cursor = 'ns-resize'; return; }
    if (hitTestHandle(mx, my, h.s.wx, h.s.wy, edgeThresh)) { oc.style.cursor = 'ns-resize'; return; }
    if (hitTestHandle(mx, my, h.w.wx, h.w.wy, edgeThresh)) { oc.style.cursor = 'ew-resize'; return; }
    if (hitTestHandle(mx, my, h.e.wx, h.e.wy, edgeThresh)) { oc.style.cursor = 'ew-resize'; return; }

    if (isInsideLayer(mx, my, sel)) {
      oc.style.cursor = 'move';
      return;
    }
  }

  // Hover over unselected layer
  for (let i = c.layers.length - 1; i >= 0; i--) {
    if (i === c.selectedIdx) continue;
    if (isInsideLayer(mx, my, c.layers[i])) {
      oc.style.cursor = 'pointer';
      return;
    }
  }
}

function handleRotatedResize(mx: number, my: number, layer: CanvaLayer) {
  const c = S.canva;
  const anchorAngle = c.resizeOrigAngle;
  const origCx = c.resizeOrigX + c.resizeOrigW / 2;
  const origCy = c.resizeOrigY + c.resizeOrigH / 2;

  // Transform mouse into anchor's local space
  const { lx, ly } = worldToLocal(mx, my, origCx, origCy, anchorAngle);

  let left = -c.resizeOrigW / 2, right = c.resizeOrigW / 2;
  let top = -c.resizeOrigH / 2, bottom = c.resizeOrigH / 2;

  switch (c.dragCorner) {
    case 'tl': left = Math.min(lx, right - 10); top = Math.min(ly, bottom - 10); break;
    case 'tr': right = Math.max(lx, left + 10); top = Math.min(ly, bottom - 10); break;
    case 'bl': left = Math.min(lx, right - 10); bottom = Math.max(ly, top + 10); break;
    case 'br': right = Math.max(lx, left + 10); bottom = Math.max(ly, top + 10); break;
    case 'n': top = Math.min(ly, bottom - 10); break;
    case 's': bottom = Math.max(ly, top + 10); break;
    case 'w': left = Math.min(lx, right - 10); break;
    case 'e': right = Math.max(lx, left + 10); break;
  }

  // Enforce aspect ratio lock
  if (layer.ratioLocked && layer.ratio > 0) {
    const ratio = layer.ratio;
    if (c.dragCorner === 'n' || c.dragCorner === 's') {
      right = left + (bottom - top) * ratio;
    } else if (c.dragCorner === 'w' || c.dragCorner === 'e') {
      bottom = top + (right - left) / ratio;
    } else {
      // For corners, use dominant axis
      const dw = Math.abs(right - left - c.resizeOrigW);
      const dh = Math.abs(bottom - top - c.resizeOrigH);
      if (dw >= dh) { bottom = top + (right - left) / ratio; }
      else { right = left + (bottom - top) * ratio; }
    }
  }

  const newW = right - left;
  const newH = bottom - top;
  const localNewCx = (left + right) / 2;
  const localNewCy = (top + bottom) / 2;

  // Convert local center offset back to world
  const aRad = anchorAngle * Math.PI / 180;
  const cos = Math.cos(aRad), sin = Math.sin(aRad);
  const worldDx = localNewCx * cos - localNewCy * sin;
  const worldDy = localNewCx * sin + localNewCy * cos;

  layer.w = newW;
  layer.h = newH;
  layer.x = origCx + worldDx - newW / 2;
  layer.y = origCy + worldDy - newH / 2;
}

// Keyboard action exports for main.ts
export function canvaMergeAll() { mergeAllLayers(); }

export function canvaDeselect() {
  const c = S.canva;
  if (c.selectedIdx >= 0) {
    c.selectedIdx = -1;
    drawCanvaAll();
    const panel = document.getElementById('panel');
    if (panel) renderCanvaPanel(panel);
  }
}

export function canvaRemoveLayer() {
  const c = S.canva;
  if (c.selectedIdx > 0) {
    c.layers.splice(c.selectedIdx, 1);
    c.selectedIdx = Math.min(c.selectedIdx, c.layers.length - 1);
    drawCanvaAll();
    const panel = document.getElementById('panel');
    if (panel) renderCanvaPanel(panel);
    toast('Layer removed');
  }
}

// Called by topbar Fit/1:1 buttons — route through canva zoom system
export function canvaFitZoom() {
  const c = S.canva;
  if (c.workspaceW === 0 || c.workspaceH === 0) return;
  applyCanvaZoom(1);
  const slider = document.getElementById('canvaZoom') as HTMLInputElement | null;
  const val = document.getElementById('canvaZoomVal');
  if (slider) slider.value = '100';
  if (val) val.textContent = '100%';
}

export function canvaHandleResize() {
  const c = S.canva;
  if (c.workspaceW === 0 || c.workspaceH === 0) {
    // Workspace not initialized yet, nothing to do
    drawCanvaAll();
    return;
  }
  // Viewport changed but workspace stays the same — just redraw
  // Re-apply zoom to rescale canvases to new viewport-relative fit
  if (c.zoom === 1) {
    // At zoom 1, resize canvases to workspace
    mc.width = c.workspaceW; mc.height = c.workspaceH;
    oc.width = c.workspaceW; oc.height = c.workspaceH;
    mc.style.width = c.workspaceW + 'px'; mc.style.height = c.workspaceH + 'px';
    oc.style.width = c.workspaceW + 'px'; oc.style.height = c.workspaceH + 'px';
    drawCheckerboardOnMc(c.workspaceW, c.workspaceH);
  }
  drawCanvaAll();
}

export function canvaActualZoom() {
  const c = S.canva;
  if (!S.img || c.workspaceW === 0 || c.layers.length === 0) return;
  // Zoom so that the base image layer appears at 1:1 (actual pixels)
  const base = c.layers[0];
  if (base.w === 0 || base.h === 0) return;
  if (!base.img) return;
  const imgW = base.img.width;
  const displayW = base.w;
  const z = imgW / displayW;
  applyCanvaZoom(Math.max(0.25, Math.min(4, z)));
  const slider = document.getElementById('canvaZoom') as HTMLInputElement | null;
  const val = document.getElementById('canvaZoomVal');
  if (slider) slider.value = String(Math.round(z * 100));
  if (val) val.textContent = Math.round(z * 100) + '%';
}

function canvaUp() {
  const c = S.canva;
  if (c.panning) oc.style.cursor = 'default';
  c.dragging = false;
  c.moving = false;
  c.panning = false;
  c.dragCorner = null;
}

// ==================== MERGE ====================
async function mergeAllLayers() {
  const c = S.canva;
  if (c.layers.length === 0) { toast('No layers'); return; }

  pushHistory('Canva Merge');
  showLoading('Merging layers...');

  const base = c.layers[0];
  const merge = computeCanvaMergeGeometry(c.layers);
  const outW = merge.width;
  const outH = merge.height;
  const scaleX = merge.scaleX;
  const scaleY = merge.scaleY;

  const out = document.createElement('canvas');
  out.width = outW;
  out.height = outH;
  const outCtx = out.getContext('2d')!;
  if (!outCtx) {
    hideLoading();
    toast('Merge failed: no canvas context');
    return;
  }

  outCtx.clearRect(0, 0, outW, outH);

  for (const layer of c.layers) {
    outCtx.save();
    const cx = (layer.x - base.x + layer.w / 2) * scaleX + merge.offsetX;
    const cy = (layer.y - base.y + layer.h / 2) * scaleY + merge.offsetY;
    outCtx.translate(cx, cy);
    outCtx.rotate(layer.angle * Math.PI / 180);
    outCtx.globalAlpha = layer.opacity;

    const lw = layer.w * scaleX;
    const lh = layer.h * scaleY;

    renderLayerToContext(outCtx, layer, lw, lh, false, scaleX);

    outCtx.restore();
  }

  // Load merged result as an image
  let nimg: HTMLImageElement;
  try {
    nimg = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Image decode failed'));
      img.src = out.toDataURL('image/png');
    });
  } catch (err) {
    hideLoading();
    toast('Merge failed: ' + (err as Error).message);
    return;
  }

  S.img = nimg;
  c.layers = [];
  c.selectedIdx = -1;
  c.workspaceW = 0;
  c.workspaceH = 0;
  c.dragging = false;
  c.moving = false;
  c.panning = false;
  c.dragCorner = null;

  hideLoading();
  toast('All layers merged');

  // Re-render the canva panel (workspace remains open)
  const panel = document.getElementById('panel');
  if (panel) renderCanvaPanel(panel);
}
