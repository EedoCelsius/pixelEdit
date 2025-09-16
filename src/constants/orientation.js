export const OT = Object.freeze({
  DEFAULT: 255,
  NONE: 1,
  HORIZONTAL: 2,
  DOWNSLOPE: 3,
  VERTICAL: 4,
  UPSLOPE: 5,
  STAR: 6,
});

export const PIXEL_ORIENTATIONS = Object.values(OT).filter(o => o !== OT.DEFAULT);
export const PIXEL_DEFAULT_ORIENTATIONS = [...PIXEL_ORIENTATIONS, 'checkerboard'];
export const DEFAULT_CHECKERBOARD_ORIENTATIONS = [OT.HORIZONTAL, OT.VERTICAL];
export const ORIENTATION_LABELS = {
  [OT.NONE]: 'none',
  [OT.HORIZONTAL]: 'horizontal',
  [OT.DOWNSLOPE]: 'downslope',
  [OT.VERTICAL]: 'vertical',
  [OT.UPSLOPE]: 'upslope',
  [OT.STAR]: 'star',
  checkerboard: 'checkerboard'
};
