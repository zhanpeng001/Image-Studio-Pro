# Go Nuxt Project Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert Image Studio Pro from a static browser app into a Go backend plus Nuxt 3 TypeScript frontend while preserving browser-local image editing.

**Architecture:** The backend is a small Go HTTP service with health/version API routes and production static-file serving. The frontend is a Nuxt 3 SPA-style app that owns all Canvas, file, history, export, and image tool behavior. SQLite is not added in this refactor.

**Tech Stack:** Go 1.22+ standard `net/http`, Nuxt 3, Vue 3, TypeScript, Vite, `@imgly/background-removal`, `onnxruntime-web`, `jszip`, npm.

---

## File Structure

Create or modify these files:

- Create `backend/go.mod`: Go module definition.
- Create `backend/cmd/server/main.go`: backend entrypoint.
- Create `backend/internal/config/config.go`: env parsing and defaults.
- Create `backend/internal/httpapi/router.go`: API and static route setup.
- Create `backend/internal/httpapi/router_test.go`: route tests.
- Create `frontend/package.json`: Nuxt scripts and dependencies.
- Create `frontend/nuxt.config.ts`: Nuxt configuration.
- Create `frontend/tsconfig.json`: TypeScript project config.
- Create `frontend/app.vue`: top-level app shell.
- Create `frontend/pages/index.vue`: editor page.
- Create `frontend/assets/css/editor.css`: migrated editor CSS.
- Create `frontend/types/jszip.d.ts`: fallback JSZip browser global type if needed.
- Create `frontend/lib/editor/state.ts`: editor state types and defaults.
- Create `frontend/lib/editor/dom.ts`: typed DOM reference helpers.
- Create `frontend/lib/editor/canvas.ts`: canvas sizing and rendering logic.
- Create `frontend/lib/editor/history.ts`: undo/redo logic.
- Create `frontend/lib/editor/overlay.ts`: overlay drawing logic.
- Create `frontend/lib/editor/ui.ts`: status, modal, keyboard, and toast helpers.
- Create `frontend/lib/editor/tools/crop.ts`: crop tool.
- Create `frontend/lib/editor/tools/resize.ts`: resize tool.
- Create `frontend/lib/editor/tools/grid.ts`: grid split tool.
- Create `frontend/lib/editor/tools/bgremove.ts`: background removal tool.
- Create `frontend/lib/editor/tools/rotate.ts`: rotate and flip tool.
- Create `frontend/composables/useEditor.ts`: browser-only editor initialization.
- Modify `README.md`: update run/build instructions while keeping privacy language.
- Modify `.gitignore`: ignore Go/Nuxt build artifacts and dependencies.

Do not modify the old static app until the Nuxt app builds. Keep `index.html`, `css/`, and `js/` during migration as a reference and fallback.

---

### Task 1: Scaffold Go Backend

**Files:**
- Create: `backend/go.mod`
- Create: `backend/cmd/server/main.go`
- Create: `backend/internal/config/config.go`
- Create: `backend/internal/httpapi/router.go`
- Create: `backend/internal/httpapi/router_test.go`

- [ ] **Step 1: Create the Go module**

Create `backend/go.mod`:

```go
module image-studio-pro/backend

go 1.22
```

- [ ] **Step 2: Write route tests first**

Create `backend/internal/httpapi/router_test.go`:

```go
package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHealthRoute(t *testing.T) {
	handler := NewRouter(Options{Version: "test", StaticDir: ""})
	req := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	var body map[string]string
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body["status"] != "ok" {
		t.Fatalf("expected status ok, got %q", body["status"])
	}
}

func TestVersionRoute(t *testing.T) {
	handler := NewRouter(Options{Version: "1.2.3", StaticDir: ""})
	req := httptest.NewRequest(http.MethodGet, "/api/version", nil)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	var body map[string]string
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body["version"] != "1.2.3" {
		t.Fatalf("expected version 1.2.3, got %q", body["version"])
	}
}
```

- [ ] **Step 3: Run tests to verify they fail**

Run:

```powershell
cd backend
go test ./...
```

Expected: FAIL because `NewRouter` and `Options` are not defined.

- [ ] **Step 4: Implement configuration**

Create `backend/internal/config/config.go`:

```go
package config

import "os"

type Config struct {
	Host      string
	Port      string
	Version   string
	StaticDir string
}

func Load() Config {
	return Config{
		Host:      envOrDefault("APP_HOST", "127.0.0.1"),
		Port:      envOrDefault("APP_PORT", "8080"),
		Version:   envOrDefault("APP_VERSION", "dev"),
		StaticDir: envOrDefault("STATIC_DIR", "../frontend/.output/public"),
	}
}

func envOrDefault(key string, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	return value
}
```

- [ ] **Step 5: Implement API router and static fallback**

Create `backend/internal/httpapi/router.go`:

```go
package httpapi

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
)

type Options struct {
	Version   string
	StaticDir string
}

func NewRouter(opts Options) http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	mux.HandleFunc("GET /api/version", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"version": opts.Version})
	})

	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		serveStaticOrIndex(w, r, opts.StaticDir)
	})

	return mux
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

func serveStaticOrIndex(w http.ResponseWriter, r *http.Request, staticDir string) {
	if staticDir == "" {
		http.NotFound(w, r)
		return
	}

	cleanPath := filepath.Clean(r.URL.Path)
	if cleanPath == "." || cleanPath == string(filepath.Separator) {
		cleanPath = "index.html"
	}
	target := filepath.Join(staticDir, cleanPath)

	if info, err := os.Stat(target); err == nil && !info.IsDir() {
		http.ServeFile(w, r, target)
		return
	}

	indexPath := filepath.Join(staticDir, "index.html")
	if _, err := os.Stat(indexPath); err == nil {
		http.ServeFile(w, r, indexPath)
		return
	}

	http.NotFound(w, r)
}
```

- [ ] **Step 6: Implement backend entrypoint**

Create `backend/cmd/server/main.go`:

```go
package main

import (
	"log"
	"net/http"

	"image-studio-pro/backend/internal/config"
	"image-studio-pro/backend/internal/httpapi"
)

func main() {
	cfg := config.Load()
	addr := cfg.Host + ":" + cfg.Port
	handler := httpapi.NewRouter(httpapi.Options{
		Version:   cfg.Version,
		StaticDir: cfg.StaticDir,
	})

	log.Printf("Image Studio Pro backend listening on http://%s", addr)
	if err := http.ListenAndServe(addr, handler); err != nil {
		log.Fatal(err)
	}
}
```

- [ ] **Step 7: Run backend tests**

Run:

```powershell
cd backend
go test ./...
```

Expected: PASS.

- [ ] **Step 8: Commit backend scaffold**

Run:

```powershell
git add backend
git commit -m "Add Go backend scaffold"
```

---

### Task 2: Scaffold Nuxt Frontend

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/nuxt.config.ts`
- Create: `frontend/tsconfig.json`
- Create: `frontend/app.vue`
- Create: `frontend/pages/index.vue`
- Create: `frontend/assets/css/editor.css`
- Create: `frontend/composables/useEditor.ts`
- Modify: `.gitignore`

- [ ] **Step 1: Create Nuxt package manifest**

Create `frontend/package.json`:

```json
{
  "name": "image-studio-pro-frontend",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "nuxt dev --host 127.0.0.1 --port 3000",
    "build": "nuxt build",
    "generate": "nuxt generate",
    "preview": "nuxt preview --host 127.0.0.1 --port 3000",
    "typecheck": "nuxt typecheck"
  },
  "dependencies": {
    "@imgly/background-removal": "^1.7.0",
    "jszip": "^3.10.1",
    "nuxt": "^3.17.0",
    "onnxruntime-web": "^1.21.0",
    "vue": "^3.5.0"
  },
  "devDependencies": {
    "typescript": "^5.8.0",
    "vue-tsc": "^2.2.0"
  }
}
```

- [ ] **Step 2: Create Nuxt config**

Create `frontend/nuxt.config.ts`:

```ts
export default defineNuxtConfig({
  ssr: false,
  devtools: { enabled: true },
  css: ['~/assets/css/editor.css'],
  app: {
    head: {
      title: 'Image Studio Pro',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Private browser-local image editor' }
      ]
    }
  },
  vite: {
    optimizeDeps: {
      include: ['jszip']
    }
  }
})
```

- [ ] **Step 3: Create TypeScript config**

Create `frontend/tsconfig.json`:

```json
{
  "extends": "./.nuxt/tsconfig.json"
}
```

- [ ] **Step 4: Create app shell**

Create `frontend/app.vue`:

```vue
<template>
  <NuxtPage />
</template>
```

- [ ] **Step 5: Create initial editor page**

Create `frontend/pages/index.vue` with the current HTML shell migrated into Vue template syntax. Keep the existing element IDs because the first migration pass reuses DOM-based editor modules:

```vue
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
        <button class="side-btn" data-tool="resize" title="Resize"><span>Resize</span></button>
        <button class="side-btn" data-tool="grid" title="Grid Split"><span>Grid Split</span></button>
        <button class="side-btn" data-tool="bgremove" title="Background Removal"><span>BG Remove</span></button>
        <button class="side-btn" data-tool="rotate" title="Rotate & Flip"><span>Rotate</span></button>
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
        <div class="col" id="qualityRow">
          <label>Quality: <span class="val" id="qualVal">92%</span></label>
          <input type="range" id="saveQuality" min="10" max="100" value="92">
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
```

- [ ] **Step 6: Migrate CSS**

Copy the content of `css/style.css` to `frontend/assets/css/editor.css`. Keep selectors unchanged so the migrated DOM modules continue to work.

- [ ] **Step 7: Create temporary editor composable**

Create `frontend/composables/useEditor.ts`:

```ts
export function useEditor() {
  onMounted(async () => {
    if (!import.meta.client) {
      return
    }

    const { initEditor } = await import('~/lib/editor/main')
    initEditor()
  })
}
```

This file references `~/lib/editor/main`, which is created in Task 3.

- [ ] **Step 8: Update .gitignore**

Append these lines to `.gitignore`:

```gitignore
node_modules/
.nuxt/
.output/
dist/
backend/*.exe
backend/server
```

- [ ] **Step 9: Install frontend dependencies**

Run:

```powershell
cd frontend
npm install
```

Expected: `package-lock.json` is created.

- [ ] **Step 10: Commit frontend scaffold**

Run:

```powershell
git add .gitignore frontend
git commit -m "Add Nuxt frontend scaffold"
```

---

### Task 3: Migrate Editor Core Modules to TypeScript

**Files:**
- Create: `frontend/lib/editor/main.ts`
- Create: `frontend/lib/editor/state.ts`
- Create: `frontend/lib/editor/dom.ts`
- Create: `frontend/lib/editor/canvas.ts`
- Create: `frontend/lib/editor/history.ts`
- Create: `frontend/lib/editor/overlay.ts`
- Create: `frontend/lib/editor/ui.ts`
- Create: `frontend/lib/editor/tools/*.ts`

- [ ] **Step 1: Copy modules into frontend lib**

Copy these source files into matching TypeScript locations:

```text
js/main.js -> frontend/lib/editor/main.ts
js/state.js -> frontend/lib/editor/state.ts
js/dom.js -> frontend/lib/editor/dom.ts
js/canvas.js -> frontend/lib/editor/canvas.ts
js/history.js -> frontend/lib/editor/history.ts
js/overlay.js -> frontend/lib/editor/overlay.ts
js/ui.js -> frontend/lib/editor/ui.ts
js/tools/bgremove.js -> frontend/lib/editor/tools/bgremove.ts
js/tools/crop.js -> frontend/lib/editor/tools/crop.ts
js/tools/grid.js -> frontend/lib/editor/tools/grid.ts
js/tools/resize.js -> frontend/lib/editor/tools/resize.ts
js/tools/rotate.js -> frontend/lib/editor/tools/rotate.ts
```

- [ ] **Step 2: Convert main module initialization**

In `frontend/lib/editor/main.ts`, replace the bottom `init();` call with:

```ts
export function initEditor() {
  init()
}
```

Leave `init()` private to the module.

- [ ] **Step 3: Replace CDN globals with npm imports**

In `frontend/lib/editor/tools/bgremove.ts`, import package APIs from npm:

```ts
import { removeBackground } from '@imgly/background-removal'
```

In `frontend/lib/editor/tools/grid.ts`, import JSZip:

```ts
import JSZip from 'jszip'
```

Remove assumptions that `window.JSZip` exists.

- [ ] **Step 4: Add minimal DOM type helpers**

In `frontend/lib/editor/dom.ts`, ensure `$` fails clearly if an ID is missing:

```ts
export function $(id: string): HTMLElement {
  const element = document.getElementById(id)
  if (!element) {
    throw new Error(`Missing required element #${id}`)
  }
  return element
}
```

Then export typed constants using assertions:

```ts
export const mc = $('mainCanvas') as HTMLCanvasElement
export const oc = $('overlayCanvas') as HTMLCanvasElement
export const ctx = mc.getContext('2d') as CanvasRenderingContext2D
export const octx = oc.getContext('2d') as CanvasRenderingContext2D
export const panel = $('panel')
export const dropzone = $('dropzone')
export const canvasWrap = $('canvasWrap')
export const canvasArea = $('canvasArea')
export const statusTool = $('statusTool')
export const saveModal = $('saveModal')
```

- [ ] **Step 5: Add permissive first-pass editor types**

In `frontend/lib/editor/state.ts`, define explicit state shape enough for typechecking:

```ts
export type EditorTool = 'crop' | 'resize' | 'grid' | 'bgremove' | 'rotate'

export interface EditorState {
  tool: EditorTool
  img: HTMLImageElement | null
  origImg: HTMLImageElement | null
  fname: string
  history: ImageData[]
  histIdx: number
  zoom: number
  viewW: number
  viewH: number
  origData: ImageData | null
  workData: ImageData | null
  crop: Record<string, any>
  grid: Record<string, any>
  rotate: Record<string, any>
}
```

Keep existing state fields and defaults, then export `S` as `EditorState`.

- [ ] **Step 6: Run typecheck and fix syntax errors**

Run:

```powershell
cd frontend
npm run typecheck
```

Expected on first run: TypeScript may fail on implicit `any` or DOM type mismatches. Fix concrete compiler errors without changing behavior.

- [ ] **Step 7: Build frontend**

Run:

```powershell
cd frontend
npm run build
```

Expected: Nuxt production build succeeds.

- [ ] **Step 8: Commit migrated editor core**

Run:

```powershell
git add frontend
git commit -m "Migrate editor modules to Nuxt TypeScript"
```

---

### Task 4: Connect Backend and Frontend Development

**Files:**
- Modify: `frontend/nuxt.config.ts`
- Modify: `README.md`

- [ ] **Step 1: Add dev API proxy**

In `frontend/nuxt.config.ts`, add Vite server proxy config:

```ts
vite: {
  optimizeDeps: {
    include: ['jszip']
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true
      }
    }
  }
}
```

- [ ] **Step 2: Document local dev commands**

Update `README.md` Getting Started section to include:

```markdown
## Development

Run the frontend:

```bash
cd frontend
npm install
npm run dev
```

Run the backend:

```bash
cd backend
go run ./cmd/server
```

Frontend: http://127.0.0.1:3000
Backend: http://127.0.0.1:8080
Health check: http://127.0.0.1:8080/api/health
```

Keep the privacy statement that image pixels stay in the browser.

- [ ] **Step 3: Verify backend still passes tests**

Run:

```powershell
cd backend
go test ./...
```

Expected: PASS.

- [ ] **Step 4: Verify frontend builds**

Run:

```powershell
cd frontend
npm run build
```

Expected: PASS.

- [ ] **Step 5: Commit dev workflow docs**

Run:

```powershell
git add frontend/nuxt.config.ts README.md
git commit -m "Document Go and Nuxt development workflow"
```

---

### Task 5: Production Static Serving Smoke Test

**Files:**
- Modify only if verification reveals a concrete bug in `backend/internal/httpapi/router.go` or `frontend/nuxt.config.ts`.

- [ ] **Step 1: Build frontend**

Run:

```powershell
cd frontend
npm run build
```

Expected: `frontend/.output/public/index.html` exists.

- [ ] **Step 2: Start backend against built frontend**

Run:

```powershell
cd backend
$env:STATIC_DIR='../frontend/.output/public'
go run ./cmd/server
```

Expected: server logs `Image Studio Pro backend listening on http://127.0.0.1:8080`.

- [ ] **Step 3: Verify API endpoint**

In a second shell, run:

```powershell
Invoke-WebRequest -Uri http://127.0.0.1:8080/api/health -UseBasicParsing | Select-Object -ExpandProperty Content
```

Expected:

```json
{"status":"ok"}
```

- [ ] **Step 4: Verify static app endpoint**

Run:

```powershell
Invoke-WebRequest -Uri http://127.0.0.1:8080/ -UseBasicParsing | Select-Object -ExpandProperty StatusCode
```

Expected:

```text
200
```

- [ ] **Step 5: Commit any smoke-test fixes**

If files changed, run:

```powershell
git add backend frontend
git commit -m "Fix production static serving"
```

If no files changed, do not create an empty commit.

---

### Task 6: Final Verification and Cleanup

**Files:**
- Modify: `README.md` only if commands or ports differ from the documented workflow.

- [ ] **Step 1: Run backend tests**

Run:

```powershell
cd backend
go test ./...
```

Expected: PASS.

- [ ] **Step 2: Run frontend typecheck**

Run:

```powershell
cd frontend
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Run frontend build**

Run:

```powershell
cd frontend
npm run build
```

Expected: PASS.

- [ ] **Step 4: Manual editor smoke test**

Run:

```powershell
cd frontend
npm run dev
```

Open `http://127.0.0.1:3000` and verify:

- The editor shell loads.
- Clicking Open shows a file picker.
- Drag/drop accepts an image.
- Sidebar switches among Crop, Resize, Grid Split, BG Remove, and Rotate.
- Save opens the save modal.

- [ ] **Step 5: Check git status**

Run:

```powershell
git status --short
```

Expected: only intentional source changes are present. No `node_modules`, `.nuxt`, `.output`, or executable build artifacts are staged.

- [ ] **Step 6: Final commit if documentation changed**

If final cleanup changed files, run:

```powershell
git add README.md .gitignore
git commit -m "Finalize project refactor documentation"
```

If no files changed, do not create an empty commit.

---

## Self-Review

- Spec coverage: The plan includes Go API/static hosting, Nuxt 3 TypeScript frontend, browser-local image editing, deferred SQLite, development workflow, and verification.
- Scope check: The plan avoids server-side image processing, authentication, persistence, visual redesign, and new editor features.
- Placeholder scan: No task depends on an undefined future feature. The only conditional step is committing smoke-test fixes if verification exposes a concrete bug.
- Type consistency: Backend route names are consistent across tests and implementation. Frontend paths match the proposed project layout.
