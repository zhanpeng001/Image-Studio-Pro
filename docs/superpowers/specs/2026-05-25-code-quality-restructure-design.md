# Design: Code Quality & Structure Overhaul

## Motivation

After rapid feature iteration (color presets, text bold, canva project save/load, canva without image), the codebase has accumulated structural debt. An audit found: `// @ts-nocheck` on 15/17 files disabling type safety, `canva.ts` at 1,480 lines as a monolith, 5 shared patterns copy-pasted 5-8 times each, and layer rendering duplicated across draw and merge paths. This overhaul improves maintainability without changing any user-facing behavior.

## Section 1: Shared Utilities (`utils.ts`)

Create `frontend/lib/editor/utils.ts` with these 5 exports:

| Export | Replaces | Appears in |
|---|---|---|
| `canvasFromImage(img): HTMLCanvasElement` | 8 identical implementations | history, crop, scale, rotate, bgremove, compressor, canva |
| `loadImageFromCanvas(canvas): Promise<HTMLImageElement>` | 6 identical implementations | crop, scale, rotate, bgremove, history |
| `triggerDownload(blob, filename)` | 5 identical implementations | canva, grid, rotate, compressor, ui |
| `COLOR_PRESETS: string[]` | 3 identical arrays | crop, canva (font), canva (icon) |
| `highlightPreset(containerId, color)` | 2 identical functions | crop, canva |

All tool files import from `utils.ts` instead of having local copies.

## Section 2: Type System Cleanup

1. **Remove `// @ts-nocheck`** from all files
2. **Fix `EditorTool`** union to include `'compressor'` (state.ts line 2)
3. **Type `createLayer`/`createTextLayer`/`createIconLayer`** return types as `CanvaLayer` (was `any`)
4. **Add `getById<T>(id): T`** typed helper in `dom.ts` replacing `document.getElementById('x')!` (15+ occurrences)
5. **Add `CompressorState`** interface to state.ts and include in `EditorState`
6. **Add `HandlePositions` and `ScaledHandles`** interfaces replacing `any` in canva.ts handle math
7. **Fix implicit `any`** on event handler parameters

## Section 3: Split `canva.ts` into Modules

| New file | Lines | Content |
|---|---|---|
| `canva-panel.ts` | ~250 | `buildCanvaPanelHTML(c, sel, isText, isIcon)` — pure function returning HTML string |
| `canva-events.ts` | ~250 | `setupCanvaEvents()`, `cleanupCanvaEvents()` — mouse/wheel/pan handlers |
| `canva-draw.ts` | ~200 | `drawCanvaAll()`, `drawSelectionUI()`, `renderLayerToContext(ctx, layer, scaleX, scaleY)` — shared by draw + merge |
| `canva-interact.ts` | ~180 | `hitTest()`, resize/move/rotate math, `computeHandlePositions()`, cursor logic |
| `canva-layers.ts` | ~120 | `createLayer()`, `addTextLayer()`, `addIconLayer()`, `loadOverlayLayer()` |
| `canva-project.ts` | ~100 | `saveCanvaProject()`, `loadCanvaProject()`, `imageToDataURL()` |
| `canva.ts` | ~120 | Re-exports, `renderCanvaPanel()` orchestrator, panel wiring |

Key architectural win: `renderLayerToContext()` in `canva-draw.ts` is called by both `drawCanvaAll()` and `mergeAllLayers()`, eliminating the duplicated text/icon/image rendering logic.

## Section 4: `main.ts` & Remaining Cleanup

**main.ts:**
- Replace `lockedToolPreviews` HTML duplication with a single generic message — no need to maintain fake disabled panels
- Consolidate tool lifecycle into a `ToolLifecycle` map with `onEnter`/`onExit`/`onKey` callbacks, replacing scattered `if (S.tool === 'x')` chains
- Import shared utilities from `utils.ts`

**canvas.ts:**
- Move `renderRotatePreview()` to `rotate.ts`
- Move `renderCropExpand()` and `restoreCropCanvas()` to `crop.ts`
- Canvas.ts becomes focused: `fitImage()`, `renderAll()`, `applyWork()`, `resetWork()`

**overlay.ts:**
- Extract `drawHandles(ctx, handles, zoom)` as a shared helper
- Both `drawCropOverlay` and `drawSelectionUI` use it

**Files NOT changing:** state.ts, dom.ts, ui.ts, history.ts, lanczos.ts, canva-geometry.ts, canva-icons.ts, canva-layout.mjs

## Implementation Order

1. Create `utils.ts` with all 5 shared exports
2. Update all tool files to import from `utils.ts` (no behavior change, verify typecheck)
3. Add `CompressorState`, fix `EditorTool`, add missing interfaces to `state.ts`
4. Add `getById` to `dom.ts` and migrate all `!` assertions
5. Remove `@ts-nocheck` from all files, fix remaining errors
6. Split `canva.ts` into modules
7. Move stray functions from `canvas.ts` to tool files
8. Clean up `main.ts` tool lifecycle and locked previews
9. Extract shared handle drawing in `overlay.ts`
10. Run typecheck, manual smoke test

## Verification

- `vue-tsc --noEmit` passes with zero errors
- All tools render their panels when selected
- Crop: expand, crop, resize, aspect ratios, eyedropper
- Canva: add text/icon/image layers, resize, rotate, reorder, merge, save/load project
- Rotate: presets, custom angle, snapshots, flip
- Grid: split preview, export cells
- Scale: dimension and percentage resize
- Compressor: format/quality sliders, download
- Background Remove: AI removal with refinement
- Undo/redo works across tools
- File open, save, shortcuts all work
