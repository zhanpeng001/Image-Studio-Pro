import type { CanvaLayer, CanvaState } from '../state.js';
import { buildColorPresetsHTML } from '../utils.js';
import { ICON_DEFS, ICON_NAMES } from './canva-icons.js';

export function buildCanvaPanelHTML(c: CanvaState, sel: CanvaLayer | null): string {
  let html = '';

  html += '<div class="row" style="align-items:center;gap:6px;margin-bottom:8px;">';
  html += '<input type="range" id="canvaZoom" min="25" max="400" value="' + Math.round(c.zoom * 100) + '" style="flex:1;">';
  html += '<span class="val" id="canvaZoomVal" style="min-width:42px;text-align:center;">' + Math.round(c.zoom * 100) + '%</span>';
  html += '<button class="btn" id="canvaZoomFit" title="Fit to screen" style="padding:4px 6px;font-size:11px;">Fit</button>';
  html += '</div>';
  html += '<p class="hint" style="margin-top:-4px;">Scroll wheel to zoom, drag to pan</p>';
  html += '<h3>Canva &mdash; Layers</h3>';
  html += '<div class="layer-list" id="canvaLayerList" style="display:flex;flex-direction:column;gap:2px;margin-bottom:8px;max-height:160px;overflow-y:auto;">';
  for (let i = 0; i < c.layers.length; i++) {
    const layer = c.layers[i];
    const active = i === c.selectedIdx ? ' active' : '';
    const name = i === 0 ? 'Background' : `Layer ${i}`;
    html += `<div class="layer-row${active}" data-idx="${i}" style="padding:4px 8px;cursor:pointer;border-radius:4px;font-size:12px;display:flex;justify-content:space-between;${active ? 'background:var(--accent);color:#fff;' : 'background:var(--bg2);'}">`;
    html += `<span>${name}</span>`;
    html += `<span style="opacity:0.6;">${Math.round(layer.w)}x${Math.round(layer.h)} ${layer.angle !== 0 ? layer.angle + '&deg;' : ''}</span>`;
    html += '</div>';
  }
  html += '</div>';
  html += '<div id="canvaSelControls" style="display:' + (sel ? 'flex' : 'none') + ';flex-direction:column;gap:8px;">';

  const isText = !!sel && sel.type === 'text';
  html += '<div id="canvaTextControls" style="display:' + (isText ? 'flex' : 'none') + ';flex-direction:column;gap:8px;">';
  html += '<div class="col"><label>Font Size</label><div class="expand-row">';
  html += '<span class="expand-btn" id="canvaFontSizeMinus">-</span>';
  html += '<input type="number" class="expand-input" id="canvaFontSizeVal" value="' + (isText ? sel.fontSize : 24) + '" min="8" max="512" style="width:52px;text-align:center;">';
  html += '<span class="expand-btn" id="canvaFontSizePlus">+</span></div></div>';
  html += '<label><input type="checkbox" id="canvaBold"' + (isText && sel.bold ? ' checked' : '') + '> Bold</label>';
  html += '<div class="col"><label>Text Color</label><div class="row" style="align-items:center;gap:8px;">';
  html += '<input type="color" id="canvaFontColor" value="' + (isText ? sel.fontColor : '#ffffff') + '" style="width:28px;height:28px;border:none;border-radius:4px;cursor:pointer;padding:0;">';
  html += '<span id="canvaFontColorHex" style="font-size:12px;color:var(--text3);">' + (isText ? sel.fontColor : '#ffffff') + '</span></div>';
  html += buildColorPresetsHTML('canvaFontPresets', isText ? sel.fontColor : '#ffffff');
  html += '</div><div class="divider" id="canvaTextDivider" style="display:' + (isText ? 'block' : 'none') + ';"></div></div>';

  const isIcon = !!sel && sel.type === 'icon';
  html += '<div id="canvaIconControls" style="display:' + (isIcon ? 'flex' : 'none') + ';flex-direction:column;gap:8px;">';
  html += '<div class="col"><label>Icon</label><span id="canvaIconName" style="font-size:13px;color:var(--text);padding:6px 8px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius);">' + (isIcon ? sel.iconName : '') + '</span></div>';
  html += '<div class="col"><label>Size</label><div class="expand-row"><span class="expand-btn" id="canvaIconSizeMinus">-</span>';
  html += '<input type="number" class="expand-input" id="canvaIconSizeVal" value="' + (isIcon ? Math.round(Math.min(sel.w, sel.h)) : 120) + '" min="16" max="2048" style="width:52px;text-align:center;">';
  html += '<span class="expand-btn" id="canvaIconSizePlus">+</span></div></div>';
  html += '<div class="col"><label>Icon Color</label><div class="row" style="align-items:center;gap:8px;">';
  html += '<input type="color" id="canvaIconColor" value="' + (isIcon ? (sel.iconColor || '#ffffff') : '#ffffff') + '" style="width:28px;height:28px;border:none;border-radius:4px;cursor:pointer;padding:0;">';
  html += '<span id="canvaIconColorHex" style="font-size:12px;color:var(--text3);">' + (isIcon ? (sel.iconColor || '#ffffff') : '#ffffff') + '</span></div>';
  html += buildColorPresetsHTML('canvaIconPresets', isIcon ? (sel.iconColor || '#ffffff') : '#ffffff');
  html += '</div><div class="divider" id="canvaIconDivider" style="display:' + (isIcon ? 'block' : 'none') + ';"></div></div>';
  html += '<div class="col"><label>Opacity: <span class="val" id="canvaOpacityVal">' + (sel ? Math.round(sel.opacity * 100) + '%' : '100%') + '</span></label>';
  html += '<input type="range" id="canvaOpacity" min="5" max="100" value="' + (sel ? Math.round(sel.opacity * 100) : 100) + '"></div>';
  html += '<div class="col"><label>Rotation: <span class="val" id="canvaAngleVal">' + (sel ? sel.angle + '&deg;' : '0&deg;') + '</span></label>';
  html += '<input type="range" id="canvaAngle" min="-180" max="180" value="' + (sel ? sel.angle : 0) + '"></div>';
  html += '<label><input type="checkbox" id="canvaLockRatio"' + (sel && sel.ratioLocked ? ' checked' : '') + '> Lock aspect ratio</label></div>';

  html += '<div style="margin-top:8px;display:flex;flex-direction:column;gap:6px;"><div class="row" style="gap:4px;">';
  html += '<button class="btn primary btn-block" id="canvaAddLayer" style="flex:1;">Add Image</button>';
  html += '<button class="btn primary btn-block" id="canvaAddText" style="flex:1;">Add Text</button></div>';
  html += '<button class="btn btn-block" id="canvaAddIcon">Add Icon</button><div id="canvaIconPicker" style="display:none;">';
  for (const iconName of ICON_NAMES) {
    const iconDef = ICON_DEFS[iconName];
    const iconPaint = iconDef.style === 'fill'
      ? ' fill="currentColor"'
      : ' fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
    html += '<button class="canva-icon-btn" data-icon="' + iconName + '" title="' + iconName + '">';
    html += '<svg width="18" height="18" viewBox="0 0 24 24"' + iconPaint + '><path d="' + iconDef.path.replace(/"/g, '&quot;') + '"/></svg></button>';
  }
  html += '</div>';
  html += '<button class="btn btn-block" id="canvaRemoveLayer"' + (c.selectedIdx <= 0 ? ' disabled' : '') + '>Remove Layer</button>';
  html += '<div class="row" style="gap:4px;"><button class="btn btn-block" id="canvaSendBackward" title="Send backward"' + (c.selectedIdx <= 0 ? ' disabled' : '') + '>Back</button>';
  html += '<button class="btn btn-block" id="canvaBringForward" title="Bring forward"' + (c.selectedIdx < 0 || c.selectedIdx >= c.layers.length - 1 ? ' disabled' : '') + '>Forward</button></div>';
  html += '<div class="divider"></div><button class="btn btn-block" id="canvaMergeAll" style="background:var(--success);color:#fff;">Merge All & Flatten</button>';
  html += '<div class="row" style="gap:4px;margin-top:4px;"><button class="btn btn-block" id="canvaSaveProject">Save Project</button>';
  html += '<button class="btn btn-block" id="canvaLoadProject">Load Project</button></div>';
  html += '<input type="file" id="canvaLoadFile" accept=".canva.json" style="display:none;"></div>';
  html += '<p class="hint" style="margin-top:8px;">Click to select & move. Double-click text to edit. Corner/edge handles to resize. Top handle to rotate. Enter to merge.</p>';
  return html;
}
