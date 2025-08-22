import { defineStore } from 'pinia';
import { useSelectionStore } from './selection';

export const useStageStore = defineStore('stage', {
    state: () => ({
        canvas: {
            x: 0,
            y: 0,
            width: 16,
            height: 16,
            scale: 16,
        },
        display: 'result', // 'result' | 'original'
        imageSrc: '',
        pixelInfo: '-',
        tool: 'draw', // 'draw'|'erase'|'select'|'globalErase'
        toolShape: 'stroke', // 'stroke' | 'rect'
        ctrlHeld: false,
        shiftHeld: false,
    }),
    getters: {
        // Canvas dimensions
        pixelWidth: (state) => state.canvas.width * state.canvas.scale,
        pixelHeight: (state) => state.canvas.height * state.canvas.scale,
        viewBox: (state) => `0 0 ${state.canvas.width} ${state.canvas.height}`,
        // UI labels
        toggleLabel: (state) => state.display === 'original' ? '결과' : '원본',
        // Tool state
        isStroke: (state) => state.toolShape === 'stroke',
        isRect: (state) => state.toolShape === 'rect',
        // Mode state
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
        // Effective tool state (considering modifiers)
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
    },
    actions: {
        setCanvasPosition(x, y) {
            this.canvas.x = x;
            this.canvas.y = y;
        },
        setSize(newWidth, newHeight) {
            this.canvas.width = Math.max(1, newWidth | 0);
            this.canvas.height = Math.max(1, newHeight | 0);
        },
        setImage(src) {
            this.imageSrc = src || '';
        },
        setScale(newScale) {
            this.canvas.scale = Math.max(1, newScale | 0);
        },
        toggleView() {
            this.display = (this.display === 'original') ? 'result' : 'original';
        },
        updatePixelInfo(text) {
            this.pixelInfo = text;
        },
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
