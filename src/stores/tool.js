import { defineStore } from 'pinia';

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
        },
        hoverLayerId: null,
        selectOverlayLayerIds: new Set(),
        visited: new Set(),
    }),
    getters: {
        expected() {
            if (this.pointer.status !== 'idle') {
                const status = this.pointer.status;
                return (status === 'select' || status === 'add' || status === 'remove')
                    ? 'select'
                    : status;
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
