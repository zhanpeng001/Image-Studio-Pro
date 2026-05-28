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
    const fontStyle = (layer.italic ? 'italic ' : '') + (layer.bold ? 'bold ' : '');
    ctx.font = fontStyle + (layer.fontSize * scale) + 'px ' + (layer.fontFamily || 'sans-serif');
    ctx.fillStyle = layer.fontColor;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'start';
    const padding = 4 * scale;
    const lines = layoutCanvaText(layer.text || '', width - padding * 2, (value: string) => ctx.measureText(value).width);
    const lineHeight = layer.fontSize * scale * 1.3;
    const left = -width / 2 + padding;
    const top = -height / 2 + padding;

    // Text background fill
    if ((layer.textBgColor || 'transparent') !== 'transparent') {
      ctx.save();
      ctx.fillStyle = layer.textBgColor;
      const bgPad = padding;
      const bgW = width - bgPad * 2;
      const bgH = Math.min(lines.length * lineHeight + bgPad, height - bgPad * 2);
      ctx.fillRect(left - bgPad, top - bgPad, bgW + bgPad * 2, bgH + bgPad * 2);
      ctx.restore();
    }

    for (let index = 0; index < lines.length; index++) {
      const lineY = top + index * lineHeight;
      if (lineY + lineHeight > height / 2) break;
      const lineText = lines[index];
      const textMetrics = ctx.measureText(lineText);
      const textW = textMetrics.width;

      // Shadow pass (fill with shadow)
      if (layer.textShadow) {
        ctx.save();
        ctx.shadowColor = layer.textShadowColor;
        ctx.shadowBlur = (layer.textShadowBlur || 0) * scale;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        ctx.fillText(lineText, left, lineY);
        ctx.restore();
      } else {
        ctx.fillText(lineText, left, lineY);
      }

      // Outline pass (stroke without shadow)
      if (layer.textOutline) {
        ctx.save();
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.strokeStyle = layer.textOutlineColor;
        ctx.lineWidth = layer.textOutlineWidth * scale;
        ctx.strokeText(lineText, left, lineY);
        ctx.restore();
      }

      // Underline
      if (layer.underline && textW > 0) {
        ctx.save();
        ctx.strokeStyle = layer.fontColor;
        ctx.lineWidth = Math.max(1, layer.fontSize * scale * 0.08);
        const uy = lineY + lineHeight * 0.85;
        ctx.beginPath();
        ctx.moveTo(left, uy);
        ctx.lineTo(left + textW, uy);
        ctx.stroke();
        ctx.restore();
      }

      // Strikethrough
      if (layer.strikethrough && textW > 0) {
        ctx.save();
        ctx.strokeStyle = layer.fontColor;
        ctx.lineWidth = Math.max(1, layer.fontSize * scale * 0.08);
        const sy = lineY + lineHeight * 0.45;
        ctx.beginPath();
        ctx.moveTo(left, sy);
        ctx.lineTo(left + textW, sy);
        ctx.stroke();
        ctx.restore();
      }
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
