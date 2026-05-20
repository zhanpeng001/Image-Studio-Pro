<template>
  <div class="app">
    <header class="topbar">
      <div class="topbar-left">
        <span class="brand">Image Studio Pro</span>
      </div>
      <div class="topbar-center">
        <button class="tb-btn" id="btnOpen" title="Open Image (Ctrl+O)"><span>Open</span></button>
        <button class="tb-btn" id="btnUndo" title="Undo (Ctrl+Z)"><span>Undo</span></button>
        <button class="tb-btn" id="btnRedo" title="Redo (Ctrl+Shift+Z)"><span>Redo</span></button>
        <button class="tb-btn" id="btnSave" title="Save Image (Ctrl+S)"><span>Save</span></button>
        <div class="tb-divider"></div>
        <button class="tb-btn" id="btnFit" title="Fit to Screen"><span>Fit</span></button>
        <button class="tb-btn" id="btnActual" title="Actual Size"><span>1:1</span></button>
      </div>
      <div class="topbar-right">
        <span class="image-info" id="imageInfo">No image</span>
      </div>
    </header>

    <div class="workspace">
      <nav class="sidebar">
        <button class="side-btn active" data-tool="crop" title="Crop"><span>Crop</span></button>
        <button class="side-btn" data-tool="resize" title="Scale"><span>Scale</span></button>
        <button class="side-btn" data-tool="grid" title="Grid Split"><span>Grid Split</span></button>
        <button class="side-btn" data-tool="bgremove" title="Background Removal"><span>BG Remove</span></button>
        <button class="side-btn" data-tool="rotate" title="Rotate & Flip"><span>Rotate</span></button>
        <button class="side-btn" data-tool="compressor" title="Compress"><span>Compress</span></button>
      </nav>

      <main class="canvas-area" id="canvasArea">
        <div class="dropzone" id="dropzone">
          <div class="dropzone-content">
            <h2>Drop an image here</h2>
            <p>or click to browse - PNG, JPG, WEBP, GIF, SVG</p>
          </div>
        </div>
        <div class="canvas-wrap" id="canvasWrap" style="display:none">
          <canvas id="mainCanvas"></canvas>
          <canvas id="overlayCanvas"></canvas>
        </div>
        <div class="zoom-indicator" id="zoomIndicator">100%</div>
      </main>

      <aside class="panel" id="panel">
        <div class="panel-empty">
          <p>Load an image to start editing</p>
        </div>
      </aside>
    </div>

    <footer class="statusbar">
      <span id="statusDim">-</span>
      <span class="status-sep">|</span>
      <span id="statusTool">Ready</span>
      <span class="status-sep">|</span>
      <span id="statusZoom">Fit</span>
    </footer>

    <div class="modal-overlay" id="saveModal" style="display:none">
      <div class="modal">
        <h3>Save Image</h3>
        <div class="col">
          <label>Filename</label>
          <input type="text" id="saveFilename" class="modal-input">
        </div>
        <div class="col">
          <label>Format</label>
          <select id="saveFormat">
            <option value="png">PNG - lossless, supports transparency</option>
            <option value="jpeg">JPEG - smaller file, no transparency</option>
            <option value="webp">WebP - modern, small and transparent</option>
          </select>
        </div>
        <div class="modal-actions">
          <button class="btn" id="saveCancel">Cancel</button>
          <button class="btn primary" id="saveConfirm">Save</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useEditor } from '~/composables/useEditor'

useEditor()
</script>
