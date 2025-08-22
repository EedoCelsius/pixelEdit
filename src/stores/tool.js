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
        selectOverlaySize: (state) => state.selectOverlayLayerIds.size,
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
        setHoverLayer(id) {
            this.hoverLayerId = id;
        },
        beginPointer(status, start) {
            this.pointer.status = status;
            this.pointer.start = start;
            this.pointer.current = null;
            this.pointer.id = null;
        },
        setPointerId(id) {
            this.pointer.id = id;
        },
        setPointerCurrent(pos) {
            this.pointer.current = pos;
        },
        resetPointer() {
            this.pointer.status = 'idle';
            this.pointer.start = null;
            this.pointer.id = null;
            this.pointer.current = null;
        },
        addVisited(key) {
            this.visited.add(key);
        },
        hasVisited(key) {
            return this.visited.has(key);
        },
        clearVisited() {
            this.visited.clear();
        },
        forEachVisited(cb) {
            this.visited.forEach(cb);
        },
        setSelectionBeforeDrag(ids) {
            this.selectionBeforeDrag = new Set(ids);
        },
        hasSelectionBeforeDrag(id) {
            return this.selectionBeforeDrag.has(id);
        },
        clearSelectionBeforeDrag() {
            this.selectionBeforeDrag.clear();
        },
        addSelectOverlay(id) {
            this.selectOverlayLayerIds.add(id);
        },
        removeSelectOverlay(id) {
            this.selectOverlayLayerIds.delete(id);
        },
        clearSelectOverlay() {
            this.selectOverlayLayerIds.clear();
        },
        forEachSelectOverlay(cb) {
            this.selectOverlayLayerIds.forEach(cb);
        },
    }
});
