<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/zhanpeng001/Image-Studio-Pro/main/assets/logo-dark.png">
    <img src="https://raw.githubusercontent.com/zhanpeng001/Image-Studio-Pro/main/assets/logo.png" alt="Image Studio Pro" width="140">
  </picture>
</p>

<h1 align="center">Image Studio Pro</h1>

<p align="center">
  <strong>The 100% Free, 100% Private, Zero-Compromise Image Editor</strong><br>
  Runs entirely in your browser. No uploads. No watermarks. No paywalls. No bullshit.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/status-active-success" alt="Status">
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="License">
  <img src="https://img.shields.io/badge/privacy-100%25%20local-green" alt="Privacy">
  <img src="https://img.shields.io/badge/price-FREE-brightgreen" alt="Price">
</p>

---

## The Backstory - Why This Exists

It started the way these things always start: with frustration.

I needed to remove the background from a product photo. Simple enough, right? I searched *free background remover* - half the results were bait, the other half bait-and-switch.

- One site let me upload three images, then locked me behind a $12/month paywall.
- Another stripped the background beautifully - then slapped a **giant watermark** across the final download.
- A third claimed it was free but silently **downscaled my 4K image to 720p** unless I paid.

The pattern was everywhere. **Free online image tools are a lie.** Every single one of them is a funnel. The free tier exists to frustrate you into paying - by degrading your output, limiting your usage, watermarking your work, or outright hijacking your images to who-knows-where.

And even when they *are* genuinely free, you have to upload your images to some random server. Wedding photos. Sensitive documents. Creative work in progress. All of it leaves your machine.

So I built **Image Studio Pro** - an image editor that:

- Runs entirely in your browser. Your images never leave your computer. Ever.
- Uses AI (running locally via ONNX Runtime) for background removal - no cloud, no API keys, no usage limits.
- Never degrades, watermarks, or compresses your output unless you choose to.
- Has zero paywalls, zero accounts, zero tracking, zero nonsense.

**This is what free should have always meant.**

---

## Features

### AI Background Removal
One-click background removal powered by [IMG.LY](https://www.npmjs.com/package/@imgly/background-removal). The neural network runs **locally in your browser** - no server, no upload, no API credit system. Refine edges with tolerance and feather controls.

### Smart Crop
Freeform crop with 7 aspect ratio presets (1:1, 4:3, 16:9, 3:2, 2:3, 9:16). Includes a **rule-of-thirds overlay** and draggable corner handles for precision.

### Resize and Scale
Pixel-perfect resize with optional aspect ratio lock. Quick presets for common dimensions (1080p, 720p, 800x600, 512x512, 256x256). Percentage-based scaling from 1% to 400%.

### Grid Split
Slice any image into a custom grid (up to 20x20 = 400 cells). Drag split lines interactively. Download all cells as a **ZIP archive** in one click - perfect for sprite sheets, Instagram carousels, or print layouts.

### Rotate and Flip
90-degree rotations, 180-degree flips, or fine-tune with a custom angle slider (-180 to 180). Horizontal and vertical mirroring in one click.

### Multi-Format Export
Save as **PNG** (lossless + transparency), **JPEG** (adjustable quality), or **WebP** (modern, small, supports transparency). Quality slider for JPEG and WebP.

### Undo and Redo
Full undo/redo history (up to 50 states). Never lose work to a misclick.

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl + O | Open image |
| Ctrl + S | Save image |
| Ctrl + Z | Undo |

---

## Privacy and Security

> Your images are never uploaded anywhere.

Every operation - cropping, resizing, rotating, filtering, even AI background removal - happens inside your browser via the Canvas API and local ONNX inference. There is no backend server. There is no telemetry. There are no analytics. You can turn off your internet after loading the page and everything will still work.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Canvas | HTML5 Canvas API |
| AI Inference | ONNX Runtime Web + IMG.LY |
| ZIP Export | JSZip |
| UI | Vanilla CSS3 (Flexbox + Custom Properties) |
| Icons | Inline SVG |
| Logic | Zero-dependency Vanilla JS |

---

## Getting Started

Open `index.html` in any modern browser. That is it.

No build step. No npm install. No Docker.

```bash
python -m http.server 8080
npx serve .
```

---

## Browser Support

| Browser | Status |
|---------|--------|
| Chrome / Edge 90+ | Fully supported |
| Firefox 90+ | Fully supported |
| Safari 15+ | Fully supported |
| Mobile browsers | Fully supported |

> ONNX Runtime Web requires WebAssembly and WebGL. Available in all modern browsers.

---

## Roadmap

- Filters and adjustments (brightness, contrast, saturation, blur)
- Text and annotation overlay
- Batch processing
- PWA support (install as desktop app)
- Dark mode
- Touch gestures for mobile crop and resize

---

## Contributing

This project was born from one person is frustration - but it does not have to stay that way. If you believe image tools should be free, private, and non-degrading, PRs are genuinely welcome.

1. Fork the repo
2. Create a feature branch
3. Make your changes
4. Open a PR

---

## License

MIT - do whatever you want. Just do not charge people for basic image editing.

---

<p align="center">
  <sub>Made with frustration and caffeine. No images were uploaded in the making of this tool.</sub>
</p>
