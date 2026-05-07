// ==================== SHARED STATE ====================
export const S = {
  img: null, origImg: null, origData: null, workData: null,
  fname: 'image.png', tool: 'crop',
  zoom: 1, viewW: 0, viewH: 0,

  crop: { x:0, y:0, w:0, h:0, dragging:false, dragCorner:null, aspect:null, moving:false, moveStartX:0, moveStartY:0, moveOrigX:0, moveOrigY:0 },
  resize: { w:0, h:0, lock:true, pct:100, livePreview:true },
  grid: { rows:3, cols:3, hLines:[], vLines:[], hCh:false, vCh:false, drag:null, dIdx:-1 },
  bg: { aiLoaded:false, aiLoading:false, refine:false, tol:30, feather:3 },
  rotate: { angle:0, previewAngle:0, previewActive:false },

  history: [], histIdx:-1
};

// Reset rotation preview state
export function resetRotatePreview() {
  S.rotate.previewAngle = 0;
  S.rotate.previewActive = false;
}
