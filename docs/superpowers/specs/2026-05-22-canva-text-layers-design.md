# Canva Text Layers

Add text layers to the Canva workspace: create text boxes, type inline, control font size and color, move and resize, and re-edit after deselecting.

## Data Model

Extend `CanvaLayer` in `lib/editor/state.ts` with optional text fields:

```typescript
export interface CanvaLayer {
  img: HTMLImageElement | null;  // null for text layers
  x: number;
  y: number;
  w: number;
  h: number;
  angle: number;
  opacity: number;
  ratioLocked: boolean;
  ratio: number;
  type: 'image' | 'text';        // new, default 'image'
  text: string;                   // new, default ''
  fontSize: number;               // new, default 24
  fontColor: string;              // new, hex, default '#ffffff'
}
```

A layer is either image (`type: 'image'`) or text (`type: 'text'`). Existing fields `x`, `y`, `w`, `h`, `angle`, `opacity` apply to both. For text, `w`/`h` define the text box dimensions. The existing `createLayer()` stays unchanged; a new `createTextLayer()` factory initializes text defaults.

## Panel Controls

When a text layer is selected, additional controls render inside `#canvaSelControls`:

- **Font Size**: `<input type="number">` with default 24, min 8, max 512
- **Text Color**: `<input type="color">` (native browser color picker) with default `#ffffff`

A new **"Add Text"** button appears next to the existing "Add Layer" button.

## contenteditable Overlay

A `<div contenteditable="true">` positioned absolutely over the canvas area. When a text layer is selected, the overlay appears at the layer's workspace position, applying zoom, rotation, and layer dimensions. The overlay styling mirrors the layer's font size and color. When deselected, the overlay hides.

This gives native text editing: cursor, selection, copy/paste, IME — all handled by the browser.

## Interaction

- **Add Text**: Clicking "Add Text" creates a text layer at viewport center, selects it, shows the overlay ready for typing.
- **Inline editing**: Type directly in the overlay. Font size and color changes from the panel apply live to the overlay and layer state.
- **Deselect on empty click**: Clicking empty workspace deselects the current layer (applies to all layers, not just text). The overlay hides and text is rendered to the overlay canvas.
- **Re-edit**: Click a text layer again — the overlay reappears with existing text intact.
- **Move**: Drag a text layer to reposition, same as image layers.
- **Resize**: Corner/edge handles resize the text box. Font size stays fixed; the box reflows text within the new bounds.
- **Delete**: Delete key removes a selected text layer, same as image layers.

## Rendering

When deselected, text layers are drawn on the overlay canvas via `octx.fillText()` with the same transform pipeline (translate, rotate, globalAlpha) applied to image layers. Text wraps within the box width, clipping to box height.

Merge uses the same branching logic: text layers render via `fillText()` instead of `drawImage()` during the composite pass.

## Scope

- No font family selection (default sans-serif)
- No bold/italic/underline
- No text alignment options (default left-aligned)
- Panning is limited to scroll-wheel zoom; empty-space click-to-pan is removed in favor of deselect
