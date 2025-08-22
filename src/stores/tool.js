import { defineStore } from 'pinia';
import { useStageStore } from './stage';
import { clamp } from '../utils';

export const useToolStore = defineStore('tool', {
    state: () => ({
        static: 'draw',
        shape: 'stroke',
        ctrlHeld: false,
        shiftHeld: false,
        // pointer interaction state
        pointer: {
            status: 'idle',
            start: null,
            id: null,
            current: null,
        },
        hoverLayerId: null,
        selectionBeforeDrag: new Set(),
        selectOverlayLayerIds: new Set(),
        visited: new Set(),
    }),
    getters: {
        expected() {
            if (this.pointer.status !== 'idle') {
                return this.pointer.status.split(':')[0];
            }
            let tool = this.static;
            if (this.shiftHeld) {
                tool = 'select';
            } else if (this.ctrlHeld) {
                if (tool === 'draw') tool = 'erase';
                else if (tool === 'erase') tool = 'draw';
                else if (tool === 'select') tool = 'globalErase';
                else if (tool === 'globalErase') tool = 'select';
            }
            return tool;
        },
        isDraw() { return this.expected === 'draw'; },
        isErase() { return this.expected === 'erase'; },
        isSelect() { return this.expected === 'select'; },
        isGlobalErase() { return this.expected === 'globalErase'; },
        isStroke: (state) => state.shape === 'stroke',
        isRect: (state) => state.shape === 'rect',
        marquee() {
            const stage = useStageStore();
            const s = this.pointer;
            if (this.shape !== 'rect' || !s.start || !s.current) {
                return { visible: false, x: 0, y: 0, w: 0, h: 0 };
            }
            const left = Math.min(s.start.x, s.current.x) - stage.canvas.x;
            const top = Math.min(s.start.y, s.current.y) - stage.canvas.y;
            const right = Math.max(s.start.x, s.current.x) - stage.canvas.x;
            const bottom = Math.max(s.start.y, s.current.y) - stage.canvas.y;
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
        setStatic(newTool) {
            this.static = newTool;
        },
        setShape(shape) {
            this.shape = shape === 'rect' ? 'rect' : 'stroke';
        },
        setCtrlHeld(isHeld) {
            this.ctrlHeld = !!isHeld;
        },
        setShiftHeld(isHeld) {
            this.shiftHeld = !!isHeld;
        },
    }
});
