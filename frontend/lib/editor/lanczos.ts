
// Lanczos-3 resampling kernel
function lanczosKernel(x: number): number {
  if (x === 0) return 1;
  if (Math.abs(x) >= 3) return 0;
  const a = 3;
  const px = Math.PI * x;
  return (a * Math.sin(px) * Math.sin(px / a)) / (px * px);
}

export function lanczosResize(
  srcCanvas: HTMLCanvasElement,
  dstW: number,
  dstH: number
): HTMLCanvasElement {
  const srcW = srcCanvas.width;
  const srcH = srcCanvas.height;
  const srcCtx = srcCanvas.getContext('2d')!;
  const srcData = srcCtx.getImageData(0, 0, srcW, srcH);

  const dst = document.createElement('canvas');
  dst.width = dstW;
  dst.height = dstH;
  const dstCtx = dst.getContext('2d')!;
  const dstData = dstCtx.createImageData(dstW, dstH);

  const scaleX = srcW / dstW;
  const scaleY = srcH / dstH;
  const radius = 3; // Lanczos-3 support radius

  for (let dy = 0; dy < dstH; dy++) {
    for (let dx = 0; dx < dstW; dx++) {
      // Source coordinate for this output pixel
      const sx = (dx + 0.5) * scaleX - 0.5;
      const sy = (dy + 0.5) * scaleY - 0.5;

      const sx0 = Math.floor(sx);
      const sy0 = Math.floor(sy);

      let r = 0, g = 0, b = 0, a = 0;
      let weightSum = 0;

      for (let ky = sy0 - radius + 1; ky <= sy0 + radius; ky++) {
        const wy = lanczosKernel((sy - ky) / scaleY);
        if (Math.abs(wy) < 0.001) continue;

        const clampedY = Math.max(0, Math.min(srcH - 1, ky));

        for (let kx = sx0 - radius + 1; kx <= sx0 + radius; kx++) {
          const wx = lanczosKernel((sx - kx) / scaleX);
          if (Math.abs(wx) < 0.001) continue;

          const clampedX = Math.max(0, Math.min(srcW - 1, kx));
          const weight = wx * wy;
          const idx = (clampedY * srcW + clampedX) * 4;

          r += srcData.data[idx] * weight;
          g += srcData.data[idx + 1] * weight;
          b += srcData.data[idx + 2] * weight;
          a += srcData.data[idx + 3] * weight;
          weightSum += weight;
        }
      }

      const di = (dy * dstW + dx) * 4;
      if (weightSum > 0) {
        dstData.data[di] = Math.min(255, Math.max(0, r / weightSum));
        dstData.data[di + 1] = Math.min(255, Math.max(0, g / weightSum));
        dstData.data[di + 2] = Math.min(255, Math.max(0, b / weightSum));
        dstData.data[di + 3] = Math.min(255, Math.max(0, a / weightSum));
      }
    }
  }

  dstCtx.putImageData(dstData, 0, 0);
  return dst;
}

// Smart resize: if downscaling > 2x, use stepped canvas halving then Lanczos for final step.
// This is much faster than pure Lanczos for large downscales.
export function smartResize(
  srcCanvas: HTMLCanvasElement,
  dstW: number,
  dstH: number
): HTMLCanvasElement {
  let current = srcCanvas;
  let cw = current.width;
  let ch = current.height;

  // Step down by halves using canvas (fast, good at 2x)
  while (cw / 2 >= dstW && ch / 2 >= dstH) {
    cw = Math.max(dstW, Math.round(cw / 2));
    ch = Math.max(dstH, Math.round(ch / 2));
    const half = document.createElement('canvas');
    half.width = cw;
    half.height = ch;
    half.getContext('2d')!.drawImage(current, 0, 0, cw, ch);
    current = half;
  }

  // Final step with Lanczos for quality
  if (cw === dstW && ch === dstH) return current;
  return lanczosResize(current, dstW, dstH);
}
