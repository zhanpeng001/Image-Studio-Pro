// ==================== SHARED STATE ====================
export type EditorTool = 'crop' | 'resize' | 'grid' | 'bgremove' | 'rotate';

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

export interface BackgroundRemovalState {
  aiLoaded: boolean;
  aiLoading: boolean;
  refine: boolean;
  tol: number;
  feather: number;
}

export interface RotateState {
  angle: number;
  previewAngle: number;
  previewActive: boolean;
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
  rotate: RotateState;
}

export const S: EditorState = {
  img: null, origImg: null, origData: null, workData: null,
  fname: 'image.png', tool: 'crop',
  zoom: 1, viewW: 0, viewH: 0,

  crop: { x:0, y:0, w:0, h:0, dragging:false, dragCorner:null, aspect:null, moving:false, moveStartX:0, moveStartY:0, moveOrigX:0, moveOrigY:0 },
  resize: { w:0, h:0, lock:true, pct:100, livePreview:true },
  grid: { rows:3, cols:3, hLines:[], vLines:[], hCh:false, vCh:false, drag:null, dIdx:-1 },
  bg: { aiLoaded:false, aiLoading:false, refine:false, tol:30, feather:3 },
  rotate: { angle:0, previewAngle:0, previewActive:false },

  history: [], redoHistory: [], histIdx:-1
};

// Reset rotation preview state
export function resetRotatePreview() {
  S.rotate.previewAngle = 0;
  S.rotate.previewActive = false;
}
