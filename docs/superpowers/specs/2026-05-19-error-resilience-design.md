# Error Resilience Design

Date: 2026-05-19

## Goal

Harden the editor against crashes so that no user action (bad file, corrupted data, failed AI model download, missing DOM element) can break the app. Every failure path must recover gracefully with a toast and a return to the last good state.

## Scope

- Image loading pipeline (FileReader, new Image, file size)
- Canvas context safety (null checks, SecurityError guard)
- AI operations (model download, background removal)
- DOM element safety (null guards)
- Input validation (clamp dimensions, guard operations without image)
- Undo/redo safety (snapshot errors, restore errors)

Out of scope: TypeScript strict mode, state management refactor, backend changes, visual redesign, new features.

## Changes

### 1. Image loading pipeline — `frontend/lib/editor/main.ts`

**FileReader error handling:**
- Add `r.onerror` handler to show a toast ("Failed to read file") instead of silently doing nothing

**Image onerror handling:**
- Add `img.onerror` to the `loadFile` image constructor to show "Failed to decode image" toast

**File size guard:**
- Before calling `readAsDataURL`, reject files over 100MB with a toast ("File too large. Max 100MB.")

No new functions. Inline handlers only.

### 2. Image onerror — `frontend/lib/editor/history.ts`

**undo() and redo() restore path:**
- `img.onerror` already calls `img.onload` which does recovery, but if `entry.dataURL` is corrupted the image silently never loads. Add `img.onerror` handler with toast ("Failed to restore state") and recovery by keeping the current image.

### 3. Image onerror — `frontend/lib/editor/tools/crop.ts`

**applyCrop():**
- Add `nimg.onerror` handler: toast ("Crop failed") and keep current image

### 4. Image onerror — `frontend/lib/editor/tools/resize.ts`

**applyResize:**
- Add `nimg.onerror` handler: toast ("Resize failed") and keep current image

### 5. Image onerror — `frontend/lib/editor/tools/rotate.ts`

**applyRotation(), flipH(), flipV():**
- Add `nimg.onerror` handler to each: toast with operation name and keep current image

### 6. Image onerror — `frontend/lib/editor/tools/bgremove.ts`

**refineEdges():**
- Add `nimg.onerror` handler: toast ("Refinement failed") and keep current image

The `runAIBG()` path already has onerror — no change needed.

### 7. Canvas context safety — `frontend/lib/editor/dom.ts`

**refreshDomBindings():**
- After `mc.getContext('2d')` and `oc.getContext('2d')`, check for null and throw a readable error: "Canvas 2D context not available" rather than letting a null ctx crash later

### 8. DOM element null safety

**`frontend/lib/editor/history.ts` — `updateUndoRedoButtons()`:**
- Already null-safe (checks existence before classList toggle). No change.

**`frontend/lib/editor/tools/crop.ts` — `renderCropPanel()`:**
- `applyBtn` and `resetBtn` already null-checked. No change needed.

**`frontend/lib/editor/ui.ts` — `saveModal` setup:**
- `$('saveCancel')` etc. already use `$()` which throws on missing element. This is correct — the modal must exist.

**`frontend/lib/editor/tools/rotate.ts`:**
- All `$()` calls reference elements created in `renderRotatePanel()` immediately before. Safe.

### 9. Input validation

**Resize panel — `frontend/lib/editor/tools/resize.ts`:**
- Clamp `S.resize.w` and `S.resize.h` to minimum 1 in update functions (currently `|| 1` already handles falsy, but explicitly clamp)

**Crop panel — `frontend/lib/editor/tools/crop.ts`:**
- Already guards `c.w < 5 || c.h < 5` before applying. No change.

**Save modal — `frontend/lib/editor/ui.ts`:**
- `openSaveDialog()` already guards `!S.img`. No change.

### 10. AI operations recovery — `frontend/lib/editor/tools/bgremove.ts`

**loadAI():**
- The current code sets `aiLoaded = true` before any actual loading happens (the try block is empty). This means clicking "Download AI Model" instantly claims success. Fix: remove the premature flag and handle the actual `removeBackground` preload call properly, or at minimum set `aiLoaded = true` only after a real operation succeeds.

**runAIBG():**
- Already has try/catch with toast. OK.

### 11. Undo/redo bounds — `frontend/lib/editor/history.ts`

**undo():**
- Add guard: if `S.history[S.histIdx]` is undefined (corrupted state), show toast and return. Currently could crash if history is in an inconsistent state.

**redo():**
- Add guard: `S.redoHistory.pop()` returns undefined if array is empty (shouldn't happen given the `length === 0` check, but be defensive). Guard the entry access.

## Files Changed

| File | What |
|------|------|
| `frontend/lib/editor/main.ts` | FileReader onerror, Image onerror in loadFile, file size guard |
| `frontend/lib/editor/history.ts` | Image onerror in undo/redo restore, bounds guards |
| `frontend/lib/editor/tools/crop.ts` | Image onerror in applyCrop |
| `frontend/lib/editor/tools/resize.ts` | Image onerror in applyResize |
| `frontend/lib/editor/tools/rotate.ts` | Image onerror in applyRotation, flipH, flipV |
| `frontend/lib/editor/tools/bgremove.ts` | Image onerror in refineEdges, fix empty loadAI |
| `frontend/lib/editor/dom.ts` | Canvas context null check |
| `frontend/lib/editor/ui.ts` | No changes (already safe) |
| `frontend/lib/editor/overlay.ts` | No changes (no crash paths found) |
| `frontend/lib/editor/canvas.ts` | No changes (guarded by S.img checks) |

## Verification

- `npm run typecheck` — must pass
- `npm run build` — must pass
- Manual smoke test: open corrupted image, oversized file, toggle tools without image loaded
- Existing Go tests unaffected — `go test ./...` must pass
