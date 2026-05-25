/** 10-color palette used by crop fill, canva text, and canva icon pickers. */
export const COLOR_PRESETS = ['#FFFFFF','#000000','#FF4444','#FF8800','#FFDD00','#00CC44','#0088FF','#8833FF','#FF44AA','#888888'];

/** Draw an HTMLImageElement onto a new canvas and return the canvas. */
export function canvasFromImage(img: HTMLImageElement): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth || img.width;
  c.height = img.naturalHeight || img.height;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  return c;
}

/** Create an HTMLImageElement from a canvas and wait for it to load. */
export function loadImageFromCanvas(canvas: HTMLCanvasElement): Promise<HTMLImageElement> {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.src = canvas.toDataURL('image/png');
  });
}

/** Trigger a browser download for a Blob with the given filename. */
export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Highlight the preset swatch matching `color` inside the container with `containerId`. */
export function highlightPreset(containerId: string, color: string): void {
  const presets = document.querySelectorAll('#' + containerId + ' .color-preset-swatch');
  presets.forEach(s => {
    const el = s as HTMLElement;
    el.classList.toggle('active', el.dataset.color?.toUpperCase() === color.toUpperCase());
  });
}

/** Helper: build HTML string for a row of color preset swatches. */
export function buildColorPresetsHTML(containerId: string, activeColor: string): string {
  return '<div class="color-presets" id="' + containerId + '">' +
    COLOR_PRESETS.map(c =>
      '<span class="color-preset-swatch' + (activeColor.toUpperCase() === c.toUpperCase() ? ' active' : '') + '" data-color="' + c + '" style="background:' + c + ';" title="' + c + '"></span>'
    ).join('') +
    '</div>';
}

/** Helper: wire click events on a color-presets container, calling onChange with the color. */
export function wireColorPresets(containerId: string, onChange: (color: string) => void): void {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.addEventListener('click', e => {
    const swatch = (e.target as HTMLElement).closest('.color-preset-swatch');
    if (!swatch) return;
    onChange((swatch as HTMLElement).dataset.color!);
  });
}
