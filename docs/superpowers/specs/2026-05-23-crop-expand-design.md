# Crop Expand Feature

## Summary

Allow the crop tool to extend beyond the image boundaries by expanding the canvas with a fill color. When an image doesn't fit a desired aspect ratio, users can add uniform padding so no image detail is lost. A color picker with an eyedropper lets users sample a fill color from the original image to match off-white or off-grey backgrounds.

## UI

A new "Expand Canvas" row in the crop panel, placed between the aspect ratio section and the resize section:

- **[-] button** — decrease expand by 10px (minimum 0)
- **[N px] label** — current expand value in view-space pixels
- **[+] button** — increase expand by 10px
- **Eyedropper button** — activates sampling mode (crosshair cursor, click image to sample)
- **Color swatch** — shows current fill color, clickable as a fallback `<input type="color">`
- **Reset** — sets expand to 0 and fillColor to `#FFFFFF`

## State

Add to `CropState`:

- `expand: number` — uniform padding in view-space pixels, default 0
- `fillColor: string` — hex color for padded area, default `#FFFFFF`

## Rendering

When the crop tool is active and `expand > 0`:

1. Both main canvas and overlay canvas resize to `(viewW + 2*expand) × (viewH + 2*expand)`
2. Main canvas fills entirely with `fillColor`, then draws the original image at position `(expand, expand)`
3. Overlay canvas covers the full expanded area — the crop box is no longer constrained to the image region; it can extend into the padding
4. The crop overlay dim renders over everything, clear-rect for the crop box as usual

When `expand === 0`, rendering behaves exactly as it does today — no canvas resize.

## Eyedropper

- Clicking the eyedropper button enters sampling mode
- Cursor changes to crosshair over the overlay canvas
- On mousedown, sample the pixel from the main canvas at cursor position, set `fillColor`, exit sampling mode
- Only the image area is sampled (within the expand offset), not the padding region
- Clicking the eyedropper button again or pressing Escape cancels sampling mode

## Apply Crop

`applyCrop()` modified to:

1. Convert crop box coordinates from view-space to image-space using `S.img.width / viewW` scale
2. Create result canvas at the crop dimensions (in image pixels)
3. Fill entire result canvas with `fillColor`
4. Calculate the image portion that overlaps the crop box and draw it at the correct offset
5. Result: padded crop with seamless fill color matching the original image background

## Files Touched

- `frontend/lib/editor/state.ts` — add `expand` and `fillColor` to `CropState`
- `frontend/lib/editor/tools/crop.ts` — UI controls, eyedropper logic, modified `applyCrop()`
- `frontend/lib/editor/overlay.ts` — adapt `drawCropOverlay()` for expanded canvas area
- `frontend/lib/editor/main.ts` — handle canvas sizing and rendering when expand > 0
- `frontend/assets/css/editor.css` — styles for the new expand row and eyedropper button
