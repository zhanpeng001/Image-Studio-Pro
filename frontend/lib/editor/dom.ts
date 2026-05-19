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

// Canvas elements. Bound during init so Nuxt remount/HMR can replace page DOM.
export let mc: HTMLCanvasElement;
export let oc: HTMLCanvasElement;
export let ctx: CanvasRenderingContext2D;
export let octx: CanvasRenderingContext2D;

// Other commonly used elements
export let panel: EditorElement;
export let dropzone: EditorElement;
export let canvasWrap: EditorElement;
export let imageInfo: EditorElement;
export let statusDim: EditorElement;
export let statusTool: EditorElement;
export let statusZoom: EditorElement;
export let canvasArea: EditorElement;
export let saveModal: EditorElement;

export function refreshDomBindings() {
  mc = $('mainCanvas') as unknown as HTMLCanvasElement;
  oc = $('overlayCanvas') as unknown as HTMLCanvasElement;
  ctx = mc.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
  octx = oc.getContext('2d') as CanvasRenderingContext2D;
  panel = $('panel');
  dropzone = $('dropzone');
  canvasWrap = $('canvasWrap');
  imageInfo = $('imageInfo');
  statusDim = $('statusDim');
  statusTool = $('statusTool');
  statusZoom = $('statusZoom');
  canvasArea = $('canvasArea');
  saveModal = $('saveModal');
}
