import { S } from './state.js';
import { mc, oc, ctx } from './dom.js';

export function fitImage() {
  if (!S.img) return;
  const maxW = window.innerWidth - 64 - 280 - 32;
  const maxH = window.innerHeight - 44 - 26 - 32;
  let w = S.img.width, h = S.img.height;
  if (w > maxW) { h = h * maxW / w; w = maxW; }
  if (h > maxH) { w = w * maxH / h; h = maxH; }
  S.viewW = w; S.viewH = h; S.zoom = w / S.img.width;
  mc.width = w; mc.height = h;
  oc.width = w; oc.height = h;
  mc.style.width = w + 'px'; mc.style.height = h + 'px';
  oc.style.width = w + 'px'; oc.style.height = h + 'px';
}

export function renderAll() {
  if (!S.img) return;
  ctx.clearRect(0, 0, mc.width, mc.height);
  ctx.drawImage(S.img, 0, 0, mc.width, mc.height);
  S.origData = ctx.getImageData(0, 0, mc.width, mc.height);
  S.workData = new ImageData(new Uint8ClampedArray(S.origData.data), mc.width, mc.height);
  applyWork();
}

export function applyWork() { ctx.putImageData(S.workData, 0, 0); }

export function resetWork() {
  if (!S.origData) return;
  S.workData = new ImageData(new Uint8ClampedArray(S.origData.data), mc.width, mc.height);
  applyWork();
}

export function renderRotatePreview(angleDeg) {
  if (!S.img) return;
  const rad = angleDeg * Math.PI / 180;
  const iw = S.img.width, ih = S.img.height;
  ctx.clearRect(0, 0, mc.width, mc.height);
  ctx.save();
  ctx.translate(mc.width / 2, mc.height / 2);
  ctx.rotate(rad);
  ctx.drawImage(S.img, -iw / 2, -ih / 2, iw, ih);
  ctx.restore();
  S.origData = ctx.getImageData(0, 0, mc.width, mc.height);
  S.workData = new ImageData(new Uint8ClampedArray(S.origData.data), mc.width, mc.height);
}
