import type { CanvaLayer } from '../state.js';
import { ICON_DEFS } from './canva-icons.js';
import { layoutCanvaText, shouldPaintLayerContent } from './canva-layout.mjs';

export function renderLayerToContext(
  ctx: CanvasRenderingContext2D,
  layer: CanvaLayer,
  width: number,
  height: number,
  selected: boolean,
  scale: number
): void {
  if (!shouldPaintLayerContent(layer, selected)) return;

  if (layer.type === 'text') {
    ctx.font = (layer.bold ? 'bold ' : '') + (layer.fontSize * scale) + 'px sans-serif';
    ctx.fillStyle = layer.fontColor;
    ctx.textBaseline = 'top';
    const padding = 4 * scale;
    const lines = layoutCanvaText(layer.text || '', width - padding * 2, (value: string) => ctx.measureText(value).width);
    const lineHeight = layer.fontSize * scale * 1.3;
    const left = -width / 2 + padding;
    const top = -height / 2 + padding;
    for (let index = 0; index < lines.length; index++) {
      const lineY = top + index * lineHeight;
      if (lineY + lineHeight > height / 2) break;
      ctx.fillText(lines[index], left, lineY);
    }
    return;
  }

  if (layer.type === 'icon' && ICON_DEFS[layer.iconName]) {
    const def = ICON_DEFS[layer.iconName];
    const iconSize = Math.min(width, height);
    const iconScale = iconSize / 24;
    const offsetX = (width - 24 * iconScale) / 2;
    const offsetY = (height - 24 * iconScale) / 2;
    ctx.translate(-width / 2 + offsetX, -height / 2 + offsetY);
    ctx.scale(iconScale, iconScale);
    const path = new Path2D(def.path);
    if (def.style === 'fill') {
      ctx.fillStyle = layer.iconColor || '#ffffff';
      ctx.fill(path);
    } else {
      ctx.strokeStyle = layer.iconColor || '#ffffff';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke(path);
    }
    return;
  }

  if (layer.img) ctx.drawImage(layer.img, -width / 2, -height / 2, width, height);
}
