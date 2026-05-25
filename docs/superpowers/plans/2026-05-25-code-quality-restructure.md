# Code Quality & Structure Overhaul — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve codebase maintainability by extracting shared utilities, fixing types, splitting canva.ts into focused modules, and cleaning up tool lifecycle management — zero behavior changes.

**Architecture:** Create `utils.ts` as the shared foundation (5 exports replacing 8+ duplicated patterns). Fix the type system (remove `@ts-nocheck`, add missing interfaces). Split `canva.ts` from 1,480 lines into 7 modules (panel, events, draw, interact, layers, project, orchestrator). Move stray functions from `canvas.ts` to their owning tools. Consolidate `main.ts` tool lifecycle into a declarative map.

**Tech Stack:** TypeScript, Canvas API, Nuxt 3 (Vite HMR)

---

### Task 1: Create shared utilities module

**Files:**
- Create: `frontend/lib/editor/utils.ts`

- [ ] **Step 1: Write utils.ts with all 5 shared exports**

```typescript
import { S } from './state.js';

/** 10-color palette used by crop fill, canva text, and canva icon pickers. */
export const COLOR_PRESETS = ['#FFFFFF','#000000','#FF4444','#FF8800','#FFDD00','#00CC44','#0088FF','#8833FF','#FF44AA','#888888'];

/** Draw an HTMLImageElement onto a new canvas and return the canvas. */
export function canvasFromImage(img: HTMLImageElement): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth || img.width;
  c.height = img.naturalHeight || img.height;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  return c;
}

/** Create an HTMLImageElement from a canvas and wait for it to load. */
export function loadImageFromCanvas(canvas: HTMLCanvasElement): Promise<HTMLImageElement> {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.src = canvas.toDataURL('image/png');
  });
}

/** Trigger a browser download for a Blob with the given filename. */
export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Highlight the preset swatch matching `color` inside the container with `containerId`. */
export function highlightPreset(containerId: string, color: string): void {
  const presets = document.querySelectorAll('#' + containerId + ' .color-preset-swatch');
  presets.forEach(s => {
    const el = s as HTMLElement;
    el.classList.toggle('active', el.dataset.color?.toUpperCase() === color.toUpperCase());
  });
}

/** Helper: build HTML string for a row of color preset swatches. */
export function buildColorPresetsHTML(containerId: string, activeColor: string): string {
  return '<div class="color-presets" id="' + containerId + '">' +
    COLOR_PRESETS.map(c =>
      '<span class="color-preset-swatch' + (activeColor.toUpperCase() === c.toUpperCase() ? ' active' : '') + '" data-color="' + c + '" style="background:' + c + ';" title="' + c + '"></span>'
    ).join('') +
    '</div>';
}

/** Helper: wire click events on a color-presets container, calling onChange with the color. */
export function wireColorPresets(containerId: string, onChange: (color: string) => void): void {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.addEventListener('click', e => {
    const swatch = (e.target as HTMLElement).closest('.color-preset-swatch');
    if (!swatch) return;
    onChange((swatch as HTMLElement).dataset.color!);
  });
}
```

- [ ] **Step 2: Verify typecheck passes for the new file**

Run: `cd frontend && npx vue-tsc --noEmit`
Expected: no errors related to utils.ts

- [ ] **Step 3: Commit**

```bash
git add frontend/lib/editor/utils.ts
git commit -m "feat: add shared utilities module (canvasFromImage, loadImageFromCanvas, triggerDownload, color presets)"
```

---

### Task 2: Migrate files to use shared utilities

**Files:**
- Modify: `frontend/lib/editor/tools/crop.ts`
- Modify: `frontend/lib/editor/tools/canva.ts`
- Modify: `frontend/lib/editor/tools/grid.ts`
- Modify: `frontend/lib/editor/tools/rotate.ts`
- Modify: `frontend/lib/editor/tools/scale.ts`
- Modify: `frontend/lib/editor/tools/compressor.ts`
- Modify: `frontend/lib/editor/tools/bgremove.ts`
- Modify: `frontend/lib/editor/history.ts`
- Modify: `frontend/lib/editor/ui.ts`

- [ ] **Step 1: Add import to all files**

Add to each file's imports:
```typescript
import { canvasFromImage, loadImageFromCanvas, triggerDownload, COLOR_PRESETS, highlightPreset, buildColorPresetsHTML, wireColorPresets } from '../utils.js';
```
For `history.ts` (in `lib/editor/`):
```typescript
import { canvasFromImage } from './utils.js';
```
For `ui.ts` (in `lib/editor/`):
```typescript
import { canvasFromImage, triggerDownload } from './utils.js';
```

- [ ] **Step 2: Replace duplicated canvasFromImage calls**

In `history.ts`, replace the `snapshot` function's inline canvas (lines ~7-18):
```typescript
// BEFORE
const tmp = document.createElement('canvas');
tmp.width = mc.width; tmp.height = mc.height;
const tctx = tmp.getContext('2d')!;
tctx.drawImage(S.img, 0, 0, mc.width, mc.height);
// AFTER
const tmp = canvasFromImage(S.img!);
tmp.width = mc.width; tmp.height = mc.height;
const tctx = tmp.getContext('2d')!;
tctx.drawImage(S.img!, 0, 0, mc.width, mc.height);
```

In `crop.ts`, replace `canvasFromImage` function (lines ~505-511) — remove the local function and use the import. Find calls to `canvasFromImage(...)` and replace with the imported version.

In `scale.ts` (line ~88-91):
```typescript
// BEFORE
const tmp = document.createElement('canvas'); tmp.width = nw; tmp.height = nh;
const tctx = tmp.getContext('2d')!; tctx.drawImage(S.img, 0, 0, nw, nh);
// AFTER
const tmp = canvasFromImage(S.img!);
tmp.width = nw; tmp.height = nh;
const tctx = tmp.getContext('2d')!;
tctx.drawImage(S.img!, 0, 0, nw, nh);
```

In `rotate.ts` (line ~289-293): same replacement pattern.
In `bgremove.ts` (line ~173-175): same replacement pattern.
In `compressor.ts` (line ~69-72): same replacement pattern.
In `canva.ts` (lines ~1302-1306, ~1387-1394): replace with `canvasFromImage`.

- [ ] **Step 3: Replace duplicated loadImageFromCanvas calls**

In `crop.ts` (lines ~486-496 and ~537-542):
```typescript
// BEFORE
const nimg = new Image();
nimg.onload = () => { S.img = nimg; fitImage(); renderAll(); /* ... */ };
nimg.src = tmp.toDataURL('image/png');
// AFTER
const nimg = await loadImageFromCanvas(tmp);
S.img = nimg;
fitImage();
renderAll();
/* ... */
```

Note: the containing function must become `async`. Check each call site.

In `scale.ts` (line ~100-106): same pattern.
In `rotate.ts` (line ~216-218): same pattern.
In `bgremove.ts` (line ~192-198): same pattern.
In `history.ts` (lines ~32-40 and ~58-66): same pattern.

- [ ] **Step 4: Replace duplicated triggerDownload calls**

In `canva.ts` save project (lines ~1416-1420):
```typescript
// BEFORE
const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url; a.download = 'project.canva.json';
document.body.appendChild(a); a.click();
document.body.removeChild(a); URL.revokeObjectURL(url);
// AFTER
triggerDownload(new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' }), 'project.canva.json');
```

In `grid.ts` (lines ~125-129), `rotate.ts` (lines ~270-275), `compressor.ts` (lines ~100-106), `ui.ts` (lines ~118-121, ~124-129): same pattern.

- [ ] **Step 5: Replace duplicated COLOR_PRESETS arrays**

In `crop.ts` line ~51: replace inline array `${['#FFFFFF',...].map(...)}` with:
```typescript
${buildColorPresetsHTML('cropColorPresets', S.crop.fillColor)}
```

In `canva.ts` lines ~133 and ~158: replace both inline color preset arrays with:
```typescript
html += buildColorPresetsHTML('canvaFontPresets', isText ? sel.fontColor : '#ffffff');
// and
html += buildColorPresetsHTML('canvaIconPresets', isIcon ? (sel.iconColor || '#ffffff') : '#ffffff');
```

- [ ] **Step 6: Replace duplicated highlightPreset functions**

In `crop.ts`: remove the local `highlightPreset` function definition, replace with imported version. The function signature differs slightly — the imported version takes `(containerId, color)`. Update call sites:
```typescript
// BEFORE
highlightPreset(color);
// AFTER
highlightPreset('cropColorPresets', color);
```

In `canva.ts`: remove local `highlightCanvaPreset` function, replace calls with imported:
```typescript
// BEFORE
highlightCanvaPreset('canvaIconPresets', c);
// AFTER
highlightPreset('canvaIconPresets', c);
```

- [ ] **Step 7: Replace duplicated wire-up code for preset click handlers**

In `crop.ts`: replace the manual `addEventListener('click', ...)` on `cropPresetsEl` with:
```typescript
wireColorPresets('cropColorPresets', color => applyFillColor(color));
```

In `canva.ts`: replace both icon and font preset wiring with:
```typescript
wireColorPresets('canvaIconPresets', c => {
  sel.iconColor = c;
  if (iconColorInput) iconColorInput.value = c;
  const hexEl = document.getElementById('canvaIconColorHex');
  if (hexEl) hexEl.textContent = c;
  highlightPreset('canvaIconPresets', c);
  drawCanvaAll();
});
wireColorPresets('canvaFontPresets', c => {
  sel.fontColor = c;
  if (fontColorInput) fontColorInput.value = c;
  const hexEl = document.getElementById('canvaFontColorHex');
  if (hexEl) hexEl.textContent = c;
  highlightPreset('canvaFontPresets', c);
  showTextOverlay();
  drawCanvaAll();
});
```

- [ ] **Step 8: Typecheck and verify**

Run: `cd frontend && npx vue-tsc --noEmit`
Expected: no errors

- [ ] **Step 9: Commit**

```bash
git add frontend/lib/editor/tools/crop.ts frontend/lib/editor/tools/canva.ts frontend/lib/editor/tools/grid.ts frontend/lib/editor/tools/rotate.ts frontend/lib/editor/tools/scale.ts frontend/lib/editor/tools/compressor.ts frontend/lib/editor/tools/bgremove.ts frontend/lib/editor/history.ts frontend/lib/editor/ui.ts
git commit -m "refactor: migrate all tools to shared utils (canvasFromImage, triggerDownload, color presets)"
```

---

### Task 3: Fix type system — state.ts and dom.ts

**Files:**
- Modify: `frontend/lib/editor/state.ts:2,90-115,136-137`
- Modify: `frontend/lib/editor/dom.ts:1-17`

- [ ] **Step 1: Add CompressorState interface and fix EditorTool union**

In `state.ts`, change line 2:
```typescript
export type EditorTool = 'crop' | 'resize' | 'grid' | 'bgremove' | 'rotate' | 'canva' | 'compressor';
```

After the `RotateState` interface (after line 115), add:
```typescript
export interface CompressorState {
  format: 'image/jpeg' | 'image/webp';
  quality: number;
}
```

In the `EditorState` interface, after line 135, add:
```typescript
  compressor: CompressorState;
```

In the `S` initializer, after the rotate line (line 148), add:
```typescript
  compressor: { format: 'image/jpeg', quality: 80 },
```

- [ ] **Step 2: Add HandlePositions and ScaledHandles interfaces**

Add after the `CompressorState` interface in state.ts:
```typescript
export interface HandlePositions {
  tl: { x: number; y: number };
  tr: { x: number; y: number };
  br: { x: number; y: number };
  bl: { x: number; y: number };
  tm: { x: number; y: number };
  rm: { x: number; y: number };
  bm: { x: number; y: number };
  lm: { x: number; y: number };
  rot: { x: number; y: number };
}

export interface ScaledHandles {
  tl: { x: number; y: number };
  tr: { x: number; y: number };
  br: { x: number; y: number };
  bl: { x: number; y: number };
  tm: { x: number; y: number };
  rm: { x: number; y: number };
  bm: { x: number; y: number };
  lm: { x: number; y: number };
  rot: { x: number; y: number };
}
```

- [ ] **Step 3: Add getById helper to dom.ts**

Add after the `optional$` function in dom.ts:
```typescript
export function getById<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error('Missing element #' + id);
  return el as T;
}
```

- [ ] **Step 4: Typecheck and commit**

Run: `cd frontend && npx vue-tsc --noEmit`
Expected: no errors

```bash
git add frontend/lib/editor/state.ts frontend/lib/editor/dom.ts
git commit -m "refactor: add CompressorState, EditorTool union fix, HandlePositions types, getById helper"
```

---

### Task 4: Remove @ts-nocheck from all files

**Files:**
- Modify: All 15 files with `// @ts-nocheck` on line 1

- [ ] **Step 1: Remove @ts-nocheck and add proper imports**

For each file listed below, remove `// @ts-nocheck` from line 1 and fix any type errors:

| File | Likely issues to fix |
|---|---|
| `canvas.ts` | Move renderRotatePreview to rotate.ts, renderCropExpand/restoreCropCanvas to crop.ts (see Task 8) |
| `main.ts` | `toolPanels['compressor']` should work after Task 3 |
| `overlay.ts` | No issues expected |
| `ui.ts` | No issues expected after utils import |
| `crop.ts` | Remove local `canvasFromImage` function, use imported |
| `scale.ts` | No issues expected |
| `rotate.ts` | Remove local `canvasFromImage` usage |
| `grid.ts` | No issues expected |
| `bgremove.ts` | No issues expected |
| `compressor.ts` | No issues expected |
| `canva.ts` | Will be split in Tasks 5-6, handle then |
| `history.ts` | No issues expected |
| `lanczos.ts` | No issues expected |
| `canva-icons.ts` | No issues expected |
| `canva-geometry.ts` | No issues expected |
| `canva-layout.mjs` | Already doesn't use @ts-nocheck |

- [ ] **Step 2: Fix implicit any on event handler parameters**

In all files, add explicit types to event handler parameters. Examples:

```typescript
// BEFORE
el.addEventListener('click', e => { ... });
// AFTER
el.addEventListener('click', (e: MouseEvent) => { ... });

// BEFORE
el.oninput = () => { ... };
// AFTER
el.oninput = (e: Event) => { ... };

// BEFORE
function renderCanvaPanel(p) {
// AFTER
function renderCanvaPanel(p: HTMLElement) {
```

- [ ] **Step 3: Remove local canvasFromImage from crop.ts**

Delete the `function canvasFromImage(img)` at crop.ts lines ~505-511. It's now imported from utils.ts.

- [ ] **Step 4: Run typecheck until clean**

Run: `cd frontend && npx vue-tsc --noEmit`
Fix any remaining errors iteratively until zero errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: remove @ts-nocheck from all files, fix type errors"
```

---

### Task 5: Split canva.ts — panel and layers modules

**Files:**
- Create: `frontend/lib/editor/tools/canva-panel.ts`
- Create: `frontend/lib/editor/tools/canva-layers.ts`
- Modify: `frontend/lib/editor/tools/canva.ts` (remove extracted code, import from new modules)

- [ ] **Step 1: Create canva-layers.ts**

Extract from canva.ts:
- `createLayer()` function (lines ~524-526)
- `createTextLayer()` function (lines ~528-530)
- `createIconLayer()` function (lines ~532-534)
- `addTextLayer()` function (lines ~476-488)
- `addIconLayer()` function (lines ~490-506)
- `loadOverlayLayer()` function (lines ~640-668)

The file should look like:
```typescript
import { S } from '../state.js';
import { CanvaLayer } from '../state.js';
import { toast } from '../ui.js';
import { ICON_DEFS } from './canva-icons.js';
import { drawCanvaAll } from './canva-draw.js';
import { renderCanvaPanel } from './canva.js';
import { showTextOverlay } from './canva.js'; // will move to canva-draw later

export function createLayer(img: HTMLImageElement | null, x: number, y: number, w: number, h: number): CanvaLayer {
  return { img, x, y, w, h, angle: 0, opacity: 1, ratioLocked: false, ratio: w / h, type: 'image', text: '', fontSize: 24, fontColor: '#ffffff', bold: false, iconName: '', iconColor: '#ffffff' };
}

export function createTextLayer(x: number, y: number, w: number, h: number): CanvaLayer {
  return { img: null, x, y, w, h, angle: 0, opacity: 1, ratioLocked: false, ratio: w / h, type: 'text', text: '', fontSize: 24, fontColor: '#ffffff', bold: false, iconName: '', iconColor: '#ffffff' };
}

export function createIconLayer(x: number, y: number, w: number, h: number, iconName: string): CanvaLayer {
  return { img: null, x, y, w, h, angle: 0, opacity: 1, ratioLocked: false, ratio: w / h, type: 'icon', text: '', fontSize: 24, fontColor: '#ffffff', bold: false, iconName, iconColor: '#ffffff' };
}

export function addTextLayer() {
  const c = S.canva;
  if (c.workspaceW === 0) return;
  const canvasArea = document.getElementById('canvasArea')!;
  const viewCX = (canvasArea.scrollLeft + canvasArea.clientWidth / 2) / c.zoom;
  const viewCY = (canvasArea.scrollTop + canvasArea.clientHeight / 2) / c.zoom;
  const w = 300, h = 100;
  const x = Math.round(viewCX - w / 2);
  const y = Math.round(viewCY - h / 2);
  const layer = createTextLayer(x, y, w, h);
  c.layers.push(layer);
  c.selectedIdx = c.layers.length - 1;
  drawCanvaAll();
  const panel = document.getElementById('panel');
  if (panel) renderCanvaPanel(panel);
  toast('Text layer added — type to edit');
}

export function addIconLayer(iconName: string) {
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

export function loadOverlayLayer(file: File) {
  if (!file.type.startsWith('image/')) { toast('Not an image file'); return; }
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const c = S.canva;
      if (c.workspaceW === 0) return;
      const canvasArea = document.getElementById('canvasArea')!;
      const scale = Math.min(0.3, c.workspaceW * 0.3 / img.width, c.workspaceH * 0.3 / img.height);
      const lw = Math.round(img.width * scale);
      const lh = Math.round(img.height * scale);
      const viewCX = (canvasArea.scrollLeft + canvasArea.clientWidth / 2) / c.zoom;
      const viewCY = (canvasArea.scrollTop + canvasArea.clientHeight / 2) / c.zoom;
      const lx = Math.round(viewCX - lw / 2);
      const ly = Math.round(viewCY - lh / 2);
      c.layers.push(createLayer(img, lx, ly, lw, lh));
      c.selectedIdx = c.layers.length - 1;
      drawCanvaAll();
      const panel = document.getElementById('panel');
      if (panel) renderCanvaPanel(panel);
      toast('Layer added');
    };
    img.src = reader.result as string;
  };
  reader.readAsDataURL(file);
}
```

- [ ] **Step 2: Create canva-panel.ts**

Extract the HTML string generation from `renderCanvaPanel` (lines ~89-205) into a pure function:

```typescript
import { S } from '../state.js';
import { CanvaState, CanvaLayer } from '../state.js';
import { COLOR_PRESETS, buildColorPresetsHTML } from '../utils.js';
import { ICON_DEFS, ICON_NAMES } from './canva-icons.js';

export function buildCanvaPanelHTML(c: CanvaState, sel: CanvaLayer | null): string {
  const isText = sel !== null && sel.type === 'text';
  const isIcon = sel !== null && sel.type === 'icon';

  let html = '';

  html += '<div class="row" style="align-items:center;gap:6px;margin-bottom:8px;">';
  html += '<input type="range" id="canvaZoom" min="25" max="400" value="' + Math.round(c.zoom * 100) + '" style="flex:1;">';
  html += '<span class="val" id="canvaZoomVal" style="min-width:42px;text-align:center;">' + Math.round(c.zoom * 100) + '%</span>';
  html += '<button class="btn" id="canvaZoomFit" title="Fit to screen" style="padding:4px 6px;font-size:11px;">Fit</button>';
  html += '</div>';
  html += '<p class="hint" style="margin-top:-4px;">Scroll wheel to zoom, drag to pan</p>';

  html += '<h3>Canva — Layers</h3>';

  html += '<div class="layer-list" id="canvaLayerList" style="display:flex;flex-direction:column;gap:2px;margin-bottom:8px;max-height:160px;overflow-y:auto;">';
  for (let i = 0; i < c.layers.length; i++) {
    const l = c.layers[i];
    const active = i === c.selectedIdx ? ' active' : '';
    const name = i === 0 ? 'Background' : ('Layer ' + i);
    html += '<div class="layer-row' + active + '" data-idx="' + i + '" style="padding:4px 8px;cursor:pointer;border-radius:4px;font-size:12px;display:flex;justify-content:space-between;' + (active ? 'background:var(--accent);color:#fff;' : 'background:var(--bg2);') + '">';
    html += '<span>' + name + '</span>';
    html += '<span style="opacity:0.6;">' + Math.round(l.w) + 'x' + Math.round(l.h) + (l.angle !== 0 ? ' ' + l.angle + '°' : '') + '</span>';
    html += '</div>';
  }
  html += '</div>';

  html += '<div id="canvaSelControls" style="display:' + (sel ? 'flex' : 'none') + ';flex-direction:column;gap:8px;">';

  // Text controls
  html += '<div id="canvaTextControls" style="display:' + (isText ? 'flex' : 'none') + ';flex-direction:column;gap:8px;">';
  html += '<div class="col"><label>Font Size</label><div class="expand-row">';
  html += '<span class="expand-btn" id="canvaFontSizeMinus">-</span>';
  html += '<input type="number" class="expand-input" id="canvaFontSizeVal" value="' + (isText ? sel!.fontSize : 24) + '" min="8" max="512" style="width:52px;text-align:center;">';
  html += '<span class="expand-btn" id="canvaFontSizePlus">+</span>';
  html += '</div></div>';
  html += '<label><input type="checkbox" id="canvaBold"' + (isText && sel!.bold ? ' checked' : '') + '> Bold</label>';
  html += '<div class="col"><label>Text Color</label><div class="row" style="align-items:center;gap:8px;">';
  html += '<input type="color" id="canvaFontColor" value="' + (isText ? sel!.fontColor : '#ffffff') + '" style="width:28px;height:28px;border:none;border-radius:4px;cursor:pointer;padding:0;">';
  html += '<span id="canvaFontColorHex" style="font-size:12px;color:var(--text3);">' + (isText ? sel!.fontColor : '#ffffff') + '</span>';
  html += '</div>';
  html += buildColorPresetsHTML('canvaFontPresets', isText ? sel!.fontColor : '#ffffff');
  html += '</div>';
  html += '<div class="divider" id="canvaTextDivider" style="display:' + (isText ? 'block' : 'none') + ';"></div>';
  html += '</div>';

  // Icon controls
  html += '<div id="canvaIconControls" style="display:' + (isIcon ? 'flex' : 'none') + ';flex-direction:column;gap:8px;">';
  html += '<div class="col"><label>Icon</label>';
  html += '<span id="canvaIconName" style="font-size:13px;color:var(--text);padding:6px 8px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius);">' + (isIcon ? sel!.iconName : '') + '</span></div>';
  html += '<div class="col"><label>Size</label><div class="expand-row">';
  html += '<span class="expand-btn" id="canvaIconSizeMinus">-</span>';
  html += '<input type="number" class="expand-input" id="canvaIconSizeVal" value="' + (isIcon ? Math.round(Math.min(sel!.w, sel!.h)) : 120) + '" min="16" max="2048" style="width:52px;text-align:center;">';
  html += '<span class="expand-btn" id="canvaIconSizePlus">+</span>';
  html += '</div></div>';
  html += '<div class="col"><label>Icon Color</label><div class="row" style="align-items:center;gap:8px;">';
  html += '<input type="color" id="canvaIconColor" value="' + (isIcon ? (sel!.iconColor || '#ffffff') : '#ffffff') + '" style="width:28px;height:28px;border:none;border-radius:4px;cursor:pointer;padding:0;">';
  html += '<span id="canvaIconColorHex" style="font-size:12px;color:var(--text3);">' + (isIcon ? (sel!.iconColor || '#ffffff') : '#ffffff') + '</span>';
  html += '</div>';
  html += buildColorPresetsHTML('canvaIconPresets', isIcon ? (sel!.iconColor || '#ffffff') : '#ffffff');
  html += '</div>';
  html += '<div class="divider" id="canvaIconDivider" style="display:' + (isIcon ? 'block' : 'none') + ';"></div>';
  html += '</div>';

  html += '<div class="col"><label>Opacity: <span class="val" id="canvaOpacityVal">' + (sel ? Math.round(sel.opacity * 100) + '%' : '100%') + '</span></label>';
  html += '<input type="range" id="canvaOpacity" min="5" max="100" value="' + (sel ? Math.round(sel.opacity * 100) : 100) + '"></div>';
  html += '<div class="col"><label>Rotation: <span class="val" id="canvaAngleVal">' + (sel ? sel.angle + '°' : '0°') + '</span></label>';
  html += '<input type="range" id="canvaAngle" min="-180" max="180" value="' + (sel ? sel.angle : 0) + '"></div>';
  html += '<label><input type="checkbox" id="canvaLockRatio"' + (sel && sel.ratioLocked ? ' checked' : '') + '> Lock aspect ratio</label>';
  html += '</div>';

  // Buttons
  html += '<div style="margin-top:8px;display:flex;flex-direction:column;gap:6px;">';
  html += '<div class="row" style="gap:4px;">';
  html += '<button class="btn primary btn-block" id="canvaAddLayer" style="flex:1;">Add Image</button>';
  html += '<button class="btn primary btn-block" id="canvaAddText" style="flex:1;">Add Text</button>';
  html += '</div>';
  html += '<button class="btn btn-block" id="canvaAddIcon">Add Icon</button>';
  html += '<div id="canvaIconPicker" style="display:none;">';
  for (const iconName of ICON_NAMES) {
    const def = ICON_DEFS[iconName];
    const paint = def.style === 'fill'
      ? ' fill="currentColor"'
      : ' fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
    html += '<button class="canva-icon-btn" data-icon="' + iconName + '" title="' + iconName + '">';
    html += '<svg width="18" height="18" viewBox="0 0 24 24"' + paint + '><path d="' + def.path.replace(/"/g, '&quot;') + '"/></svg>';
    html += '</button>';
  }
  html += '</div>';
  html += '<button class="btn btn-block" id="canvaRemoveLayer"' + (c.selectedIdx <= 0 ? ' disabled' : '') + '>Remove Layer</button>';
  html += '<div class="row" style="gap:4px;">';
  html += '<button class="btn btn-block" id="canvaSendBackward" title="Send backward"' + (c.selectedIdx <= 0 ? ' disabled' : '') + '>Back</button>';
  html += '<button class="btn btn-block" id="canvaBringForward" title="Bring forward"' + (c.selectedIdx < 0 || c.selectedIdx >= c.layers.length - 1 ? ' disabled' : '') + '>Forward</button>';
  html += '</div>';
  html += '<div class="divider"></div>';
  html += '<button class="btn btn-block" id="canvaMergeAll" style="background:var(--success);color:#fff;">Merge All & Flatten</button>';
  html += '<div class="row" style="gap:4px;margin-top:4px;">';
  html += '<button class="btn btn-block" id="canvaSaveProject">Save Project</button>';
  html += '<button class="btn btn-block" id="canvaLoadProject">Load Project</button>';
  html += '</div>';
  html += '<input type="file" id="canvaLoadFile" accept=".canva.json" style="display:none;">';
  html += '</div>';
  html += '<p class="hint" style="margin-top:8px;">Click to select & move. Double-click text to edit. Corner/edge handles to resize. Top handle to rotate. Enter to merge.</p>';

  return html;
}
```

- [ ] **Step 3: Update canva.ts to import from new modules**

Remove the extracted functions and add imports:
```typescript
import { buildCanvaPanelHTML } from './canva-panel.js';
import { createLayer, createTextLayer, createIconLayer, addTextLayer, addIconLayer, loadOverlayLayer } from './canva-layers.js';
```

Update `renderCanvaPanel` to use `buildCanvaPanelHTML`:
```typescript
const sel = c.selectedIdx >= 0 ? c.layers[c.selectedIdx] : null;
p.innerHTML = buildCanvaPanelHTML(c, sel);
// ... rest of wiring code remains
```

- [ ] **Step 4: Verify typecheck**

Run: `cd frontend && npx vue-tsc --noEmit`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/editor/tools/canva-panel.ts frontend/lib/editor/tools/canva-layers.ts frontend/lib/editor/tools/canva.ts
git commit -m "refactor: extract canva panel HTML and layer management into separate modules"
```

---

### Task 6: Split canva.ts — draw, interact, events modules

**Files:**
- Create: `frontend/lib/editor/tools/canva-draw.ts`
- Create: `frontend/lib/editor/tools/canva-interact.ts`
- Create: `frontend/lib/editor/tools/canva-events.ts`
- Modify: `frontend/lib/editor/tools/canva.ts` (remove extracted code, import from new modules)

- [ ] **Step 1: Create canva-draw.ts**

Extract from canva.ts:
- `drawCanvaAll()` function (lines ~828-950)
- `drawSelectionUI()` function (lines ~885-950)
- New shared `renderLayerToContext()` function extracted from the layer-type switch in drawCanvaAll

The key new function:
```typescript
import { S, CanvaLayer } from '../state.js';
import { ICON_DEFS } from './canva-icons.js';
import { shouldPaintLayerContent } from './canva-layout.mjs';
import { layoutCanvaText } from './canva-layout.mjs';
import { computeHandlePositions } from './canva-interact.js';
import { oc, octx } from '../dom.js';

export function renderLayerToContext(ctx: CanvasRenderingContext2D, layer: CanvaLayer, w: number, h: number, selected: boolean): void {
  if (!shouldPaintLayerContent(layer, selected)) {
    if (layer.img) ctx.drawImage(layer.img, -w / 2, -h / 2, w, h);
    return;
  }

  if (layer.type === 'text') {
    const padding = 4;
    ctx.font = (layer.bold ? 'bold ' : '') + layer.fontSize + 'px sans-serif';
    ctx.fillStyle = layer.fontColor;
    ctx.textBaseline = 'top';
    const lines = layoutCanvaText(layer.text || '', w - padding * 2, value => ctx.measureText(value).width);
    const lineHeight = layer.fontSize * 1.3;
    const left = -w / 2 + padding;
    const top = -h / 2 + padding;
    for (let li = 0; li < lines.length; li++) {
      const ly = top + li * lineHeight;
      if (ly + lineHeight > h / 2) break;
      ctx.fillText(lines[li], left, ly);
    }
  } else if (layer.type === 'icon' && ICON_DEFS[layer.iconName]) {
    const def = ICON_DEFS[layer.iconName];
    const iconSize = Math.min(w, h);
    const s = iconSize / 24;
    const ox = (w - 24 * s) / 2;
    const oy = (h - 24 * s) / 2;
    ctx.translate(-w / 2 + ox, -h / 2 + oy);
    ctx.scale(s, s);
    const path = new Path2D(def.path);
    if (def.style === 'fill') {
      ctx.fillStyle = layer.iconColor || '#ffffff';
      ctx.fill(path);
    } else {
      ctx.strokeStyle = layer.iconColor || '#ffffff';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke(path);
    }
  } else if (layer.img) {
    ctx.drawImage(layer.img, -w / 2, -h / 2, w, h);
  }
}

export function drawCanvaAll() {
  octx.clearRect(0, 0, oc.width, oc.height);
  const c = S.canva;
  if (c.layers.length === 0) return;
  const zoom = c.zoom;

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
    renderLayerToContext(octx, layer, w, h, selected);
    octx.restore();
  }

  drawSelectionUI();
}

export function drawSelectionUI() {
  const c = S.canva;
  if (c.layers.length === 0 || c.selectedIdx < 0) return;
  const sel = c.layers[c.selectedIdx];
  const zoom = c.zoom;
  const handles = computeHandlePositions(sel, zoom);

  octx.save();
  // Draw selection border
  octx.strokeStyle = '#58a6ff';
  octx.lineWidth = 2;
  octx.setLineDash([6, 3]);
  const cx = (sel.x + sel.w / 2) * zoom;
  const cy = (sel.y + sel.h / 2) * zoom;
  const w = sel.w * zoom;
  const h = sel.h * zoom;
  octx.translate(cx, cy);
  octx.rotate(sel.angle * Math.PI / 180);
  octx.strokeRect(-w / 2, -h / 2, w, h);
  octx.setLineDash([]);
  octx.restore();

  // Draw handles
  const handleSize = 8;
  octx.fillStyle = '#58a6ff';
  octx.strokeStyle = '#fff';
  octx.lineWidth = 1.5;
  const hs = handles as Record<string, { x: number; y: number }>;
  for (const key of ['tl','tr','br','bl','tm','rm','bm','lm','rot'] as const) {
    octx.fillRect(hs[key].x - handleSize / 2, hs[key].y - handleSize / 2, handleSize, handleSize);
    octx.strokeRect(hs[key].x - handleSize / 2, hs[key].y - handleSize / 2, handleSize, handleSize);
  }
}
```

- [ ] **Step 2: Create canva-interact.ts**

Extract from canva.ts:
- `worldToLocal()`, `hitTest()`, `getLayerCenter()` functions
- `computeHandlePositions()` function
- `getPos()`, `canvaDown()`, `canvaMove()` interaction functions
- Hover cursor logic

- [ ] **Step 3: Create canva-events.ts**

Extract from canva.ts:
- `setupCanvaEvents()` function (lines ~674-723)
- `cleanupCanvaEvents` (the `cleanupEvents` module-level variable and its management)
- Wheel zoom handler
- `applyCanvaZoom()` function
- `canvaFitZoom()`, `canvaActualZoom()` exports

- [ ] **Step 4: Create canva-project.ts**

Extract from canva.ts:
- `imageToDataURL()` function
- `saveCanvaProject()` function
- `loadCanvaProject()` function
- `finishLoad()` function

- [ ] **Step 5: Update canva.ts to import from all new modules**

```typescript
import { buildCanvaPanelHTML } from './canva-panel.js';
import { createLayer, createTextLayer, createIconLayer, addTextLayer, addIconLayer, loadOverlayLayer } from './canva-layers.js';
import { drawCanvaAll, drawSelectionUI, renderLayerToContext } from './canva-draw.js';
import { computeHandlePositions, hitTest, canvaDown, canvaMove, getPos } from './canva-interact.js';
import { applyCanvaZoom, canvaFitZoom, canvaActualZoom, setupCanvaEvents, cleanupCanvaEvents } from './canva-events.js';
import { saveCanvaProject, loadCanvaProject } from './canva-project.js';
```

`canva.ts` should now be ~120 lines with only `renderCanvaPanel` (workspace init + panel wiring), `mergeAllLayers` (which uses `renderLayerToContext`), text overlay management, and re-exports.

- [ ] **Step 6: Use renderLayerToContext in mergeAllLayers**

Replace the duplicated text/icon/image rendering block in `mergeAllLayers` with:
```typescript
outCtx.save();
outCtx.translate(offsetX + lx + lw / 2, offsetY + ly + lh / 2);
outCtx.rotate(layer.angle * Math.PI / 180);
outCtx.globalAlpha = layer.opacity;
renderLayerToContext(outCtx, layer, lw, lh, false);
outCtx.restore();
```

- [ ] **Step 7: Verify typecheck**

Run: `cd frontend && npx vue-tsc --noEmit`
Expected: no errors

- [ ] **Step 8: Commit**

```bash
git add frontend/lib/editor/tools/canva-draw.ts frontend/lib/editor/tools/canva-interact.ts frontend/lib/editor/tools/canva-events.ts frontend/lib/editor/tools/canva-project.ts frontend/lib/editor/tools/canva.ts
git commit -m "refactor: split canva.ts into draw, interact, events, and project modules"
```

---

### Task 7: Move renderRotatePreview and renderCropExpand to their owning tools

**Files:**
- Modify: `frontend/lib/editor/tools/rotate.ts` (add renderRotatePreview)
- Modify: `frontend/lib/editor/tools/crop.ts` (add renderCropExpand, restoreCropCanvas)
- Modify: `frontend/lib/editor/canvas.ts` (remove these functions, keep fitImage/renderAll/applyWork/resetWork)
- Modify: `frontend/lib/editor/main.ts` (update imports)

- [ ] **Step 1: Move renderRotatePreview to rotate.ts**

Cut from canvas.ts lines 36-59. Paste into rotate.ts. Update import in rotate.ts to import needed dependencies.

In main.ts, update the import:
```typescript
// BEFORE
import { fitImage, renderAll, renderRotatePreview, renderCropExpand, restoreCropCanvas } from './canvas.js';
// AFTER
import { fitImage, renderAll } from './canvas.js';
import { renderRotatePreview } from './tools/rotate.js';
import { renderCropExpand, restoreCropCanvas } from './tools/crop.js';
```

- [ ] **Step 2: Move renderCropExpand and restoreCropCanvas to crop.ts**

Cut from canvas.ts lines 61-85. Paste into crop.ts.

- [ ] **Step 3: Clean up canvas.ts**

Remove `renderRotatePreview`, `renderCropExpand`, `restoreCropCanvas`. Keep:
```typescript
export function fitImage() { ... }
export function renderAll() { ... }
export function applyWork() { ... }
export function resetWork() { ... }
```

- [ ] **Step 4: Verify typecheck**

Run: `cd frontend && npx vue-tsc --noEmit`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/editor/tools/rotate.ts frontend/lib/editor/tools/crop.ts frontend/lib/editor/canvas.ts frontend/lib/editor/main.ts
git commit -m "refactor: move renderRotatePreview to rotate.ts, renderCropExpand/restoreCropCanvas to crop.ts"
```

---

### Task 8: Clean up main.ts — tool lifecycle and locked previews

**Files:**
- Modify: `frontend/lib/editor/main.ts`

- [ ] **Step 1: Replace lockedToolPreviews with a single generic message**

Remove the entire `lockedToolPreviews` object (lines ~41-80). Replace the `renderLockedToolPanel` function:
```typescript
function renderLockedToolPanel(tool: string) {
  const title = toolStatusLabels[tool] || 'Tool';
  panel.innerHTML = `
    <div class="locked-panel">
      <div class="locked-panel-overlay">
        <div class="locked-panel-card">
          <span class="locked-panel-kicker">Image required</span>
          <strong>Load an image to enable ${title}</strong>
          <p>Open a file to start editing.</p>
          <button class="btn primary btn-block" id="lockedOpenImage">Open Image</button>
        </div>
      </div>
    </div>
  `;
  const openBtn = document.getElementById('lockedOpenImage');
  if (openBtn) openBtn.addEventListener('click', () => ($('btnOpen') as HTMLElement).click());
}
```

- [ ] **Step 2: Consolidate tool lifecycle into a declarative map**

Replace the scattered `if (S.tool === 'x')` blocks in `switchTool` with a `ToolLifecycle` map:

```typescript
interface ToolLifecycle {
  onEnter?: () => void;
  onExit?: () => void;
  onKeyEnter?: () => void;
  onKeyEscape?: () => void;
}

const toolLifecycles: Record<string, ToolLifecycle> = {
  canva: {
    onEnter: () => {
      if (S.img) { ctx.clearRect(0, 0, mc.width, mc.height); drawCheckerboard(); }
    },
    onExit: () => {
      S.canva.layers = []; S.canva.selectedIdx = -1;
      S.canva.zoom = 1; S.canva.workspaceW = 0; S.canva.workspaceH = 0;
      cleanupCanvaEvents();
      canvasArea.style.overflow = 'hidden';
      canvasArea.style.alignItems = 'center';
      canvasArea.style.justifyContent = 'center';
      if (S.img) { fitImage(); renderAll(); }
    },
    onKeyEnter: () => canvaMergeAll(),
    onKeyEscape: () => canvaDeselect(),
  },
  // crop, rotate, grid entries follow the same pattern
};

// Replace the scattered conditionals:
function switchTool(tool: EditorTool) {
  const changingTool = S.tool !== tool;
  const prev = toolLifecycles[S.tool];
  const next = toolLifecycles[tool];

  if (changingTool && prev?.onExit) prev.onExit();
  S.tool = tool;
  // ... update UI, call next.onEnter if S.img or tool === 'canva'
  if (changingTool && next?.onEnter && (S.img || tool === 'canva')) next.onEnter();
  // ...
}
```

- [ ] **Step 3: Update handleToolKeys to use the lifecycle map**

```typescript
function handleToolKeys(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    const lc = toolLifecycles[S.tool];
    if (lc?.onKeyEnter) lc.onKeyEnter();
  }
  if (e.key === 'Escape') {
    const lc = toolLifecycles[S.tool];
    if (lc?.onKeyEscape) lc.onKeyEscape();
  }
  // ... other keys
}
```

- [ ] **Step 4: Verify typecheck**

Run: `cd frontend && npx vue-tsc --noEmit`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/editor/main.ts
git commit -m "refactor: consolidate tool lifecycle into declarative map, simplify locked previews"
```

---

### Task 9: Extract shared handle drawing in overlay.ts

**Files:**
- Modify: `frontend/lib/editor/overlay.ts`
- Modify: `frontend/lib/editor/tools/canva-draw.ts` (import shared helper)

- [ ] **Step 1: Add shared drawHandles function to overlay.ts**

Add this export after the existing `drawCropOverlay` function:
```typescript
export interface Handle {
  x: number;
  y: number;
}

export function drawHandles(octx: CanvasRenderingContext2D, handles: Handle[], size: number = 8): void {
  octx.fillStyle = '#58a6ff';
  octx.strokeStyle = '#fff';
  octx.lineWidth = 1.5;
  for (const h of handles) {
    octx.fillRect(h.x - size / 2, h.y - size / 2, size, size);
    octx.strokeRect(h.x - size / 2, h.y - size / 2, size, size);
  }
}
```

- [ ] **Step 2: Update drawSelectionUI in canva-draw.ts**

Replace the inline handle drawing loop with:
```typescript
import { drawHandles, Handle } from '../overlay.js';

// Inside drawSelectionUI, replace the handle drawing section:
const handleList: Handle[] = ['tl','tr','br','bl','tm','rm','bm','lm','rot'].map(k => hs[k]);
drawHandles(octx, handleList, 8);
```

- [ ] **Step 3: Verify typecheck**

Run: `cd frontend && npx vue-tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add frontend/lib/editor/overlay.ts frontend/lib/editor/tools/canva-draw.ts
git commit -m "refactor: extract shared drawHandles helper in overlay.ts"
```

---

### Task 10: Final verification

- [ ] **Step 1: Run full typecheck**

Run: `cd frontend && npx vue-tsc --noEmit`
Expected: zero errors

- [ ] **Step 2: Start dev server and smoke test**

Run: `cd frontend && npm run dev`
Open http://127.0.0.1:3000

Verify each tool manually:
- Load an image, switch to each tool, verify panel renders
- Canva: add text layer, change font size (±1 buttons, type custom value), toggle bold, change color (presets + native picker)
- Canva: add icon layer, change size, change color
- Canva: add image layer, resize with handles, rotate
- Canva: save project, reload page, load project
- Canva: merge all layers, verify output
- Crop: expand canvas, eyedropper, color presets, crop and resize
- Rotate: presets, custom angle, snapshots, flip
- Grid: split preview, export cells
- Scale: dimension and percentage resize
- Compressor: format/quality sliders, download
- Background Remove: AI removal
- Undo/redo across tools
- File open, save, keyboard shortcuts

- [ ] **Step 3: Commit final state if needed**

```bash
git add -A
git commit -m "chore: final verification — all typechecks pass, all tools functional"
```
