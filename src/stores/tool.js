import { defineStore } from 'pinia';
import { useSelectionStore } from './selection';

export const useToolStore = defineStore('tool', {
    state: () => ({
        tool: 'draw', // 'draw' | 'erase' | 'select' | 'globalErase'
        toolShape: 'stroke', // 'stroke' | 'rect'
        ctrlHeld: false,
        shiftHeld: false,
        // pointer interaction state
        state: {
            status: 'idle', // 'idle' | 'stroke' | 'rect'
            startPoint: null,
            pointerId: null,
            isDragging: false,
            selectionMode: null, // 'add' | 'remove'
        },
        marquee: { visible: false, x: 0, y: 0, w: 0, h: 0 },
        initialSelectionOnDrag: new Set(),
        addOverlayLayerIds: new Set(),
        removeOverlayLayerIds: new Set(),
        lastPoint: null,
        visited: new Set(),
    }),
    getters: {
        currentMode() {
            const selection = useSelectionStore();
            return selection.size === 1 ? 'single' : 'multi';
        },
        effectiveMode() {
            if (this.currentMode === 'single' && this.shiftHeld) {
                return 'multi';
            }
            return this.currentMode;
        },
        effectiveTool() {
            if (this.shiftHeld) return 'select';
            if (this.ctrlHeld) {
                if (this.currentMode === 'single' && (this.tool === 'draw' || this.tool === 'erase')) {
                    return this.tool === 'draw' ? 'erase' : 'draw';
                }
                if (this.currentMode === 'multi' && (this.tool === 'select' || this.tool === 'globalErase')) {
                    return this.tool === 'select' ? 'globalErase' : 'select';
                }
            }
            return this.tool;
        },
        isDraw() { return this.effectiveTool === 'draw'; },
        isErase() { return this.effectiveTool === 'erase'; },
        isSelect() { return this.effectiveTool === 'select'; },
        isGlobalErase() { return this.effectiveTool === 'globalErase'; },
        isStroke: (state) => state.toolShape === 'stroke',
        isRect: (state) => state.toolShape === 'rect',
    },
    actions: {
        setTool(newTool) {
            this.tool = newTool;
        },
        setToolShape(shape) {
            this.toolShape = (shape === 'rect') ? 'rect' : 'stroke';
        },
        setCtrlHeld(isHeld) {
            this.ctrlHeld = !!isHeld;
        },
        setShiftHeld(isHeld) {
            this.shiftHeld = !!isHeld;
        },
    }
});
