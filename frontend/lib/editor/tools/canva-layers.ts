import { S } from '../state.js';
import type { CanvaLayer } from '../state.js';
import { toast } from '../ui.js';

export function createLayer(img: HTMLImageElement | null, x: number, y: number, w: number, h: number): CanvaLayer {
  return {
    img, x, y, w, h,
    angle: 0, opacity: 1, ratioLocked: false, ratio: w / h,
    type: 'image', text: '', fontSize: 24, fontColor: '#ffffff',
    bold: false, italic: false, underline: false, strikethrough: false,
    fontFamily: 'sans-serif',
    textShadow: false, textShadowColor: '#000000', textShadowBlur: 4,
    textOutline: false, textOutlineColor: '#000000', textOutlineWidth: 2,
    textBgColor: 'transparent',
    iconName: '', iconColor: '#ffffff'
  };
}

export function createTextLayer(x: number, y: number, w: number, h: number): CanvaLayer {
  return {
    img: null, x, y, w, h,
    angle: 0, opacity: 1, ratioLocked: false, ratio: w / h,
    type: 'text', text: '', fontSize: 24, fontColor: '#ffffff',
    bold: false, italic: false, underline: false, strikethrough: false,
    fontFamily: 'sans-serif',
    textShadow: false, textShadowColor: '#000000', textShadowBlur: 4,
    textOutline: false, textOutlineColor: '#000000', textOutlineWidth: 2,
    textBgColor: 'transparent',
    iconName: '', iconColor: '#ffffff'
  };
}

export function createIconLayer(x: number, y: number, w: number, h: number, iconName: string): CanvaLayer {
  return {
    img: null, x, y, w, h,
    angle: 0, opacity: 1, ratioLocked: false, ratio: w / h,
    type: 'icon', text: '', fontSize: 24, fontColor: '#ffffff',
    bold: false, italic: false, underline: false, strikethrough: false,
    fontFamily: 'sans-serif',
    textShadow: false, textShadowColor: '#000000', textShadowBlur: 4,
    textOutline: false, textOutlineColor: '#000000', textOutlineWidth: 2,
    textBgColor: 'transparent',
    iconName,
    iconColor: '#ffffff'
  };
}

export function loadOverlayLayer(file: File, afterLoad: () => void): void {
  if (!file.type.startsWith('image/')) { toast('Not an image file'); return; }
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const c = S.canva;
      const canvasArea = document.getElementById('canvasArea')!;
      const viewCX = (canvasArea.scrollLeft + canvasArea.clientWidth / 2) / c.zoom;
      const viewCY = (canvasArea.scrollTop + canvasArea.clientHeight / 2) / c.zoom;
      const scale = Math.min(0.3, c.workspaceW * 0.2 / img.width, c.workspaceH * 0.2 / img.height);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const x = Math.round(viewCX - w / 2);
      const y = Math.round(viewCY - h / 2);
      c.layers.push(createLayer(img, x, y, w, h));
      c.selectedIdx = c.layers.length - 1;
      afterLoad();
      toast('Layer added \u2014 drag to position');
    };
    img.src = reader.result as string;
  };
  reader.readAsDataURL(file);
}
