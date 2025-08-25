import cursorIcons from './image/stage_cursor';

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
    DRAW_STROKE: `url("${cursorIcons.drawStroke}") 0 0, crosshair`,
    DRAW_RECT: `url("${cursorIcons.drawRect}") 0 0, crosshair`,
    ERASE_STROKE: `url("${cursorIcons.eraseStroke}") 0 0, crosshair`,
    ERASE_RECT: `url("${cursorIcons.eraseRect}") 0 0, crosshair`,
    ADD_STROKE: `url("${cursorIcons.addStroke}") 0 16, crosshair`,
    ADD_RECT: `url("${cursorIcons.addRect}") 0 0, crosshair`,
    REMOVE_STROKE: `url("${cursorIcons.removeStroke}") 0 16, crosshair`,
    REMOVE_RECT: `url("${cursorIcons.removeRect}") 0 0, crosshair`,
    GLOBAL_ERASE_STROKE: `url("${cursorIcons.globalEraseStroke}") 0 0, crosshair`,
    GLOBAL_ERASE_RECT: `url("${cursorIcons.globalEraseRect}") 0 0, crosshair`,
    CUT_STROKE: `url("${cursorIcons.cutStroke}") 0 16, crosshair`,
    CUT_RECT: `url("${cursorIcons.cutRect}") 0 0, crosshair`,
};
