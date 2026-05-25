# Image Studio Pro

Image Studio Pro is a private, browser-first image editor built for fast everyday image work: crop, resize, rotate, split grids, remove backgrounds, compose layers, compress, and export without sending image data to a remote editing service.

The application is designed as a polished local editing workspace. Most image operations run directly in the browser through Canvas APIs, with AI background removal powered by browser-side inference.

![Status](https://img.shields.io/badge/status-active-success)
![Frontend](https://img.shields.io/badge/frontend-Nuxt-00DC82)
![Backend](https://img.shields.io/badge/backend-Go-00ADD8)
![Privacy](https://img.shields.io/badge/privacy-browser--local-brightgreen)

## Highlights

- **Private browser-local editing**: image pixels stay in the browser for core editing operations.
- **Professional editing workspace**: polished dark UI with a canvas workspace, tool rail, settings panel, and export flows.
- **AI background removal**: local in-browser background removal using `@imgly/background-removal` and ONNX Runtime Web.
- **Canva-style layers**: add image layers, position, resize, rotate, reorder, and flatten them into a single image.
- **Rotation snapshots**: save multiple rotated angle snapshots, delete unwanted takes, and download all saved snapshots as a ZIP.
- **Grid split export**: slice images into rows and columns, then download all cells as a ZIP archive.
- **Modern export formats**: save as PNG, JPEG, or WebP.
- **Undo and redo**: edit history for safer experimentation.

## Feature Overview

| Tool | Description |
| --- | --- |
| Crop | Freeform crop, common aspect ratios, crop reset, and full-image resize. |
| Scale | Resize by dimensions or percentage with aspect-ratio locking. |
| Grid Split | Divide an image into configurable rows and columns and export cells as a ZIP. |
| Background Remove | Run local AI background removal with refinement controls. |
| Rotate | Rotate by presets or custom angles, flip horizontally/vertically, and save rotation snapshots. |
| Compress | Preview and download optimized JPEG/WebP output. |
| Canva | Add and transform layers, reorder them, and merge all layers into a flattened image. |

## Tech Stack

| Area | Technology |
| --- | --- |
| Frontend | Nuxt 3, Vue 3, TypeScript |
| Canvas editing | HTML Canvas API |
| AI background removal | `@imgly/background-removal`, `onnxruntime-web` |
| ZIP generation | JSZip |
| Backend | Go HTTP server |
| Static delivery | Nuxt static output, optional Go static file server |

## Project Structure

```text
.
├── backend/
│   ├── cmd/server/              # Go server entry point
│   └── internal/
│       ├── config/              # Backend configuration
│       └── httpapi/             # API routes and static file serving
├── frontend/
│   ├── assets/css/editor.css    # Main application styling
│   ├── lib/editor/              # Editor state, canvas, history, tools
│   ├── pages/index.vue          # Application shell
│   └── public/logo.svg          # Project logo and favicon
└── README.md
```

## Getting Started

### Prerequisites

- Node.js 18 or newer
- npm
- Go 1.22 or newer, only required for the optional backend server

### Install Frontend Dependencies

```bash
cd frontend
npm install
```

### Start the Local Server

Use this path when you want the app running locally without relying on the Nuxt dev server:

```bash
cd frontend
npm run generate
cd ../backend
go run ./cmd/server
```

Open:

```text
http://127.0.0.1:8080
```

If Go cannot initialize its default build cache on Windows, run the backend with a repo-local cache:

```powershell
cd backend
$env:GOCACHE = "$PWD\..\.cache\go-build"
go run ./cmd/server
```

### Run the Frontend Dev Server

```bash
npm run dev
```

The Nuxt dev server is configured for:

```text
http://127.0.0.1:3000
```

### Build the Frontend

```bash
npm run build
```

For a static output:

```bash
npm run generate
```

Nuxt writes the generated static site to:

```text
frontend/.output/public
```

## Optional Backend

The Go backend exposes lightweight API routes and can serve the generated frontend as static files.

### Run Backend Tests

```bash
cd backend
go test ./...
```

### Run the Backend

```bash
cd backend
go run ./cmd/server
```

Default backend address:

```text
http://127.0.0.1:8080
```

Available API routes:

| Route | Description |
| --- | --- |
| `GET /api/health` | Returns backend health status. |
| `GET /api/version` | Returns configured backend version. |

## Privacy Model

Image Studio Pro is built around a local-first editing model. Core image operations use browser APIs and operate on image data already loaded into the page. AI background removal is performed through browser-side inference rather than a hosted editing API.

There are no user accounts, upload queues, or watermarking flows in the editor.

## Development Commands

Frontend:

```bash
cd frontend
npm run dev
npm run build
npm run generate
npm run typecheck
```

Backend:

```bash
cd backend
go test ./...
go run ./cmd/server
```

## Notes

- Large AI model assets may be loaded by the browser when using background removal.
- Browser support depends on modern Canvas, WebAssembly, and WebGL capabilities.
- The frontend is currently configured as a client-side Nuxt app (`ssr: false`).

## License

MIT. See the repository license for details.
