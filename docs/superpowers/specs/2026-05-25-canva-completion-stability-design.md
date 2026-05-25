# Canva Completion And Stability

## Goal

Complete the in-progress icon layer extension and repair the existing Canva layer behavior so image, text, and icon layers render, transform, edit, and flatten consistently.

## Current State

The committed Canva workspace supports a background image, added image layers, text layers, selection transforms, reordering, and flattening. The working tree contains an incomplete icon layer extension in `frontend/lib/editor/state.ts`, `frontend/lib/editor/tools/canva.ts`, `frontend/lib/editor/tools/canva-icons.ts`, and `frontend/assets/css/editor.css`.

Investigation identified three defects in the text path:

- Canvas text drawing applies the layer center transform, but draws text from positive padding rather than from the layer box origin at `(-w / 2, -h / 2)`. The HTML edit overlay uses the top-left layer box, so editing and rendered text do not line up.
- A selected text layer remains painted to the canvas while its HTML overlay is shown, causing duplicate visible glyphs during editing and selection.
- `wrapText()` tokenizes only on spaces, so explicit newlines are discarded and long words overflow rather than wrapping.
- The HTML overlay is positioned inside the scrolling canvas area, but its coordinates subtract that area's scroll offsets. Scrolling therefore shifts editable text away from the canvas layer a second time.
- Several new icon definitions are filled silhouette paths labeled for stroke rendering, causing their canvas appearance to be an outline artifact instead of the picker glyph's intended solid shape.

The project currently has no frontend unit test runner configured. `npm run typecheck` and `npm run build` succeed but cannot catch these rendering defects because `canva.ts` opts out of TypeScript checks and interaction behavior is canvas-based.

## Scope

### Included

- Preserve and finish icon layers already started in the working tree.
- Repair text preview/edit alignment and duplicate rendering.
- Keep selected text aligned with its canvas layer while the Canva workspace is scrolled or zoomed.
- Preserve explicit newlines and wrap long unbroken text in text layers.
- Keep icon layer selection, opacity, rotation, resize, ordering, deletion, and merge behavior consistent with other layer types.
- Add a focused testable helper boundary for text layout and layer-render decisions, with automated regression tests.
- Validate type checking, production build, and interaction paths available in the environment.

### Excluded

- Fonts, text alignment, rich text, effects, or new icon categories.
- A large architectural rewrite of the editor or Canva tool.
- Persisting a Canva document separately from the flattened image.

## Layer Model

`CanvaLayer` retains the discriminating `type` field:

```typescript
type: 'image' | 'text' | 'icon';
```

Image layers use `img`. Text layers use `text`, `fontSize`, and `fontColor`. Icon layers use `iconName` and `iconColor`. Common transform fields (`x`, `y`, `w`, `h`, `angle`, `opacity`, ratio locking) apply to every type.

The existing uncommitted icon properties are preserved. Layer factories initialize all fields predictably so reordering and rendering do not need optional-property branches.

## Rendering

Canva layers continue to use the common transformation pipeline:

1. Translate the drawing context to the layer center.
2. Rotate around the center.
3. Apply layer opacity.
4. Draw type-specific content within a local rectangle whose top-left is `(-width / 2, -height / 2)`.

Image and icon drawing already follow centered geometry. Text drawing will be corrected to offset each line by the local box origin plus padding, matching the overlay box and selection border.

When a text layer is selected, the HTML overlay is the visible text representation. The canvas pass skips that selected text content while continuing to draw its selection handles. Deselecting hides the overlay and the canvas text becomes visible again.

Icons render from the existing `ICON_DEFS` paths, scaled within the layer rectangle and colored with `iconColor`. The flatten operation uses the same local placement and transformation rules as the workspace preview.

The text overlay is a child of the scrolling canvas area. Its position therefore uses scaled workspace coordinates only; browser scrolling provides the viewport offset. The overlay is not manually shifted by `scrollLeft` or `scrollTop`.

## Text Layout

Text line construction moves into a small pure helper that accepts text and a width-measure function. It must:

- Preserve newline-delimited paragraphs, including empty lines.
- Wrap words at spaces when possible.
- Break an individual word into fitting segments when it is wider than the box.
- Return at least one line for empty content.

Both workspace rendering and flattened rendering consume the same line output so their layout agrees at different render scales.

## Panel And Interaction

The in-progress Add Icon picker remains in the Canva panel. Choosing an icon creates a centered icon layer, selects it, and exposes icon color along with common transform controls. Icon layers participate in the existing layer list, selection, handles, ordering, deletion, and merge action. Definitions whose SVG paths are solid shapes are rendered as fills in both preview and merge, matching the picker rather than outlining their silhouette.

Text selection behavior remains as previously designed: a text layer overlay appears when selected and becomes editable for a newly created empty layer or on double-click. Font-size and color edits update both overlay state and subsequent canvas/flatten rendering.

No panning interaction is introduced in this repair. Existing zoom and scroll behavior remains in scope only where it affects overlay positioning and redraw.

## Error Handling

- An unknown icon name does not attempt to construct a path; the layer remains selectable but draws no icon content.
- Merge continues to report missing canvas context or failed image decoding through the existing toast mechanism.
- New helper logic must handle empty or zero-width text boxes without infinite loops or exceptions.

## Test Strategy

Add a lightweight frontend unit-test command using Node's built-in test runner against pure TypeScript-independent JavaScript helper logic, avoiding browser/canvas mocks.

Regression tests cover:

- Explicit newline preservation.
- Long-word wrapping.
- Overlay geometry based on scaled workspace coordinates rather than duplicated scroll offsets.
- Text layer content suppression while the layer is selected for overlay display.
- Icon layer content remaining renderable while selected.

Verification also runs:

```bash
cd frontend
npm test
npm run typecheck
npm run build
```

Browser-based click-through validation would additionally cover adding text, editing, deselecting, selecting an icon, recoloring it, transforming it, and flattening. The in-app browser automation interface is not available in the current session; any unexecuted interactive validation will be reported explicitly.

## Files

- `frontend/lib/editor/tools/canva.ts`: consume pure helpers; fix local text placement and selected-text rendering; finish icon integration where required.
- `frontend/lib/editor/tools/canva-icons.ts`: retain icon definitions and correct any definition issues exposed during completion.
- `frontend/lib/editor/state.ts`: retain icon layer type and defaults.
- `frontend/assets/css/editor.css`: retain picker and text overlay presentation, with only defect-driven adjustments.
- `frontend/lib/editor/tools/canva-layout.mjs`: pure text layout/render-decision helpers.
- `frontend/test/canva-layout.test.mjs`: focused regression tests.
- `frontend/package.json`: add the unit-test command.
