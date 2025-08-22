import { defineStore } from 'pinia';
import { useSelectionStore } from './selection';
import { useStageStore } from './stage';
import { clamp } from '../utils';

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
            selectionMode: null, // 'add' | 'remove'
            lastPoint: null,
        },
        hoverLayerId: null,
        selectionBeforeDrag: new Set(),
        selectOverlayLayerIds: new Set(),
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
        marquee() {
            const stage = useStageStore();
            const s = this.state;
            if (s.status !== 'rect' || !s.startPoint || !s.lastPoint) {
                return { visible: false, x: 0, y: 0, w: 0, h: 0 };
            }
            const left = Math.min(s.startPoint.x, s.lastPoint.x) - stage.canvas.x;
            const top = Math.min(s.startPoint.y, s.lastPoint.y) - stage.canvas.y;
            const right = Math.max(s.startPoint.x, s.lastPoint.x) - stage.canvas.x;
            const bottom = Math.max(s.startPoint.y, s.lastPoint.y) - stage.canvas.y;
            const minX = Math.floor(left / stage.canvas.scale),
                  maxX = Math.floor((right - 1) / stage.canvas.scale);
            const minY = Math.floor(top / stage.canvas.scale),
                  maxY = Math.floor((bottom - 1) / stage.canvas.scale);
            const minx = clamp(minX, 0, stage.canvas.width - 1),
                  maxx = clamp(maxX, 0, stage.canvas.width - 1);
            const miny = clamp(minY, 0, stage.canvas.height - 1),
                  maxy = clamp(maxY, 0, stage.canvas.height - 1);
            return {
                visible: true,
                x: minx,
                y: miny,
                w: (maxx >= minx) ? (maxx - minx + 1) : 0,
                h: (maxy >= miny) ? (maxy - miny + 1) : 0,
            };
        },
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
