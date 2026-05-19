# Go and Nuxt Project Refactor Design

Date: 2026-05-19

## Goal

Refactor Image Studio Pro from a static vanilla JavaScript app into a maintainable full-stack project with:

- A Go backend that can serve API endpoints and production frontend assets.
- A Nuxt 3 frontend written in TypeScript and built with Vite.
- The existing privacy-first image editing behavior preserved: image pixels stay in the browser.
- SQLite deferred until the app has a real persistence requirement.

The first implementation target is project structure and feature parity, not a visual redesign or server-side image processing.

## Current Context

The app is currently a static browser-only editor:

- `index.html` defines the editor shell and imports modules with an import map.
- `css/style.css` contains the full UI styling.
- `js/` contains ES modules for canvas rendering, history, UI, state, overlay drawing, and tools.
- Tool modules cover crop, resize, grid split, background removal, and rotate/flip.
- `README.md` explicitly promises that images never leave the user's browser.

That privacy promise is a core product constraint and should remain true after the refactor.

## Recommended Architecture

Use a split project layout:

```text
backend/
  cmd/server/
  internal/
    config/
    httpapi/
    web/
frontend/
  app/
  components/
  composables/
  lib/editor/
  pages/
  public/
  assets/
```

The Go backend owns HTTP serving, operational endpoints, and future server-side capabilities. It should expose a small API surface initially:

- `GET /api/health` returns service health.
- `GET /api/version` returns app and build version metadata.
- Production static serving returns Nuxt build assets and falls back to the app entry for client routing.

The Nuxt frontend owns all editor behavior:

- File loading through browser APIs.
- Canvas rendering and overlays.
- Crop, resize, grid split, rotate/flip, and background removal.
- Undo/redo history.
- Export to PNG, JPEG, and WebP.

No image data should be uploaded to the backend during normal editing.

## Frontend Design

The current vanilla modules should be migrated into TypeScript with similar boundaries:

- `lib/editor/state.ts`: editor state types and defaults.
- `lib/editor/canvas.ts`: canvas sizing, rendering, and image drawing.
- `lib/editor/history.ts`: undo/redo stack.
- `lib/editor/overlay.ts`: crop and grid overlay drawing.
- `lib/editor/tools/*`: crop, resize, grid, background removal, and rotate logic.
- `composables/useEditor.ts`: Nuxt-facing editor orchestration.
- `components/editor/*`: toolbar, sidebar, canvas stage, tool panel, status bar, and save modal.

The first pass should preserve the existing UI layout. The refactor can improve component boundaries, but it should not introduce a new product design unless requested separately.

External browser dependencies should move from CDN import maps into package dependencies where practical:

- `@imgly/background-removal`
- `onnxruntime-web`
- `jszip`

Nuxt should run in SPA-style mode for the editor surface to avoid SSR issues with Canvas, FileReader, and browser-only AI runtime APIs. Browser-only code must be gated behind client lifecycle hooks.

## Backend Design

The Go service should be intentionally small:

- Standard `net/http` is sufficient for the initial routes.
- Configuration should come from environment variables with sensible defaults.
- Local development should allow the Nuxt dev server to proxy or call `/api/*`.
- Production should serve the built Nuxt output from a configured directory.

Suggested defaults:

- Host: `127.0.0.1`
- Port: `8080`
- Static directory: `../frontend/.output/public` or equivalent production output path

The backend should not accept image uploads in the first refactor. That keeps security, cleanup, file size limits, and privacy implications out of scope.

## SQLite Decision

Do not add SQLite in the initial refactor.

SQLite becomes useful when the app needs saved projects, recent local project metadata, user preferences that must sync across sessions outside browser storage, background job state, or batch-processing records. None of those are required to preserve the current editor behavior.

For now, use browser storage only if settings persistence is needed. Add SQLite later behind a clear repository interface in `backend/internal`.

## Development Workflow

The project should support:

- `frontend`: Nuxt dev server for UI work.
- `backend`: Go server for API/static serving.
- Root-level documentation explaining how to run both.

Recommended scripts can be added after scaffolding based on the package manager selected during implementation.

## Testing and Verification

Initial verification should include:

- Go unit tests for `/api/health` and `/api/version`.
- Frontend TypeScript check and production build.
- Manual smoke test that the editor loads, accepts an image, switches tools, and opens the save flow.

The refactor should avoid broad behavioral rewrites until the scaffold builds and the current editor shell runs in Nuxt.

## Out of Scope

- Server-side image processing.
- Authentication.
- SQLite schema and persistence.
- Visual redesign.
- New editor features.
- Cloud storage or remote uploads.

## Open Decisions Resolved

- Image operations stay browser-local.
- Go is used for backend API/static hosting and future extension points.
- Nuxt 3 with TypeScript is used for the frontend.
- SQLite is deferred until there is actual persistent backend data.
