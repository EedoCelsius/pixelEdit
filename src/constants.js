export const OVERLAY_CONFIG = {
    SELECTED: {
        FILL_COLOR: 'rgba(56, 189, 248, 0.1)',
        STROKE_COLOR: 'rgba(56, 189, 248, 1.0)',
        STROKE_WIDTH_SCALE: 3,
    },
    MARQUEE: {
        FILL_COLOR: 'rgba(248, 229, 56, 0.0)',
        STROKE_COLOR: 'rgba(248, 229, 56, 1.0)',
        STROKE_WIDTH_SCALE: 1,
    },
    ADD: {
        FILL_COLOR: 'rgba(74, 222, 128, 0.25)',
        STROKE_COLOR: 'rgba(74, 222, 128, 1.0)',
        STROKE_WIDTH_SCALE: 2,
    },
    REMOVE: {
        FILL_COLOR: 'rgba(248, 113, 113, 0.25)',
        STROKE_COLOR: 'rgba(248, 113, 113, 1.0)',
        STROKE_WIDTH_SCALE: 2,
    }
};

export const CURSOR_CONFIG = {
    DRAW_STROKE: `url("/image/stage_cursor/strokePlus.svg") 0 0, crosshair`,
    DRAW_RECT: 'url("/image/stage_cursor/RectPlus.svg") 0 0, crosshair',
    ERASE_STROKE: `url("/image/stage_cursor/strokeMinus.svg") 0 0, crosshair`,
    ERASE_RECT: 'url("/image/stage_cursor/RectMinus.svg") 0 0, crosshair',
    ADD_STROKE: `url("/image/stage_cursor/strokePlus.svg") 0 0, crosshair`,
    ADD_RECT: 'url("/image/stage_cursor/RectPlus.svg") 0 0, crosshair',
    REMOVE_STROKE: `url("/image/stage_cursor/strokeMinus.svg") 0 0, crosshair`,
    REMOVE_RECT: 'url("/image/stage_cursor/RectMinus.svg") 0 0, crosshair',
    GLOBAL_ERASE_STROKE: `url("/image/stage_cursor/strokeMinus.svg") 0 0, crosshair`,
    GLOBAL_ERASE_RECT: 'url("/image/stage_cursor/RectMinus.svg") 0 0, crosshair',
};
