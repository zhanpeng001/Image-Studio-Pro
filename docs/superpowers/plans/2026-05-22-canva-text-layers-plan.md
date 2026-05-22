# Canva Text Layers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add text layers to the Canva workspace with inline contenteditable editing, font size number input, and full color picker.

**Architecture:** Extend `CanvaLayer` with optional text fields (`type`, `text`, `fontSize`, `fontColor`). A contenteditable `<div>` overlay sits on top of the canvas area — shown as display-only (pointer-events: none) when a text layer is selected, becoming editable on double-click or for newly created layers. Rendering branches on `layer.type`: image layers use `drawImage()`, text layers use `fillText()`.

**Tech Stack:** TypeScript, HTML Canvas API, CSS

---

## File Structure

| File | Change | Responsibility |
|------|--------|---------------|
| `frontend/lib/editor/state.ts` | Modify | Add `type`, `text`, `fontSize`, `fontColor` to `CanvaLayer`; update defaults |
| `frontend/lib/editor/tools/canva.ts` | Modify | Text layer factory, panel controls, contenteditable overlay, rendering branch, merge branch, deselect-on-empty-click |
| `frontend/lib/editor/tools/canva-geometry.ts` | Modify | Handle `base.img` being null for text layer merge geometry fallback |
| `frontend/assets/css/editor.css` | Modify | Style the text overlay div |

---

### Task 1: Extend CanvaLayer data model and add text factory

**Files:**
- Modify: `frontend/lib/editor/state.ts`
- Modify: `frontend/lib/editor/tools/canva.ts`

- [ ] **Step 1: Add text fields to CanvaLayer interface**

In `frontend/lib/editor/state.ts`, replace the `CanvaLayer` interface (lines 45-55):

```typescript
export interface CanvaLayer {
  img: HTMLImageElement | null;
  x: number;
  y: number;
  w: number;
  h: number;
  angle: number;
  opacity: number;
  ratioLocked: boolean;
  ratio: number;
  type: 'image' | 'text';
  text: string;
  fontSize: number;
  fontColor: string;
}
```

- [ ] **Step 2: Backfill existing layers to include new fields**

In `frontend/lib/editor/tools/canva.ts`, update the `createLayer` function (line 260-262):

```typescript
function createLayer(img, x, y, w, h): any {
  return { img, x, y, w, h, angle: 0, opacity: 1, ratioLocked: false, ratio: w / h, type: 'image', text: '', fontSize: 24, fontColor: '#ffffff' };
}
```

- [ ] **Step 3: Add createTextLayer factory function**

In `frontend/lib/editor/tools/canva.ts`, add after `createLayer`:

```typescript
function createTextLayer(x: number, y: number, w: number, h: number): any {
  return { img: null, x, y, w, h, angle: 0, opacity: 1, ratioLocked: false, ratio: w / h, type: 'text', text: '', fontSize: 24, fontColor: '#ffffff' };
}
```

- [ ] **Step 4: Verify the project typechecks**

Run: `cd frontend && npx vue-tsc --noEmit 2>&1 | head -40`
Expected: Type errors may appear from existing code accessing `layer.img` without null check — those will be resolved in subsequent tasks.

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/editor/state.ts frontend/lib/editor/tools/canva.ts
git commit -m "feat: extend CanvaLayer model with text fields and createTextLayer factory"
```

---

### Task 2: Add contenteditable overlay management

**Files:**
- Modify: `frontend/lib/editor/tools/canva.ts`

- [ ] **Step 1: Add overlay helper functions**

In `frontend/lib/editor/tools/canva.ts`, add after the `createTextLayer` function (after line 265):

```typescript
// ==================== TEXT OVERLAY ====================
let textOverlay: HTMLDivElement | null = null;
let textOverlayEditing = false;

function getTextOverlay(): HTMLDivElement {
  if (!textOverlay) {
    textOverlay = document.createElement('div');
    textOverlay.id = 'canvaTextOverlay';
    textOverlay.contentEditable = 'false';
    textOverlay.style.cssText = 'position:absolute;display:none;z-index:10;pointer-events:none;outline:none;overflow:hidden;word-wrap:break-word;white-space:pre-wrap;font-family:sans-serif;line-height:1.3;border:2px dashed #58a6ff;border-radius:2px;background:transparent;';
    const canvasAreaEl = document.getElementById('canvasArea')!;
    canvasAreaEl.style.position = canvasAreaEl.style.position || 'relative';
    canvasAreaEl.appendChild(textOverlay);

    textOverlay.addEventListener('input', () => {
      const c = S.canva;
      if (c.selectedIdx >= 0) {
        const sel = c.layers[c.selectedIdx];
        if (sel.type === 'text') {
          sel.text = textOverlay!.textContent || '';
        }
      }
    });

    textOverlay.addEventListener('blur', () => {
      // Clicking outside exits edit mode
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

  const canvasAreaEl = document.getElementById('canvasArea')!;
  const zoom = c.zoom;
  const left = sel.x * zoom - canvasAreaEl.scrollLeft;
  const top = sel.y * zoom - canvasAreaEl.scrollTop;
  const w = sel.w * zoom;
  const h = sel.h * zoom;

  overlay.style.display = 'block';
  overlay.style.left = left + 'px';
  overlay.style.top = top + 'px';
  overlay.style.width = w + 'px';
  overlay.style.height = h + 'px';
  overlay.style.fontSize = (sel.fontSize * zoom) + 'px';
  overlay.style.color = sel.fontColor;
  overlay.style.padding = (4 * zoom) + 'px';
  overlay.style.borderWidth = (2 * zoom) + 'px';

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

  // Select all text on first focus for new layers
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
}

function hideTextOverlay() {
  if (textOverlay) {
    textOverlay.style.display = 'none';
  }
  textOverlayEditing = false;
}
```

- [ ] **Step 2: Integrate overlay into renderCanvaPanel**

In `renderCanvaPanel()`, at the end of the function (before the final closing brace, after the `setupCanvaEvents()` call at line 241), add:

```typescript
  // Sync text overlay
  if (sel && sel.type === 'text') {
    showTextOverlay();
    // Auto-enter edit mode for newly created empty text layers
    if (!sel.text && !textOverlayEditing) {
      enterTextEdit();
    }
  } else {
    hideTextOverlay();
  }
```

- [ ] **Step 3: Sync overlay after drawCanvaAll**

In `drawCanvaAll()`, at the end of the function (after line 449), add:

```typescript
  // Re-sync overlay position after redraw (zoom/scroll may have changed)
  if (c.selectedIdx >= 0 && c.layers[c.selectedIdx]?.type === 'text') {
    showTextOverlay();
  }
```

- [ ] **Step 4: Verify overlay appears in browser**

Start the dev server and check: overlay div is created in canvasArea when Canva tool is active.

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/editor/tools/canva.ts
git commit -m "feat: add contenteditable text overlay for Canva text layers"
```

---

### Task 3: Add text rendering on canvas (deselected state)

**Files:**
- Modify: `frontend/lib/editor/tools/canva.ts`

- [ ] **Step 1: Add text rendering helper**

In `frontend/lib/editor/tools/canva.ts`, add after the overlay section:

```typescript
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  for (const word of words) {
    const testLine = currentLine ? currentLine + ' ' + word : word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines.length > 0 ? lines : [''];
}
```

- [ ] **Step 2: Branch rendering in drawCanvaAll for text layers**

In `drawCanvaAll()`, replace the layer drawing loop (lines 432-443):

```typescript
  for (const layer of c.layers) {
    const cx = (layer.x + layer.w / 2) * zoom;
    const cy = (layer.y + layer.h / 2) * zoom;
    const w = layer.w * zoom;
    const h = layer.h * zoom;
    octx.save();
    octx.translate(cx, cy);
    octx.rotate(layer.angle * Math.PI / 180);
    octx.globalAlpha = layer.opacity;

    if (layer.type === 'text') {
      octx.font = (layer.fontSize * zoom) + 'px sans-serif';
      octx.fillStyle = layer.fontColor;
      octx.textBaseline = 'top';
      const padding = 4 * zoom;
      const lines = wrapText(octx, layer.text || '', w - padding * 2);
      const lineHeight = layer.fontSize * zoom * 1.3;
      for (let li = 0; li < lines.length; li++) {
        const ly = padding + li * lineHeight;
        if (ly + lineHeight > h) break; // clip to box height
        octx.fillText(lines[li], padding, ly);
      }
    } else if (layer.img) {
      octx.drawImage(layer.img, -w / 2, -h / 2, w, h);
    }

    octx.restore();
  }
```

- [ ] **Step 3: Verify rendering visually**

Start dev server, load an image, go to Canva. Text layers should render with proper font, color, wrapping, opacity, and rotation when deselected.

- [ ] **Step 4: Commit**

```bash
git add frontend/lib/editor/tools/canva.ts
git commit -m "feat: render text layers on canvas with word wrapping"
```

---

### Task 4: Add panel controls (Add Text button, font size, color picker)

**Files:**
- Modify: `frontend/lib/editor/tools/canva.ts`

- [ ] **Step 1: Add text controls HTML in renderCanvaPanel**

In `renderCanvaPanel()`, replace the `#canvaSelControls` div HTML block (lines 108-118) to include text controls:

```typescript
  html += '<div id="canvaSelControls" style="display:' + (sel ? 'flex' : 'none') + ';flex-direction:column;gap:8px;">';

  // Text-specific controls (only for text layers)
  const isText = sel && sel.type === 'text';
  html += '<div id="canvaTextControls" style="display:' + (isText ? 'flex' : 'none') + ';flex-direction:column;gap:8px;">';
  html += '<div class="col"><label>Font Size</label>';
  html += '<input type="number" id="canvaFontSize" value="' + (isText ? sel.fontSize : 24) + '" min="8" max="512" style="width:100%;"></div>';
  html += '<div class="col"><label>Text Color</label>';
  html += '<div class="row" style="align-items:center;gap:8px;">';
  html += '<input type="color" id="canvaFontColor" value="' + (isText ? sel.fontColor : '#ffffff') + '" style="width:36px;height:36px;border:none;border-radius:4px;cursor:pointer;padding:0;">';
  html += '<span id="canvaFontColorHex" style="font-size:12px;color:var(--text3);">' + (isText ? sel.fontColor : '#ffffff') + '</span>';
  html += '</div></div>';
  html += '<div class="divider" id="canvaTextDivider" style="display:' + (isText ? 'block' : 'none') + ';"></div>';
  html += '</div>'; // end canvaTextControls

  html += '<div class="col"><label>Opacity: <span class="val" id="canvaOpacityVal">' + (sel ? Math.round(sel.opacity * 100) + '%' : '100%') + '</span></label>';
  html += '<input type="range" id="canvaOpacity" min="5" max="100" value="' + (sel ? Math.round(sel.opacity * 100) : 100) + '"></div>';

  html += '<div class="col"><label>Rotation: <span class="val" id="canvaAngleVal">' + (sel ? sel.angle + '°' : '0°') + '</span></label>';
  html += '<input type="range" id="canvaAngle" min="-180" max="180" value="' + (sel ? sel.angle : 0) + '"></div>';

  html += '<label><input type="checkbox" id="canvaLockRatio"' + (sel && sel.ratioLocked ? ' checked' : '') + '> Lock aspect ratio</label>';

  html += '</div>'; // end selControls
```

- [ ] **Step 2: Add "Add Text" button in action buttons area**

In `renderCanvaPanel()`, replace the action buttons block (lines 121-130) to include Add Text:

```typescript
  html += '<div style="margin-top:8px;display:flex;flex-direction:column;gap:6px;">';
  html += '<div class="row" style="gap:4px;">';
  html += '<button class="btn primary btn-block" id="canvaAddLayer" style="flex:1;">Add Image</button>';
  html += '<button class="btn primary btn-block" id="canvaAddText" style="flex:1;">Add Text</button>';
  html += '</div>';
  html += '<button class="btn btn-block" id="canvaRemoveLayer"' + (c.selectedIdx <= 0 ? ' disabled' : '') + '>Remove Layer</button>';
  html += '<div class="row" style="gap:4px;">';
  html += '<button class="btn btn-block" id="canvaSendBackward" title="Send backward"' + (c.selectedIdx <= 0 ? ' disabled' : '') + '>Back</button>';
  html += '<button class="btn btn-block" id="canvaBringForward" title="Bring forward"' + (c.selectedIdx < 0 || c.selectedIdx >= c.layers.length - 1 ? ' disabled' : '') + '>Forward</button>';
  html += '</div>';
  html += '<div class="divider"></div>';
  html += '<button class="btn btn-block" id="canvaMergeAll" style="background:var(--success);color:#fff;">Merge All & Flatten</button>';
  html += '</div>';
```

- [ ] **Step 3: Wire up Add Text button event**

In `renderCanvaPanel()`, add after the existing `addBtn` wiring (after line 177):

```typescript
  const addTextBtn = document.getElementById('canvaAddText');
  if (addTextBtn) addTextBtn.onclick = () => addTextLayer();
```

- [ ] **Step 4: Wire up font size and color events**

In `renderCanvaPanel()`, add after the lock ratio checkbox wiring (after line 174):

```typescript
  const fontSizeInput = document.getElementById('canvaFontSize');
  if (fontSizeInput && sel && sel.type === 'text') {
    fontSizeInput.oninput = () => {
      sel.fontSize = Math.max(8, Math.min(512, +fontSizeInput.value || 24));
      fontSizeInput.value = sel.fontSize;
      showTextOverlay();
    };
  }

  const fontColorInput = document.getElementById('canvaFontColor');
  if (fontColorInput && sel && sel.type === 'text') {
    fontColorInput.oninput = () => {
      sel.fontColor = fontColorInput.value;
      const hexEl = document.getElementById('canvaFontColorHex');
      if (hexEl) hexEl.textContent = fontColorInput.value;
      showTextOverlay();
    };
  }
```

- [ ] **Step 5: Add addTextLayer function**

Add after `openLayerFilePicker` (after line 257):

```typescript
function addTextLayer() {
  const c = S.canva;
  if (c.workspaceW === 0) return;
  const canvasArea = document.getElementById('canvasArea')!;
  // Place text box at viewport center in workspace coords
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
  // Auto-enter edit mode for the new text layer
  setTimeout(() => { showTextOverlay(); enterTextEdit(); }, 50);
  toast('Text layer added — type to edit');
}
```

- [ ] **Step 6: Commit**

```bash
git add frontend/lib/editor/tools/canva.ts
git commit -m "feat: add text controls panel, Add Text button, and font size/color inputs"
```

---

### Task 5: Deselect on empty click and double-click to edit text

**Files:**
- Modify: `frontend/lib/editor/tools/canva.ts`

- [ ] **Step 1: Change empty-space click to deselect instead of pan**

In `canvaDown()`, replace the "Clicked empty space — start panning" block (lines 599-606):

```typescript
  // Clicked empty space — deselect
  c.selectedIdx = -1;
  hideTextOverlay();
  drawCanvaAll();
  const panel = document.getElementById('panel');
  if (panel) renderCanvaPanel(panel);
```

- [ ] **Step 2: Double-click text layer to enter edit mode**

In `canvaDown()`, add after selecting an unselected layer and before starting the move (after line 593, inside the click-on-unselected-layer block):

Replace lines 583-597:

```typescript
  // Click on an unselected layer (select it)
  for (let i = c.layers.length - 1; i >= 0; i--) {
    if (isInsideLayer(mx, my, c.layers[i])) {
      const wasDifferent = c.selectedIdx !== i;
      c.selectedIdx = i;
      drawCanvaAll();
      const panel = document.getElementById('panel');
      if (panel) renderCanvaPanel(panel);

      // Start move on the newly selected layer
      c.moving = true;
      c.moveStartX = mx; c.moveStartY = my;
      c.moveOrigX = c.layers[i].x; c.moveOrigY = c.layers[i].y;
      oc.style.cursor = 'move';

    }
  }
```

Add after the canvaDown function a double-click handler on the overlay canvas. In `setupCanvaEvents` (after the wheel handler, line 315), add:

```typescript
  const onDblClick = (e) => {
    const c = S.canva;
    const { mx, my } = getPos(e);
    // Check if double-clicking on selected text layer
    if (c.selectedIdx >= 0) {
      const sel = c.layers[c.selectedIdx];
      if (sel.type === 'text' && isInsideLayer(mx, my, sel)) {
        e.preventDefault();
        enterTextEdit();
        return;
      }
    }
    // Double-click on any layer triggers edit for text, merge for others
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
```

Update cleanup to include the dblclick listener. In `cleanupEvents` (line 323), add:

```typescript
    oc.removeEventListener('dblclick', onDblClick);
```

- [ ] **Step 3: Update the hint text**

In `renderCanvaPanel()`, update the hint (line 132):

```typescript
  html += '<p class="hint" style="margin-top:8px;">Click to select & move. Double-click text to edit. Corner/edge handles to resize. Top handle to rotate. Enter to merge.</p>';
```

- [ ] **Step 4: Commit**

```bash
git add frontend/lib/editor/tools/canva.ts
git commit -m "feat: deselect on empty click, double-click text layer to edit"
```

---

### Task 6: Branch merge for text layers

**Files:**
- Modify: `frontend/lib/editor/tools/canva.ts`
- Modify: `frontend/lib/editor/tools/canva-geometry.ts`

- [ ] **Step 1: Handle base.img being null in merge geometry**

In `frontend/lib/editor/tools/canva-geometry.ts`, update `computeCanvaMergeGeometry` (lines 30-35):

```typescript
export function computeCanvaMergeGeometry(layers) {
  const base = layers[0];
  const baseW = imageWidth(base.img) || base.w || 1;
  const baseH = imageHeight(base.img) || base.h || 1;
  const scaleX = baseW / (base.w || 1);
  const scaleY = baseH / (base.h || 1);
```

The `imageWidth`/`imageHeight` helpers already handle null via optional chaining — they return 1 for null. But the fallback should use `base.w` for text layers rather than 1. The change above adds `|| base.w` and `|| base.h` as fallbacks.

- [ ] **Step 2: Branch merge rendering for text layers**

In `mergeAllLayers()`, replace the layer drawing loop (lines 867-882):

```typescript
  for (const layer of c.layers) {
    outCtx.save();
    const cx = (layer.x - base.x + layer.w / 2) * scaleX + merge.offsetX;
    const cy = (layer.y - base.y + layer.h / 2) * scaleY + merge.offsetY;
    outCtx.translate(cx, cy);
    outCtx.rotate(layer.angle * Math.PI / 180);
    outCtx.globalAlpha = layer.opacity;

    const lw = layer.w * scaleX;
    const lh = layer.h * scaleY;

    if (layer.type === 'text') {
      outCtx.font = (layer.fontSize * scaleX) + 'px sans-serif';
      outCtx.fillStyle = layer.fontColor;
      outCtx.textBaseline = 'top';
      const padding = 4 * scaleX;
      const lines = wrapText(outCtx, layer.text || '', lw - padding * 2);
      const lineHeight = layer.fontSize * scaleX * 1.3;
      for (let li = 0; li < lines.length; li++) {
        const ly = padding + li * lineHeight;
        if (ly + lineHeight > lh) break;
        outCtx.fillText(lines[li], padding, ly);
      }
    } else if (layer.img) {
      outCtx.drawImage(layer.img, -lw / 2, -lh / 2, lw, lh);
    }

    outCtx.restore();
  }
```

Note: `wrapText` was already added in Task 3 Step 1.

- [ ] **Step 3: Verify merge visually**

Start dev server, create image + text layers, merge. Verify text appears in merged output at correct position, size, color, rotation, and opacity.

- [ ] **Step 4: Commit**

```bash
git add frontend/lib/editor/tools/canva.ts frontend/lib/editor/tools/canva-geometry.ts
git commit -m "feat: support text layers in canva merge and flatten"
```

---

### Task 7: Add CSS for text overlay

**Files:**
- Modify: `frontend/assets/css/editor.css`

- [ ] **Step 1: Add overlay styles**

At the end of `frontend/assets/css/editor.css`, append:

```css
/* Canva text overlay */
#canvaTextOverlay {
  box-sizing: border-box;
  cursor: text;
  border-radius: 3px;
  letter-spacing: 0;
}

#canvaTextOverlay:focus {
  border-style: solid;
  border-color: #58a6ff;
  background: rgba(0, 0, 0, 0.3);
}

#canvaTextOverlay br {
  /* contenteditable inserts <br> on empty lines, nothing special needed */
}

/* Text panel controls */
#canvaFontSize {
  background: var(--bg2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text1);
  padding: 6px 10px;
  font-size: 13px;
}

#canvaFontSize:focus {
  outline: none;
  border-color: var(--accent);
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/assets/css/editor.css
git commit -m "style: add text overlay and font size input styles"
```

---

### Task 8: Final verification

- [ ] **Step 1: Start the dev server and test the full flow**

Run: `cd frontend && npm run dev`

Test checklist:
1. Load an image
2. Switch to Canva tool
3. Click "Add Text" — text box appears in viewport center, focused for typing
4. Type text — appears in overlay
5. Change font size via number input — overlay updates
6. Change color via color picker — overlay updates
7. Click outside — overlay hides, text renders on canvas with correct styling
8. Double-click text layer — overlay reappears for editing
9. Click-drag text layer to move it
10. Use resize handles to resize text box
11. Use rotate handle to rotate text
12. Add a second text layer and an image layer
13. Merge all — verify text layers merge correctly
14. Verify opacity slider works on text layers
15. Verify Delete key removes text layer
16. Verify clicking empty space deselects
17. Verify scroll wheel zoom + drag still pans

- [ ] **Step 2: Commit any final fixes**

```bash
git add -A
git commit -m "fix: final text layer polish"
```
