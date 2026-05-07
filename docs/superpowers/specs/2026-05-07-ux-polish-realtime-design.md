# UX Polish & Real-Time Interactions — Design Spec

**Date:** 2026-05-07
**Status:** Approved

## Overview

Improve Image Studio Pro with real-time live previews for all tools, undo/redo action labels, keyboard shortcut reference, and modular code architecture.

## 1. Instant Live Previews

Principle: Every tool shows canvas previews in real time. No blind "Apply" clicks.

### 1.1 Rotate Tool

- Slider and quick-rotate buttons (90 CW, 90 CCW, 180) render live preview on overlay canvas
- Preview is debounced at ~50ms for smooth performance
- "Apply Rotation" button commits to history and updates S.img
- Switching tools discards uncommitted rotation

### 1.2 Crop Tool

- Click-drag inside existing selection to **move** it
- Drag corners to resize (existing behavior, preserved)
- Add edge-drag for resizing from edges (not just corners)
- Click outside without drag deselects; click-drag outside creates new selection
- Double-click or Enter applies crop; Escape resets selection

### 1.3 Resize Tool

- Add "Live Preview" checkbox (default on)
- When on, canvas shows resized result as dimensions/scaling change
- "Apply Resize" commits to history

### 1.4 Grid Tool

- Already has live handle dragging — unchanged

## 2. Undo/Redo Polish

- Each history entry stores action label string
- Undo/redo toasts: "Undone: Crop" / "Redone: Rotate 90"
- Buttons get disabled style when unavailable (histIdx <= -1 for undo, histIdx >= length-1 for redo)
- History limit: 100 entries

## 3. Keyboard Shortcut Reference

- Press `?` to toggle overlay
- Lists: Ctrl+O Open, Ctrl+S Save, Ctrl+Z Undo, Ctrl+Shift+Z Redo, Delete/Esc Reset tool, Enter Apply tool, ? Toggle this panel
- Click backdrop or press `?` to dismiss

## 4. Architecture — Module Split

### 4.1 New file structure

```
js/
  state.js        — S object, defaults
  canvas.js       — fitImage, renderAll, applyWork, resetWork
  history.js      — pushHistory, undo, redo, restoreFromHistory
  overlay.js      — drawCropOverlay, drawGridOverlay, clearOverlay
  tools/
    crop.js       — panelCrop, crop events, applyCrop
    resize.js     — panelResize
    grid.js       — panelGrid, grid events, downloadGridZip
    bgremove.js   — panelBG, loadAI, runAIBG, refineEdges
    rotate.js     — panelRotate, rotate, flipH, flipV
  ui.js           — toast, setupSaveModal, setupKeys, shortcuts panel
  main.js         — init, $, ctx/octx, switchTool, setupSidebar, setupTopbar
```

### 4.2 Module patterns

- Each tool module exports: `renderPanel(p)`, `setupEvents()`, `cleanup()`
- `history.js` exports: `pushHistory(label)`, `undo()`, `redo()`
- `canvas.js` exports: `fitImage()`, `renderAll()`, `applyWork()`, `resetWork()`
- State (`state.js`) is imported by all modules as a shared singleton
- DOM refs (`$`, `ctx`, `octx`) live in `main.js` and are passed or imported

### 4.3 Constraints

- No bundler/build step — plain ES modules with `.js` extensions work in modern browsers
- Import map already exists in index.html (for onnxruntime and background-removal)
- All module imports are relative: `import { S } from '../state.js'`

## 5. Non-Goals

- No new tools (drawing, filters, adjustments) — out of scope
- No zoom/pan — out of scope for this round
- No dark/light theme toggle — the app is already dark-themed
