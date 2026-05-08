export const $ = id => document.getElementById(id);

// Canvas elements
export const mc = $('mainCanvas');
export const oc = $('overlayCanvas');
export const ctx = mc.getContext('2d', { willReadFrequently: true });
export const octx = oc.getContext('2d');

// Other commonly used elements
export const panel = $('panel');
export const dropzone = $('dropzone');
export const canvasWrap = $('canvasWrap');
export const fileInput = $('fileInput');
export const imageInfo = $('imageInfo');
export const statusDim = $('statusDim');
export const statusTool = $('statusTool');
export const statusZoom = $('statusZoom');
export const canvasArea = $('canvasArea');
export const saveModal = $('saveModal');
