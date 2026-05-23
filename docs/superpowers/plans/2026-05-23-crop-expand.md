# Crop Expand Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add expand/padding to the crop tool so the crop area can extend beyond the image with a fill color sampled via eyedropper.

**Architecture:** Two new fields on `CropState` (`expand`, `fillColor`), UI controls in the crop panel, canvas expansion logic that resizes both main and overlay canvases when expand > 0, and a modified `applyCrop()` that composites the image onto a fill-colored background.

**Tech Stack:** HTML Canvas API, vanilla TypeScript (existing patterns)

---

### Task 1: Add expand and fillColor to CropState

**Files:**
- Modify: `frontend/lib/editor/state.ts`

- [ ] **Step 1: Add fields to CropState interface**

Add `expand` and `fillColor` to the `CropState` interface in `frontend/lib/editor/state.ts`:

```typescript
export interface CropState {
  x: number;
  y: number;
  w: number;
  h: number;
  dragging: boolean;
  dragCorner: string | null;
  aspect: string | null;
  moving: boolean;
  moveStartX: number;
  moveStartY: number;
  moveOrigX: number;
  moveOrigY: number;
  expand: number;
  fillColor: string;
  eyedropping: boolean;
}
```

- [ ] **Step 2: Add default values to S initializer**

```typescript
crop: { x:0, y:0, w:0, h:0, dragging:false, dragCorner:null, aspect:null, moving:false, moveStartX:0, moveStartY:0, moveOrigX:0, moveOrigY:0, expand:0, fillColor:'#FFFFFF', eyedropping:false },
```

- [ ] **Step 3: Verify the file compiles**

Run: `cd frontend && npx vue-tsc --noEmit 2>&1 | head -20`
Expected: No new errors related to state.ts

- [ ] **Step 4: Commit**

```bash
git add frontend/lib/editor/state.ts
git commit -m "feat: add expand and fillColor to CropState"
```

---

### Task 2: Add expand rendering support in canvas module

**Files:**
- Modify: `frontend/lib/editor/canvas.ts`

- [ ] **Step 1: Add `renderCropExpand` function**

Add a new function to `frontend/lib/editor/canvas.ts` that renders the expanded crop canvas:

```typescript
export function renderCropExpand() {
  if (!S.img || S.crop.expand <= 0) return;
  const pad = S.crop.expand;
  const cw = S.viewW + 2 * pad;
  const ch = S.viewH + 2 * pad;

  mc.width = cw; mc.height = ch;
  oc.width = cw; oc.height = ch;
  mc.style.width = cw + 'px'; mc.style.height = ch + 'px';
  oc.style.width = cw + 'px'; oc.style.height = ch + 'px';

  ctx.fillStyle = S.crop.fillColor;
  ctx.fillRect(0, 0, cw, ch);
  ctx.drawImage(S.img, pad, pad, S.viewW, S.viewH);
  S.origData = ctx.getImageData(0, 0, cw, ch);
  S.workData = new ImageData(new Uint8ClampedArray(S.origData.data), cw, ch);
}
```

- [ ] **Step 2: Add `restoreCropCanvas` function**

Add a function to restore normal canvas size when expand is zero or leaving crop:

```typescript
export function restoreCropCanvas() {
  if (!S.img) return;
  mc.width = S.viewW; mc.height = S.viewH;
  oc.width = S.viewW; oc.height = S.viewH;
  mc.style.width = S.viewW + 'px'; mc.style.height = S.viewH + 'px';
  oc.style.width = S.viewW + 'px'; oc.style.height = S.viewH + 'px';
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/lib/editor/canvas.ts
git commit -m "feat: add expand canvas render and restore functions"
```

---

### Task 3: Integrate expand rendering into main.ts

**Files:**
- Modify: `frontend/lib/editor/main.ts`

- [ ] **Step 1: Import new canvas functions**

In `frontend/lib/editor/main.ts`, update the canvas import:

```typescript
import { fitImage, renderAll, renderRotatePreview, renderCropExpand, restoreCropCanvas } from './canvas.js';
```

- [ ] **Step 2: Render expanded canvas when crop tool activates with expand > 0**

In `switchTool()`, change the crop rendering block. Find the section:

```typescript
  if (S.img && changingTool) {
    if (tool === 'canva') {
```

Before this `if` block, insert a check for crop expand:

```typescript
  if (changingTool && S.tool === 'crop' && S.crop.expand > 0) {
    restoreCropCanvas();
  }
```

Then in the existing `if (S.img && changingTool)` block, after the canva section, modify the else branch. Find:

```typescript
    } else {
      renderAll();
    }
```

Replace with:

```typescript
    } else if (tool === 'crop' && S.crop.expand > 0) {
      renderCropExpand();
    } else {
      renderAll();
    }
```

- [ ] **Step 3: Handle expand in window resize handler**

In `handleResize()`, replace the existing crop/overlay rendering:

```typescript
    if (S.tool === 'crop') drawCropOverlay();
```

With:

```typescript
    if (S.tool === 'crop') {
      if (S.crop.expand > 0) {
        renderCropExpand();
      }
      drawCropOverlay();
    }
```

- [ ] **Step 4: Reset expand when loading new image**

In `loadFile()`, add `expand:0, fillColor:'#FFFFFF'` to the crop reset. Find:

```typescript
  S.crop = { x:0, y:0, w:0, h:0, dragging:false, dragCorner:null, aspect:null, moving:false, moveStartX:0, moveStartY:0, moveOrigX:0, moveOrigY:0 };
```

Replace with:

```typescript
  S.crop = { x:0, y:0, w:0, h:0, dragging:false, dragCorner:null, aspect:null, moving:false, moveStartX:0, moveStartY:0, moveOrigX:0, moveOrigY:0, expand:0, fillColor:'#FFFFFF', eyedropping:false };
```

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/editor/main.ts
git commit -m "feat: integrate expand canvas rendering into tool switching"
```

---

### Task 4: Add CSS styles for expand controls

**Files:**
- Modify: `frontend/assets/css/editor.css`

- [ ] **Step 1: Add expand row and eyedropper styles**

Add to the end of `frontend/assets/css/editor.css`:

```css
/* Crop expand controls */
.expand-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.expand-row .expand-val {
  font-size: 12px;
  color: var(--text);
  font-weight: 500;
  min-width: 48px;
  text-align: center;
}

.expand-btn {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text);
  cursor: pointer;
  font-size: 16px;
  font-weight: 600;
  transition: all var(--transition);
  font-family: inherit;
  line-height: 1;
}

.expand-btn:hover {
  border-color: var(--border-strong);
  background: var(--surface3);
}

.eyedropper-btn {
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text2);
  cursor: pointer;
  font-size: 14px;
  transition: all var(--transition);
}

.eyedropper-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.eyedropper-btn.active {
  background: var(--accent-soft);
  border-color: var(--accent);
  color: var(--text);
}

.color-swatch {
  width: 32px;
  height: 32px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  cursor: pointer;
  transition: border-color var(--transition);
}

.color-swatch:hover {
  border-color: var(--border-strong);
}

.expand-reset {
  font-size: 11px;
  color: var(--text2);
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 3px;
  margin-left: auto;
}

.expand-reset:hover {
  color: var(--text);
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/assets/css/editor.css
git commit -m "style: add crop expand controls CSS"
```

---

### Task 5: Add expand UI and eyedropper to crop panel

**Files:**
- Modify: `frontend/lib/editor/tools/crop.ts`

- [ ] **Step 1: Import new canvas functions**

Add import at the top of `frontend/lib/editor/tools/crop.ts`:

```typescript
import { fitImage, renderAll, renderCropExpand, restoreCropCanvas } from '../canvas.js';
```

- [ ] **Step 2: Add expand UI section to renderCropPanel**

In `renderCropPanel()`, find the line with the custom ratio row `<div class="row" id="customRatioRow" ...>` and insert the expand section right after that div (before the resize section). Add:

```typescript
  p.innerHTML = `
    <h3>Crop Image</h3>
    <div class="col"><label>Aspect Ratio</label>
      ...
    </div>
    <div class="divider"></div>
    <div class="col">
      <label>Expand Canvas</label>
      <div class="expand-row">
        <button class="expand-btn" id="expandMinus">-</button>
        <span class="expand-val" id="expandVal">${S.crop.expand} px</span>
        <button class="expand-btn" id="expandPlus">+</button>
        <button class="eyedropper-btn" id="eyedropperBtn" title="Pick color from image">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 22l1-1h3l9-9"/><path d="M19 3l2 2L10 16H8v-2L19 3z"/></svg>
        </button>
        <input type="color" id="fillColorPicker" value="${S.crop.fillColor}" style="display:none;">
        <div class="color-swatch" id="colorSwatch" style="background:${S.crop.fillColor};" title="Current fill color"></div>
        <span class="expand-reset" id="expandReset">reset</span>
      </div>
    </div>
    <div class="divider"></div>
    <div class="col">
      <label>Resize Output</label>
      ...
    </div>
    ...
  `;
```

Note: the actual insertion point is after the customRatioRow div closes and before the Resize Output section. The pattern for the full HTML string is: preserve all existing content, insert the Expand Canvas section between the aspect ratio block and the resize output block.

- [ ] **Step 3: Wire up expand +/- buttons**

Add event listeners after the existing crop panel setup code (after the `drawCropOverlay()` call at the end of `renderCropPanel`):

```typescript
  // Expand controls
  const expandMinus = $('expandMinus');
  const expandPlus = $('expandPlus');
  const expandVal = $('expandVal');
  const eyedropperBtn = $('eyedropperBtn');
  const fillColorPicker = $('fillColorPicker');
  const colorSwatch = $('colorSwatch');
  const expandReset = $('expandReset');

  const updateExpand = (delta: number) => {
    S.crop.expand = Math.max(0, S.crop.expand + delta);
    expandVal.textContent = S.crop.expand + ' px';
    if (S.crop.expand > 0) {
      renderCropExpand();
    } else {
      restoreCropCanvas();
      renderAll();
    }
    drawCropOverlay();
  };

  expandMinus.onclick = () => updateExpand(-10);
  expandPlus.onclick = () => updateExpand(10);
```

- [ ] **Step 4: Wire up color picker and swatch**

```typescript
  const applyFillColor = (color: string) => {
    S.crop.fillColor = color;
    fillColorPicker.value = color;
    colorSwatch.style.background = color;
    if (S.crop.expand > 0) {
      renderCropExpand();
      drawCropOverlay();
    }
  };

  colorSwatch.onclick = () => fillColorPicker.click();
  fillColorPicker.oninput = () => applyFillColor(fillColorPicker.value);
```

- [ ] **Step 5: Wire up eyedropper**

```typescript
  const activateEyedropper = () => {
    S.crop.eyedropping = true;
    eyedropperBtn.classList.add('active');
    oc.style.cursor = 'crosshair';
  };

  const deactivateEyedropper = () => {
    S.crop.eyedropping = false;
    eyedropperBtn.classList.remove('active');
    oc.style.cursor = S.crop.w > 0 ? 'default' : 'crosshair';
  };

  eyedropperBtn.onclick = () => {
    if (S.crop.eyedropping) {
      deactivateEyedropper();
    } else {
      activateEyedropper();
    }
  };

  // Intercept overlay mousedown for eyedropper before crop events
  const origCropDown = oc.onmousedown;
  oc.onmousedown = (e: MouseEvent) => {
    if (S.crop.eyedropping) {
      const rect = oc.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const pad = S.crop.expand;
      // Only sample within image area
      if (mx >= pad && mx <= pad + S.viewW && my >= pad && my <= pad + S.viewH) {
        const pixel = ctx.getImageData(Math.round(mx), Math.round(my), 1, 1).data;
        const hex = '#' + [pixel[0], pixel[1], pixel[2]].map(c => c.toString(16).padStart(2, '0')).join('');
        applyFillColor(hex);
      }
      deactivateEyedropper();
      return;
    }
    if (origCropDown) origCropDown(e);
  };
```

- [ ] **Step 6: Wire up reset**

```typescript
  expandReset.onclick = () => {
    S.crop.expand = 0;
    S.crop.fillColor = '#FFFFFF';
    expandVal.textContent = '0 px';
    fillColorPicker.value = '#FFFFFF';
    colorSwatch.style.background = '#FFFFFF';
    restoreCropCanvas();
    renderAll();
    drawCropOverlay();
  };
```

- [ ] **Step 7: Verify eyedropper uses S.crop.eyedropping**

The eyedropper state is tracked on `S.crop.eyedropping` (added in Task 1). The activate/deactivate helpers in Step 5 toggle this flag. No additional exports needed — the Escape handler in main.ts (Task 6) reads `S.crop.eyedropping` directly.

- [ ] **Step 8: Commit**

```bash
git add frontend/lib/editor/tools/crop.ts frontend/lib/editor/state.ts
git commit -m "feat: add expand UI controls and eyedropper to crop panel"
```

---

### Task 6: Handle eyedropper cancel via Escape in main.ts

**Files:**
- Modify: `frontend/lib/editor/main.ts`

- [ ] **Step 1: Cancel eyedropper on Escape**

In `handleToolKeys()`, in the Escape handler section, add eyedropper cancellation before other Escape handling:

Find:

```typescript
  if ((e.key === 'Escape' || e.key === 'Delete') && document.activeElement === document.body) {
    e.preventDefault();
    if (S.tool === 'crop') {
      S.crop = { x:0, y:0, w:0, h:0, dragging:false, dragCorner:null, aspect:S.crop.aspect, moving:false, moveStartX:0, moveStartY:0, moveOrigX:0, moveOrigY:0 };
      drawCropOverlay();
    }
```

Replace with:

```typescript
  if ((e.key === 'Escape' || e.key === 'Delete') && document.activeElement === document.body) {
    e.preventDefault();
    if (S.tool === 'crop') {
      if (S.crop.eyedropping) {
        S.crop.eyedropping = false;
        const eyedropperBtn = document.getElementById('eyedropperBtn');
        if (eyedropperBtn) eyedropperBtn.classList.remove('active');
        if (S.crop.w > 0) oc.style.cursor = 'default';
        else oc.style.cursor = 'crosshair';
        return;
      }
      S.crop = { x:0, y:0, w:0, h:0, dragging:false, dragCorner:null, aspect:S.crop.aspect, moving:false, moveStartX:0, moveStartY:0, moveOrigX:0, moveOrigY:0, expand: S.crop.expand, fillColor: S.crop.fillColor, eyedropping: false };
      drawCropOverlay();
    }
```

- [ ] **Step 2: Also reset expand on full crop reset (Esc)**

The crop reset on Escape should preserve expand and fillColor since the user set those intentionally. Only reset the crop selection area. This is handled above.

- [ ] **Step 3: Commit**

```bash
git add frontend/lib/editor/main.ts
git commit -m "feat: cancel eyedropper on Escape key"
```

---

### Task 7: Modify applyCrop to handle expand

**Files:**
- Modify: `frontend/lib/editor/tools/crop.ts`

- [ ] **Step 1: Rewrite applyCrop function**

Replace the `applyCrop` function with version that handles expand:

```typescript
function applyCrop() {
  const c = S.crop;
  if (c.w < 5 || c.h < 5) { toast('Select an area first'); return; }
  pushHistory('Crop');

  const scale = S.img.width / S.viewW;
  const sx = Math.round((c.x - c.expand) * scale);
  const sy = Math.round((c.y - c.expand) * scale);
  const sw = Math.round(c.w * scale);
  const sh = Math.round(c.h * scale);

  const tmp = document.createElement('canvas');
  tmp.width = sw; tmp.height = sh;
  const tctx = tmp.getContext('2d')!;

  // Fill with expand color
  tctx.fillStyle = c.fillColor;
  tctx.fillRect(0, 0, sw, sh);

  // Draw the portion of the image that overlaps the crop box
  const imgDrawX = Math.max(0, -sx);
  const imgDrawY = Math.max(0, -sy);
  const imgSrcX = Math.max(0, sx);
  const imgSrcY = Math.max(0, sy);
  const imgSrcW = Math.min(S.img.width - imgSrcX, sw - imgDrawX);
  const imgSrcH = Math.min(S.img.height - imgSrcY, sh - imgDrawY);

  if (imgSrcW > 0 && imgSrcH > 0) {
    tctx.drawImage(S.img, imgSrcX, imgSrcY, imgSrcW, imgSrcH, imgDrawX, imgDrawY, imgSrcW, imgSrcH);
  }

  const nimg = new Image();
  nimg.onload = () => {
    S.img = nimg;
    if (S.crop.expand > 0) {
      restoreCropCanvas();
    }
    fitImage(); renderAll();
    S.crop = { x:0, y:0, w:0, h:0, dragging:false, dragCorner:null, aspect:S.crop.aspect, moving:false, moveStartX:0, moveStartY:0, moveOrigX:0, moveOrigY:0, expand:0, fillColor:'#FFFFFF', eyedropping:false };
    toast('Cropped to ' + sw + 'x' + sh);
  };
  nimg.src = tmp.toDataURL('image/png');
}
```

Note: The key change is `sx` and `sy` subtract `c.expand` from the crop coordinates before scaling to image space. This accounts for the offset of the image within the expanded canvas. The `imgSrcX`, `imgSrcY` etc. calculate the overlapping region between the crop area and the original image.

- [ ] **Step 2: Commit**

```bash
git add frontend/lib/editor/tools/crop.ts
git commit -m "feat: composite crop result onto fill color when expand > 0"
```

---

### Task 8: Reset expand when switching away from crop tool

**Files:**
- Modify: `frontend/lib/editor/main.ts`

- [ ] **Step 1: Restore canvas when leaving crop tool**

In `switchTool()`, find the crop cleanup section:

```typescript
  if (S.tool === 'crop') {
    S.crop.dragging = false;
    S.crop.moving = false;
    cleanupCropEvents();
  }
```

Add canvas restoration:

```typescript
  if (S.tool === 'crop') {
    S.crop.dragging = false;
    S.crop.moving = false;
    S.crop.eyedropping = false;
    cleanupCropEvents();
    if (S.crop.expand > 0) {
      restoreCropCanvas();
    }
  }
```

- [ ] **Step 2: Commit**

```bash
git add frontend/lib/editor/main.ts
git commit -m "fix: restore canvas size when leaving crop tool with expand"
```

---

### Task 9: Fix escape reset to preserve expand and fillColor

**Files:**
- Modify: `frontend/lib/editor/main.ts`

- [ ] **Step 1: Update the crop Escape handler**

Find the Escape handler for crop in `handleToolKeys()` and update the crop reset object to preserve expand, fillColor, and eyedropping:

This was partially done in Task 6. Verify the object is:

```typescript
S.crop = { x:0, y:0, w:0, h:0, dragging:false, dragCorner:null, aspect:S.crop.aspect, moving:false, moveStartX:0, moveStartY:0, moveOrigX:0, moveOrigY:0, expand: S.crop.expand, fillColor: S.crop.fillColor, eyedropping: false };
```

- [ ] **Step 2: Also update the reset button in crop.ts to preserve aspect ratio**

In `renderCropPanel()`, the reset button handler resets crop entirely. Update it to preserve expand and fillColor (the user chose those explicitly). The reset button should only reset the crop selection, not the expand settings. Check the existing reset handler and if needed, update it to:

```typescript
  if (resetBtn) resetBtn.onclick = () => {
    S.crop = { x:0, y:0, w:0, h:0, dragging:false, dragCorner:null, aspect:S.crop.aspect, moving:false, moveStartX:0, moveStartY:0, moveOrigX:0, moveOrigY:0, expand: S.crop.expand, fillColor: S.crop.fillColor, eyedropping: false };
    resW.value = S.img.width;
    resH.value = S.img.height;
    S.resize.w = S.img.width;
    S.resize.h = S.img.height;
    drawCropOverlay();
  };
```

- [ ] **Step 3: Commit**

```bash
git add frontend/lib/editor/main.ts frontend/lib/editor/tools/crop.ts
git commit -m "fix: preserve expand and fillColor on crop reset"
```

---

### Task 10: End-to-end verification

**Files:**
- None (verification only)

- [ ] **Step 1: Build frontend**

Run: `cd frontend && npm run generate`
Expected: Build succeeds with no errors.

- [ ] **Step 2: Start server and test**

Run: `cd backend && go run ./cmd/server`

Open http://127.0.0.1:8080 and test:
1. Open an image
2. Select a fixed aspect ratio (e.g., 16:9)
3. Click [+] to expand canvas — verify padding appears around image in fill color
4. Click [-] to decrease — verify padding shrinks
5. Click eyedropper button, click on image to sample a color — verify swatch updates and padding changes
6. Click color swatch, pick a color — verify it updates
7. Drag crop box into padding area — verify it works
8. Apply crop — verify result has correct fill color and dimensions
9. Switch tools and back — verify expand resets to 0
10. Click "reset" in expand section — verify returns to 0px and white

- [ ] **Step 3: Test edge cases**

- Eyedropper click on padding area should be ignored (only samples image area)
- Escape cancels eyedropper mode
- Loading a new image resets expand to 0
- Crop box stays within expanded canvas bounds (not outside padding area)

- [ ] **Step 4: Commit any fixes if needed**

```bash
git add -A
git commit -m "chore: final fixes from e2e verification"
```
