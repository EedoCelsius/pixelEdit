export const GRID_STROKE_COLOR = '#0000002e';

export const MIN_SCALE_RATIO = 0.5;

export const CHECKERBOARD_CONFIG = {
    PATTERN_ID: 'chk',
    COLOR_A: '#0a1f33',
    COLOR_B: '#0c2742',
    REPEAT: Number(localStorage.getItem('settings.checkerboardRepeat')) || 1,
};
