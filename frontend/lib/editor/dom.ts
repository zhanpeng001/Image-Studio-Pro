interface EditorElement extends HTMLElement {
  checked: boolean;
  files: FileList | null;
  value: string;
}

export function $(id: string): EditorElement {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing required element #${id}`);
  }
  return element as EditorElement;
}

export function optional$(id: string): EditorElement | null {
  return document.getElementById(id) as EditorElement | null;
}

// Canvas elements
export const mc = $('mainCanvas') as unknown as HTMLCanvasElement;
export const oc = $('overlayCanvas') as unknown as HTMLCanvasElement;
export const ctx = mc.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
export const octx = oc.getContext('2d') as CanvasRenderingContext2D;

// Other commonly used elements
export const panel = $('panel');
export const dropzone = $('dropzone');
export const canvasWrap = $('canvasWrap');
export const fileInput = $('fileInput') as HTMLInputElement;
export const imageInfo = $('imageInfo');
export const statusDim = $('statusDim');
export const statusTool = $('statusTool');
export const statusZoom = $('statusZoom');
export const canvasArea = $('canvasArea');
export const saveModal = $('saveModal');
