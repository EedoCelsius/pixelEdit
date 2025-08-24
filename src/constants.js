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
    DRAW_STROKE: `url("image/stage_cursor/draw_stroke.svg") 0 0, crosshair`,
    DRAW_RECT: 'url("image/stage_cursor/draw_rect.svg") 0 0, crosshair',
    ERASE_STROKE: `url("image/stage_cursor/erase_stroke.svg") 0 0, crosshair`,
    ERASE_RECT: 'url("image/stage_cursor/erase_rect.svg") 0 0, crosshair',
    ADD_STROKE: `url("image/stage_cursor/add_stroke.svg") 0 16, crosshair`,
    ADD_RECT: 'url("image/stage_cursor/add_rect.svg") 0 0, crosshair',
    REMOVE_STROKE: `url("image/stage_cursor/remove_stroke.svg") 0 16, crosshair`,
    REMOVE_RECT: 'url("image/stage_cursor/remove_rect.svg") 0 0, crosshair',
    GLOBAL_ERASE_STROKE: `url("image/stage_cursor/global_erase_stroke.svg") 0 0, crosshair`,
    GLOBAL_ERASE_RECT: 'url("image/stage_cursor/global_erase_rect.svg") 0 0, crosshair',
    CUT_STROKE: `url("image/stage_cursor/cut_stroke.svg") 0 16, crosshair`,
    CUT_RECT: 'url("image/stage_cursor/cut_rect.svg") 0 0, crosshair',
};
