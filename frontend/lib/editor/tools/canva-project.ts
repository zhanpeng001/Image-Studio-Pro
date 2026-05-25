import { S } from '../state.js';
import type { CanvaLayer } from '../state.js';
import { toast } from '../ui.js';
import { triggerDownload } from '../utils.js';

interface SavedLayer extends Omit<CanvaLayer, 'img'> {
  imgData?: string;
}

interface CanvaProject {
  version: number;
  workspaceW: number;
  workspaceH: number;
  zoom: number;
  layers: SavedLayer[];
}

export interface CanvaProjectHooks {
  applyZoom: (zoom: number, anchor?: { ax: number; ay: number }) => void;
  draw: () => void;
  renderPanel: (panel: HTMLElement) => void;
  showTextOverlay: () => void;
}

function imageToDataURL(img: HTMLImageElement): string {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  canvas.getContext('2d')!.drawImage(img, 0, 0);
  return canvas.toDataURL('image/png');
}

export function saveCanvaProject(): void {
  const c = S.canva;
  if (c.layers.length === 0) { toast('Nothing to save'); return; }
  const layers: SavedLayer[] = c.layers.map(layer => {
    const saved: SavedLayer = { ...layer, img: undefined } as unknown as SavedLayer;
    if (layer.type === 'image' && layer.img) saved.imgData = imageToDataURL(layer.img);
    return saved;
  });
  const project: CanvaProject = { version: 1, workspaceW: c.workspaceW, workspaceH: c.workspaceH, zoom: c.zoom, layers };
  triggerDownload(new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' }), 'project.canva.json');
  toast('Project saved');
}

export function loadCanvaProject(file: File, hooks: CanvaProjectHooks): void {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const project = JSON.parse(reader.result as string) as CanvaProject;
      if (!project.layers?.length) { toast('Invalid project file'); return; }
      const c = S.canva;
      c.workspaceW = project.workspaceW || 1920;
      c.workspaceH = project.workspaceH || 1080;
      const layers: CanvaLayer[] = project.layers.map(layer => ({
        img: null,
        x: layer.x, y: layer.y, w: layer.w, h: layer.h,
        angle: layer.angle || 0, opacity: layer.opacity ?? 1,
        ratioLocked: layer.ratioLocked || false, ratio: layer.ratio || layer.w / layer.h,
        type: layer.type,
        text: layer.text || '', fontSize: layer.fontSize || 24,
        fontColor: layer.fontColor || '#ffffff', bold: layer.bold || false,
        iconName: layer.iconName || '', iconColor: layer.iconColor || '#ffffff'
      }));
      const imageLayers = project.layers.flatMap((layer, index) => layer.type === 'image' && layer.imgData ? [{ index, data: layer.imgData }] : []);
      if (imageLayers.length === 0) {
        finishLoad(layers, project.zoom || 1, hooks);
        return;
      }
      let remaining = imageLayers.length;
      imageLayers.forEach(({ index, data }) => {
        const img = new Image();
        img.onload = () => {
          layers[index].img = img;
          remaining--;
          if (remaining === 0) finishLoad(layers, project.zoom || 1, hooks);
        };
        img.onerror = () => { toast('Failed to decode project image'); };
        img.src = data;
      });
    } catch {
      toast('Failed to parse project file');
    }
  };
  reader.readAsText(file);
}

function finishLoad(layers: CanvaLayer[], zoom: number, hooks: CanvaProjectHooks): void {
  const c = S.canva;
  c.layers = layers;
  c.selectedIdx = layers.length > 0 ? 0 : -1;
  hooks.applyZoom(zoom, { ax: 0, ay: 0 });
  hooks.draw();
  if (layers[0]?.type === 'text') hooks.showTextOverlay();
  const panel = document.getElementById('panel');
  if (panel) hooks.renderPanel(panel);
  toast('Project loaded (' + layers.length + ' layers)');
}
