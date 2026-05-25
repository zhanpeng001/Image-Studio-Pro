# Canva Completion And Stability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete Canva icon layers and repair text-layer preview, editing, and flattening consistency with regression coverage.

**Architecture:** Keep the current Canva tool module and its in-progress icon extension, while extracting only deterministic text-layout and content-visibility decisions into a pure ESM helper. Canvas preview and flatten rendering share the text-layout helper; the existing state and interaction model remains intact.

**Tech Stack:** Nuxt 3, TypeScript editor modules, HTML Canvas API, Node built-in test runner

---

## File Map

- Create `frontend/lib/editor/tools/canva-layout.mjs`: pure functions for line wrapping and selected text visibility.
- Create `frontend/test/canva-layout.test.mjs`: regression tests that run without browser or canvas mocking.
- Modify `frontend/package.json`: expose `npm test` through Node's built-in runner.
- Modify `frontend/lib/editor/tools/canva.ts`: import helpers, align text drawing within its centered layer rectangle, suppress selected HTML-backed text content, and use the common text layout during merge.
- Preserve existing edits in `frontend/lib/editor/state.ts`, `frontend/lib/editor/tools/canva-icons.ts`, and `frontend/assets/css/editor.css` unless verification proves a specific correction is required.

### Task 1: Pure Canva Layout Regressions

**Files:**
- Create: `frontend/test/canva-layout.test.mjs`
- Modify: `frontend/package.json`

- [ ] **Step 1: Add the test command and failing tests**

Set the script in `frontend/package.json`:

```json
"test": "node --test test/*.test.mjs"
```

Create tests that import:

```javascript
import { layoutCanvaText, shouldPaintLayerContent } from '../lib/editor/tools/canva-layout.mjs';
```

Cover these expected results:

```javascript
assert.deepEqual(layoutCanvaText('one\ntwo', 10, measure), ['one', 'two']);
assert.deepEqual(layoutCanvaText('abcdefgh', 3, measure), ['abc', 'def', 'gh']);
assert.equal(shouldPaintLayerContent({ type: 'text' }, true), false);
assert.equal(shouldPaintLayerContent({ type: 'icon' }, true), true);
```

- [ ] **Step 2: Run the tests to verify RED**

Run:

```bash
cd frontend
npm test
```

Expected: FAIL because `canva-layout.mjs` does not exist.

### Task 2: Pure Helper Implementation

**Files:**
- Create: `frontend/lib/editor/tools/canva-layout.mjs`
- Test: `frontend/test/canva-layout.test.mjs`

- [ ] **Step 1: Add minimal pure helpers**

Export:

```javascript
export function layoutCanvaText(text, maxWidth, measureText) {
  // Return at least one line, preserve newline paragraphs, and split
  // any over-wide word into fitting segments.
}

export function shouldPaintLayerContent(layer, selected) {
  return !(selected && layer.type === 'text');
}
```

For `maxWidth <= 0`, return text paragraphs without entering a splitting loop.

- [ ] **Step 2: Run the test suite to verify GREEN**

Run:

```bash
cd frontend
npm test
```

Expected: PASS for all four helper regressions.

### Task 3: Canvas Preview And Merge Repair

**Files:**
- Modify: `frontend/lib/editor/tools/canva.ts`
- Test: `frontend/test/canva-layout.test.mjs`

- [ ] **Step 1: Integrate the tested helpers**

Import:

```typescript
import { layoutCanvaText, shouldPaintLayerContent } from './canva-layout.mjs';
```

Remove the local `wrapText()` function. For both workspace and merge rendering, call:

```typescript
const lines = layoutCanvaText(
  layer.text || '',
  width - padding * 2,
  (value) => context.measureText(value).width
);
```

- [ ] **Step 2: Correct local text coordinates and selection painting**

Within `drawCanvaAll()`, calculate whether the layer content should be drawn:

```typescript
const selected = c.selectedIdx >= 0 && c.layers[c.selectedIdx] === layer;
if (!shouldPaintLayerContent(layer, selected)) {
  octx.restore();
  continue;
}
```

Draw text relative to the centered local box:

```typescript
const left = -w / 2 + padding;
const top = -h / 2 + padding;
octx.fillText(lines[li], left, top + li * lineHeight);
```

Use the same `left` and `top` rule with output-scaled dimensions in `mergeAllLayers()`, without skipping selected content during merge.

- [ ] **Step 3: Run tests, type checking, and build**

Run:

```bash
cd frontend
npm test
npm run typecheck
npm run build
```

Expected: all commands exit successfully.

### Task 4: Review And Verification

**Files:**
- Review changed Canva and test files

- [ ] **Step 1: Review the final diff for scoped behavior**

Confirm the changes retain the existing icon layer model/picker/rendering and do not revert unrelated uncommitted README, lockfile, crop, or runtime-log changes.

- [ ] **Step 2: Request focused code review**

Review the delta against the approved design, prioritizing behavior regressions in selected text rendering, merge placement, newline wrapping, long text handling, and icon preservation.

- [ ] **Step 3: Run fresh final verification**

Run:

```bash
cd frontend
npm test
npm run typecheck
npm run build
```

Report interactive browser validation as unexecuted if the browser automation interface remains unavailable.

