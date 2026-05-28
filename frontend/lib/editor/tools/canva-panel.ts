import type { CanvaLayer, CanvaState } from '../state.js';
import { buildColorPresetsHTML } from '../utils.js';
import { ICON_DEFS, ICON_NAMES } from './canva-icons.js';

const FONT_OPTIONS = [
  { value: 'sans-serif', label: 'Sans-serif' },
  { value: 'serif', label: 'Serif' },
  { value: 'monospace', label: 'Monospace' },
  { value: 'Arial, sans-serif', label: 'Arial' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: 'Impact, sans-serif', label: 'Impact' },
  { value: '"Courier New", monospace', label: 'Courier New' },
  { value: 'cursive', label: 'Cursive' },
];

function sanitizeColor(c: string | undefined, fallback = '#000000'): string {
  if (!c || c === 'transparent') return c || fallback;
  return /^#[0-9a-fA-F]{6}$/.test(c) ? c : fallback;
}

export function buildCanvaPanelHTML(c: CanvaState, sel: CanvaLayer | null): string {
  let html = '';

  // ── Zoom & Navigation ──
  html += '<div class="canva-section">';
  html += '<div class="canva-section-title">Zoom & Navigation</div>';
  html += '<div class="row" style="align-items:center;gap:6px;">';
  html += '<input type="range" id="canvaZoom" min="25" max="400" value="' + Math.round(c.zoom * 100) + '" title="Zoom level" style="flex:1;">';
  html += '<span class="val" id="canvaZoomVal" style="min-width:42px;text-align:center;">' + Math.round(c.zoom * 100) + '%</span>';
  html += '<button class="btn" id="canvaZoomFit" title="Fit to screen" style="padding:4px 6px;font-size:11px;">Fit</button>';
  html += '</div>';
  html += '<p class="hint" style="margin:0;">Scroll wheel to zoom, drag to pan</p>';
  html += '</div>';

  // ── Layers ──
  html += '<div class="canva-section">';
  html += '<div class="canva-section-title">Layers</div>';
  html += '<div class="layer-list" id="canvaLayerList">';
  for (let i = 0; i < c.layers.length; i++) {
    const layer = c.layers[i];
    const active = i === c.selectedIdx ? ' active' : '';
    const name = i === 0 ? 'Background' : `Layer ${i}`;
    const badge = layer.type === 'text' ? 'T' : layer.type === 'icon' ? 'I' : 'IMG';
    html += `<div class="layer-row${active}" data-idx="${i}">`;
    html += `<span class="layer-badge">${badge}</span>`;
    html += `<span class="layer-name">${name}</span>`;
    html += `<span class="layer-meta">${Math.round(layer.w)}×${Math.round(layer.h)}${layer.angle !== 0 ? ' ' + layer.angle + '°' : ''}</span>`;
    html += '</div>';
  }
  html += '</div>';

  html += '<div class="row" style="gap:4px;">';
  html += '<button class="btn btn-sm btn-block" id="canvaSendBackward" title="Send backward"' + (c.selectedIdx <= 0 ? ' disabled' : '') + '><span>↓ Back</span></button>';
  html += '<button class="btn btn-sm btn-block" id="canvaBringForward" title="Bring forward"' + (c.selectedIdx < 0 || c.selectedIdx >= c.layers.length - 1 ? ' disabled' : '') + '><span>Forward ↑</span></button>';
  html += '</div>';
  html += '</div>';

  // ── Selected Layer Controls ──
  if (sel) {
    html += '<div class="canva-section" id="canvaSelControls">';
    html += '<div class="canva-section-title">Transform</div>';

    html += '<div class="col"><label>Opacity: <span class="val" id="canvaOpacityVal">' + Math.round(sel.opacity * 100) + '%</span></label>';
    html += '<input type="range" id="canvaOpacity" min="5" max="100" value="' + Math.round(sel.opacity * 100) + '" title="Layer opacity"></div>';

    html += '<div class="col"><label>Rotation: <span class="val" id="canvaAngleVal">' + sel.angle + '°</span></label>';
    html += '<input type="range" id="canvaAngle" min="-180" max="180" value="' + sel.angle + '" title="Layer rotation"></div>';

    html += '<label title="Lock width/height ratio"><input type="checkbox" id="canvaLockRatio"' + (sel.ratioLocked ? ' checked' : '') + '> Lock aspect ratio</label>';
    html += '</div>';
  }

  // ── Text-specific Controls ──
  const isText = !!sel && sel.type === 'text';
  if (isText) {
    html += '<div class="canva-section" id="canvaTextControls">';
    html += '<div class="canva-section-title">Text Formatting</div>';

    // Font family
    html += '<div class="col"><label>Font Family</label><select id="canvaFontFamily" title="Font family">';
    for (const opt of FONT_OPTIONS) {
      html += `<option value="${opt.value}"${sel.fontFamily === opt.value ? ' selected' : ''}>${opt.label}</option>`;
    }
    html += '</select></div>';

    // Font size
    html += '<div class="col"><label>Font Size</label><div class="expand-row">';
    html += '<span class="expand-btn" id="canvaFontSizeMinus" title="Decrease font size">−</span>';
    html += '<input type="number" class="expand-input" id="canvaFontSizeVal" value="' + sel.fontSize + '" min="8" max="512" title="Font size" style="width:52px;text-align:center;">';
    html += '<span class="expand-btn" id="canvaFontSizePlus" title="Increase font size">+</span></div></div>';

    // Formatting buttons
    html += '<div class="col"><label>Style</label><div class="format-row">';
    html += '<button class="format-btn' + (sel.bold ? ' active' : '') + '" id="canvaBold" title="Bold"><strong>B</strong></button>';
    html += '<button class="format-btn' + (sel.italic ? ' active' : '') + '" id="canvaItalic" title="Italic"><em>I</em></button>';
    html += '<button class="format-btn' + (sel.underline ? ' active' : '') + '" id="canvaUnderline" title="Underline"><u>U</u></button>';
    html += '<button class="format-btn' + (sel.strikethrough ? ' active' : '') + '" id="canvaStrikethrough" title="Strikethrough"><s>S</s></button>';
    html += '</div></div>';

    // Font color
    html += '<div class="col"><label>Font Color</label><div class="row" style="align-items:center;gap:8px;">';
    html += '<input type="color" id="canvaFontColor" value="' + sanitizeColor(sel.fontColor, '#ffffff') + '" title="Font color" style="width:28px;height:28px;border:none;border-radius:4px;cursor:pointer;padding:0;">';
    html += '<span id="canvaFontColorHex" style="font-size:12px;color:var(--text3);">' + sanitizeColor(sel.fontColor, '#ffffff') + '</span></div>';
    html += buildColorPresetsHTML('canvaFontPresets', sanitizeColor(sel.fontColor, '#ffffff'));
    html += '</div>';

    // Text background
    html += '<div class="col"><label>Text Background</label><div class="row" style="align-items:center;gap:8px;">';
    html += '<input type="color" id="canvaTextBgColor" value="' + (sel.textBgColor === 'transparent' ? '#000000' : sanitizeColor(sel.textBgColor)) + '" title="Text background color" style="width:28px;height:28px;border:none;border-radius:4px;cursor:pointer;padding:0;">';
    html += '<span id="canvaTextBgColorHex" style="font-size:12px;color:var(--text3);">' + sel.textBgColor + '</span>';
    html += '<label title="Enable text background"><input type="checkbox" id="canvaTextBgEnabled"' + (sel.textBgColor !== 'transparent' ? ' checked' : '') + '> Enable</label></div>';
    html += buildColorPresetsHTML('canvaTextBgPresets', sel.textBgColor === 'transparent' ? '#000000' : sanitizeColor(sel.textBgColor));
    html += '</div>';

    // Text shadow
    html += '<div class="col"><div class="toggle-row"><label title="Enable text shadow"><input type="checkbox" id="canvaTextShadow"' + (sel.textShadow ? ' checked' : '') + '> Text Shadow</label></div>';
    html += '<div id="canvaTextShadowOpts" style="display:' + (sel.textShadow ? 'flex' : 'none') + ';flex-direction:column;gap:6px;padding-left:20px;">';
    html += '<div class="row" style="align-items:center;gap:8px;"><input type="color" id="canvaTextShadowColor" value="' + sanitizeColor(sel.textShadowColor) + '" title="Shadow color" style="width:28px;height:28px;border:none;border-radius:4px;cursor:pointer;padding:0;">';
    html += '<span style="font-size:12px;color:var(--text3);">Blur:</span><input type="range" id="canvaTextShadowBlur" min="0" max="20" value="' + sel.textShadowBlur + '" title="Shadow blur radius" style="flex:1;">';
    html += '<span id="canvaTextShadowBlurVal" class="val" style="min-width:28px;">' + sel.textShadowBlur + 'px</span></div>';
    html += '</div></div>';

    // Text outline
    html += '<div class="col"><div class="toggle-row"><label title="Enable text outline"><input type="checkbox" id="canvaTextOutline"' + (sel.textOutline ? ' checked' : '') + '> Text Outline</label></div>';
    html += '<div id="canvaTextOutlineOpts" style="display:' + (sel.textOutline ? 'flex' : 'none') + ';flex-direction:column;gap:6px;padding-left:20px;">';
    html += '<div class="row" style="align-items:center;gap:8px;"><input type="color" id="canvaTextOutlineColor" value="' + sanitizeColor(sel.textOutlineColor) + '" title="Outline color" style="width:28px;height:28px;border:none;border-radius:4px;cursor:pointer;padding:0;">';
    html += '<span style="font-size:12px;color:var(--text3);">Width:</span><input type="range" id="canvaTextOutlineWidth" min="1" max="10" value="' + sel.textOutlineWidth + '" title="Outline width" style="flex:1;">';
    html += '<span id="canvaTextOutlineWidthVal" class="val" style="min-width:28px;">' + sel.textOutlineWidth + 'px</span></div>';
    html += '</div></div>';

    html += '</div>';
  }

  // ── Icon-specific Controls ──
  const isIcon = !!sel && sel.type === 'icon';
  if (isIcon) {
    html += '<div class="canva-section" id="canvaIconControls">';
    html += '<div class="canva-section-title">Icon</div>';
    html += '<div class="col"><label>Icon</label><span id="canvaIconName" style="font-size:13px;color:var(--text);padding:6px 8px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius);display:inline-block;">' + sel.iconName + '</span></div>';
    html += '<div class="col"><label>Size</label><div class="expand-row"><span class="expand-btn" id="canvaIconSizeMinus" title="Decrease icon size">−</span>';
    html += '<input type="number" class="expand-input" id="canvaIconSizeVal" value="' + Math.round(Math.min(sel.w, sel.h)) + '" min="16" max="2048" title="Icon size" style="width:52px;text-align:center;">';
    html += '<span class="expand-btn" id="canvaIconSizePlus" title="Increase icon size">+</span></div></div>';
    html += '<div class="col"><label>Icon Color</label><div class="row" style="align-items:center;gap:8px;">';
    html += '<input type="color" id="canvaIconColor" value="' + sanitizeColor(sel.iconColor, '#ffffff') + '" title="Icon color" style="width:28px;height:28px;border:none;border-radius:4px;cursor:pointer;padding:0;">';
    html += '<span id="canvaIconColorHex" style="font-size:12px;color:var(--text3);">' + sanitizeColor(sel.iconColor, '#ffffff') + '</span></div>';
    html += buildColorPresetsHTML('canvaIconPresets', sanitizeColor(sel.iconColor, '#ffffff'));
    html += '</div>';
  }

  // ── Actions ──
  html += '<div class="canva-section">';
  html += '<div class="canva-section-title">Actions</div>';
  html += '<div class="row" style="gap:4px;">';
  html += '<button class="btn primary btn-block" id="canvaAddLayer" title="Add image layer" style="flex:1;">+ Image</button>';
  html += '<button class="btn primary btn-block" id="canvaAddText" title="Add text layer" style="flex:1;">+ Text</button>';
  html += '</div>';
  html += '<button class="btn btn-block" id="canvaAddIcon" title="Add icon layer">+ Icon</button>';

  // Persistent icon picker grid
  html += '<div id="canvaIconPicker">';
  for (const iconName of ICON_NAMES) {
    const iconDef = ICON_DEFS[iconName];
    const iconPaint = iconDef.style === 'fill'
      ? ' fill="currentColor"'
      : ' fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
    html += '<button class="canva-icon-btn" data-icon="' + iconName + '" title="' + iconName + '">';
    html += '<svg width="18" height="18" viewBox="0 0 24 24"' + iconPaint + '><path d="' + iconDef.path.replace(/"/g, '&quot;') + '"/></svg>';
    html += '</button>';
  }
  html += '</div>';

  html += '<button class="btn btn-block danger" id="canvaRemoveLayer" title="Remove selected layer"' + (c.selectedIdx <= 0 ? ' disabled' : '') + '>\u{1F5D1} Remove Layer</button>';
  html += '<div class="divider"></div>';
  html += '<button class="btn primary btn-block" id="canvaMergeAll" title="Merge all layers into one image">Merge All & Flatten</button>';
  html += '<div class="row" style="gap:4px;margin-top:4px;">';
  html += '<button class="btn btn-block" id="canvaSaveProject" title="Save project to file">Save Project</button>';
  html += '<button class="btn btn-block" id="canvaLoadProject" title="Load project from file">Load Project</button>';
  html += '</div>';
  html += '<input type="file" id="canvaLoadFile" accept=".canva.json" style="display:none;">';
  html += '</div>';

  html += '<p class="hint" style="margin-top:8px;">Click to select & move. Double-click text to edit. Corner/edge handles to resize. Top handle to rotate. Enter to merge.</p>';

  return html;
}
