// ==================== SHARED STATE ====================
export type EditorTool = 'crop' | 'resize' | 'grid' | 'bgremove' | 'rotate' | 'canva' | 'compressor';

export interface HistoryEntry {
  dataURL: string;
  w: number;
  h: number;
  label: string;
}

export interface CropState {
  x: number;
  y: number;
  w: number;
  h: number;
  dragging: boolean;
  dragCorner: string | null;
  aspect: string | null;
  moving: boolean;
  moveStartX: number;
  moveStartY: number;
  moveOrigX: number;
  moveOrigY: number;
  expand: number;
  fillColor: string;
  eyedropping: boolean;
}

export interface ResizeState {
  w: number;
  h: number;
  lock: boolean;
  pct: number;
  livePreview: boolean;
}

export interface GridState {
  rows: number;
  cols: number;
  hLines: number[];
  vLines: number[];
  hCh: boolean;
  vCh: boolean;
  drag: string | null;
  dIdx: number;
}

export interface CanvaLayer {
  img: HTMLImageElement | null;
  x: number;
  y: number;
  w: number;
  h: number;
  angle: number;
  opacity: number;
  ratioLocked: boolean;
  ratio: number;
  type: 'image' | 'text' | 'icon';
  text: string;
  fontSize: number;
  fontColor: string;
  bold: boolean;
  iconName: string;
  iconColor: string;
}

export interface CanvaState {
  layers: CanvaLayer[];
  selectedIdx: number;
  zoom: number;
  workspaceW: number;
  workspaceH: number;
  panning: boolean;
  dragging: boolean;
  dragCorner: string | null;
  moving: boolean;
  moveStartX: number;
  moveStartY: number;
  moveOrigX: number;
  moveOrigY: number;
  rotateOrigAngle: number;
  rotateStartAngle: number;
  resizeOrigX: number;
  resizeOrigY: number;
  resizeOrigW: number;
  resizeOrigH: number;
  resizeOrigAngle: number;
}

export interface BackgroundRemovalState {
  aiLoaded: boolean;
  aiLoading: boolean;
  refine: boolean;
  tol: number;
  feather: number;
  model: 'isnet_quint8' | 'isnet_fp16' | 'isnet';
  enhance: boolean;
}

export interface RotateState {
  angle: number;
  previewAngle: number;
  previewActive: boolean;
  snapshots: RotateSnapshot[];
  nextSnapshotId: number;
}

export interface RotateSnapshot {
  id: number;
  angle: number;
  width: number;
  height: number;
  dataURL: string;
  createdAt: number;
}

export interface CompressorState {
  format: 'image/jpeg' | 'image/webp';
  quality: number;
}

export interface HandlePositions {
  tl: { x: number; y: number };
  tr: { x: number; y: number };
  br: { x: number; y: number };
  bl: { x: number; y: number };
  tm: { x: number; y: number };
  rm: { x: number; y: number };
  bm: { x: number; y: number };
  lm: { x: number; y: number };
  rot: { x: number; y: number };
}

export interface ScaledHandles {
  tl: { x: number; y: number };
  tr: { x: number; y: number };
  br: { x: number; y: number };
  bl: { x: number; y: number };
  tm: { x: number; y: number };
  rm: { x: number; y: number };
  bm: { x: number; y: number };
  lm: { x: number; y: number };
  rot: { x: number; y: number };
}

export interface EditorState {
  tool: EditorTool;
  img: HTMLImageElement | null;
  origImg: HTMLImageElement | null;
  fname: string;
  history: HistoryEntry[];
  redoHistory: HistoryEntry[];
  histIdx: number;
  zoom: number;
  viewW: number;
  viewH: number;
  origData: ImageData | null;
  workData: ImageData | null;
  crop: CropState;
  resize: ResizeState;
  grid: GridState;
  bg: BackgroundRemovalState;
  canva: CanvaState;
  rotate: RotateState;
  compressor: CompressorState;
}

export const S: EditorState = {
  img: null, origImg: null, origData: null, workData: null,
  fname: 'image.png', tool: 'crop',
  zoom: 1, viewW: 0, viewH: 0,

  crop: { x:0, y:0, w:0, h:0, dragging:false, dragCorner:null, aspect:null, moving:false, moveStartX:0, moveStartY:0, moveOrigX:0, moveOrigY:0, expand:0, fillColor:'#FFFFFF', eyedropping:false },
  resize: { w:0, h:0, lock:true, pct:100, livePreview:true },
  grid: { rows:3, cols:3, hLines:[], vLines:[], hCh:false, vCh:false, drag:null, dIdx:-1 },
  bg: { aiLoaded:false, aiLoading:false, refine:false, tol:30, feather:3, model:'isnet_fp16', enhance:false },
  canva: { layers:[], selectedIdx:-1, zoom:1, workspaceW:0, workspaceH:0, panning:false, dragging:false, dragCorner:null, moving:false, moveStartX:0, moveStartY:0, moveOrigX:0, moveOrigY:0, rotateOrigAngle:0, rotateStartAngle:0, resizeOrigX:0, resizeOrigY:0, resizeOrigW:0, resizeOrigH:0, resizeOrigAngle:0 },
  rotate: { angle:0, previewAngle:0, previewActive:false, snapshots:[], nextSnapshotId:1 },
  compressor: { format: 'image/jpeg', quality: 80 },

  history: [], redoHistory: [], histIdx:-1
};

// Reset rotation preview state
export function resetRotatePreview() {
  S.rotate.previewAngle = 0;
  S.rotate.previewActive = false;
}
