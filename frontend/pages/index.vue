<template>
  <div class="app">
    <header class="topbar">
      <div class="topbar-left">
        <img class="brand-mark" src="/logo.svg" alt="Image Studio Pro logo">
        <div class="brand-lockup">
          <span class="brand">Image Studio Pro</span>
          <span class="brand-subtitle">Precision image tools</span>
        </div>
      </div>
      <div class="topbar-center">
        <div class="command-group">
          <button class="tb-btn" id="btnOpen" title="Open Image (Ctrl+O)"><span class="tb-icon">O</span><span>Open</span></button>
          <button class="tb-btn" id="btnSave" title="Save Image (Ctrl+S)"><span class="tb-icon">S</span><span>Save</span></button>
        </div>
        <div class="command-group">
          <button class="tb-btn" id="btnUndo" title="Undo (Ctrl+Z)"><span class="tb-icon">U</span><span>Undo</span></button>
          <button class="tb-btn" id="btnRedo" title="Redo (Ctrl+Shift+Z)"><span class="tb-icon">R</span><span>Redo</span></button>
        </div>
        <div class="command-group">
          <button class="tb-btn" id="btnFit" title="Fit to Screen"><span>Fit</span></button>
          <button class="tb-btn" id="btnActual" title="Actual Size"><span>1:1</span></button>
        </div>
      </div>
      <div class="topbar-right">
        <span class="image-info" id="imageInfo">No image</span>
      </div>
    </header>

    <div class="workspace">
      <nav class="sidebar">
        <button class="side-btn active" data-tool="crop" title="Crop"><span class="tool-mark">CR</span><span>Crop</span></button>
        <button class="side-btn" data-tool="resize" title="Scale"><span class="tool-mark">SC</span><span>Scale</span></button>
        <button class="side-btn" data-tool="grid" title="Grid Split"><span class="tool-mark">GR</span><span>Grid</span></button>
        <button class="side-btn" data-tool="bgremove" title="Background Removal"><span class="tool-mark">BG</span><span>Remove</span></button>
        <button class="side-btn" data-tool="rotate" title="Rotate & Flip"><span class="tool-mark">RT</span><span>Rotate</span></button>
        <button class="side-btn" data-tool="compressor" title="Compress"><span class="tool-mark">CP</span><span>Compress</span></button>
        <button class="side-btn" data-tool="canva" title="Canva"><span class="tool-mark">CV</span><span>Canva</span></button>
      </nav>

      <main class="canvas-area" id="canvasArea">
        <div class="dropzone" id="dropzone">
          <div class="dropzone-content">
            <div class="dropzone-badge">Drop or browse</div>
            <h2>Drop an image here</h2>
            <p>PNG, JPG, WEBP, GIF, and SVG files are supported.</p>
          </div>
        </div>
        <div class="canvas-wrap" id="canvasWrap" style="display:none">
          <canvas id="mainCanvas"></canvas>
          <canvas id="overlayCanvas"></canvas>
        </div>
        <div class="zoom-indicator" id="zoomIndicator">100%</div>
      </main>

      <aside class="panel" id="panel">
        <div class="locked-panel">
          <div class="locked-panel-preview" aria-hidden="true">
            <h3>Crop</h3>
            <div class="col"><label>Aspect Ratio</label><div class="presets"><span class="preset active">Free</span><span class="preset">1:1</span><span class="preset">16:9</span></div></div>
            <button class="btn primary btn-block" disabled>Apply Crop</button>
            <button class="btn btn-block" disabled>Resize Full Image</button>
          </div>
          <div class="locked-panel-overlay">
            <div class="locked-panel-card">
              <span class="locked-panel-kicker">Image required</span>
              <strong>Load an image to enable tools</strong>
              <p>The controls are ready. Open a file to start editing.</p>
            </div>
          </div>
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

useHead({
  link: [
    { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' }
  ]
})

useEditor()
</script>
