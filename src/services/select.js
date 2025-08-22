import { defineStore } from 'pinia';
import { useStageService } from './stage';
import { useToolStore } from '../stores/tool';
import { useSelectionStore } from '../stores/selection';
import { useLayerService } from './layers';
import { useOutputStore } from '../stores/output';
import { coordsToKey } from '../utils';

export const useSelectService = defineStore('selectService', () => {
    const stage = useStageService();
    const toolStore = useToolStore();
    const selection = useSelectionStore();
    const layerSvc = useLayerService();
    const output = useOutputStore();

    function toolStart(event) {
        if (event.button !== 0) return;
        const pixel = stage.clientToPixel(event);
        if (!pixel) return;

        const startId = layerSvc.topVisibleLayerIdAt(pixel.x, pixel.y);
        toolStore.selectionBeforeDrag = new Set(selection.asArray);
        toolStore.state.selectionMode = (event.shiftKey && selection.has(startId)) ? 'remove' : 'add';

        output.setRollbackPoint();

        toolStore.state.status = toolStore.toolShape;
        toolStore.state.startPoint = { x: event.clientX, y: event.clientY };

        try {
            event.target.setPointerCapture?.(event.pointerId);
            toolStore.state.pointerId = event.pointerId;
        } catch {}

        if (toolStore.state.status === 'rect') {
            toolStore.state.lastPoint = { x: event.clientX, y: event.clientY };
        } else if (toolStore.state.status === 'stroke') {
            toolStore.state.lastPoint = pixel;
            toolStore.visited.clear();
            toolStore.visited.add(coordsToKey(pixel.x, pixel.y));

            const id = layerSvc.topVisibleLayerIdAt(pixel.x, pixel.y);
            if (id !== null) {
                if (toolStore.state.selectionMode === 'add') {
                    if (!toolStore.selectionBeforeDrag.has(id)) toolStore.selectOverlayLayerIds.add(id);
                } else {
                    if (toolStore.selectionBeforeDrag.has(id)) toolStore.selectOverlayLayerIds.add(id);
                }
            }
        }
    }

    function toolMove(event) {
        if (toolStore.state.status === 'idle') return;

        if (toolStore.state.status === 'rect') {
            toolStore.state.lastPoint = { x: event.clientX, y: event.clientY };
            const { x, y, w, h } = toolStore.marquee;
            const intersectedIds = new Set();
            for (let yy = y; yy < y + h; yy++) {
                for (let xx = x; xx < x + w; xx++) {
                    const id = layerSvc.topVisibleLayerIdAt(xx, yy);
                    if (id !== null) intersectedIds.add(id);
                }
            }
            toolStore.selectOverlayLayerIds.clear();
            if (toolStore.state.selectionMode === 'add') {
                for (const id of intersectedIds) {
                    if (!toolStore.selectionBeforeDrag.has(id)) toolStore.selectOverlayLayerIds.add(id);
                }
            } else {
                for (const id of intersectedIds) {
                    if (toolStore.selectionBeforeDrag.has(id)) toolStore.selectOverlayLayerIds.add(id);
                }
            }
        } else if (toolStore.state.status === 'stroke') {
            const pixel = stage.clientToPixel(event);
            if (!pixel) {
                toolStore.state.lastPoint = pixel;
                return;
            }
            const k = coordsToKey(pixel.x, pixel.y);
            if (toolStore.visited.has(k)) {
                toolStore.state.lastPoint = pixel;
                return;
            }
            toolStore.visited.add(k);
            const id = layerSvc.topVisibleLayerIdAt(pixel.x, pixel.y);
            if (id !== null) {
                if (toolStore.state.selectionMode === 'add') {
                    if (!toolStore.selectionBeforeDrag.has(id)) toolStore.selectOverlayLayerIds.add(id);
                } else {
                    if (toolStore.selectionBeforeDrag.has(id)) toolStore.selectOverlayLayerIds.add(id);
                }
            }
            toolStore.state.lastPoint = pixel;
        }
    }

    function toolFinish(event) {
        if (toolStore.state.status === 'idle') return;

        const pixel = stage.clientToPixel(event);
        const start = toolStore.state.startPoint;
        const dx = start ? Math.abs(event.clientX - start.x) : 0;
        const dy = start ? Math.abs(event.clientY - start.y) : 0;
        const isClick = dx <= 4 && dy <= 4;
        if (isClick && pixel) {
            const id = layerSvc.topVisibleLayerIdAt(pixel.x, pixel.y);
            if (event.shiftKey) {
                selection.toggle(id);
            } else {
                selection.selectOnly(id);
            }
            if (id !== null) {
                selection.setScrollRule({ type: 'follow', target: id });
            }
        } else {
            const pixels = stage.getPixelsFromInteraction(event);
            if (pixels.length > 0) {
                const intersectedIds = new Set();
                for (const [x, y] of pixels) {
                    const id = layerSvc.topVisibleLayerIdAt(x, y);
                    if (id !== null) intersectedIds.add(id);
                }
                const currentSelection = new Set(selection.asArray);
                if (toolStore.state.selectionMode === 'add') {
                    intersectedIds.forEach(id => currentSelection.add(id));
                } else {
                    intersectedIds.forEach(id => currentSelection.delete(id));
                }
                if (event.shiftKey) {
                    selection.set([...currentSelection], selection.anchorId, selection.tailId);
                } else {
                    selection.set([...currentSelection], null, null);
                }
            } else if (!event.shiftKey) {
                selection.clear();
            }
        }

        try {
            event.target?.releasePointerCapture?.(toolStore.state.pointerId);
        } catch {}

        output.commit();
        reset();
    }

    function cancel() {
        if (toolStore.state.status === 'idle') return;
        output.rollbackPending();
        reset();
    }

    function reset() {
        toolStore.state.status = 'idle';
        toolStore.state.pointerId = null;
        toolStore.state.startPoint = null;
        toolStore.state.lastPoint = null;
        toolStore.state.selectionMode = null;
        toolStore.visited.clear();
        toolStore.hoverLayerId = null;
        toolStore.selectOverlayLayerIds.clear();
        toolStore.selectionBeforeDrag.clear();
    }

    function selectRange(anchorId, tailId) {
        const anchorIndex = layerSvc.idsTopToBottom.indexOf(anchorId);
        const tailIndex = layerSvc.idsTopToBottom.indexOf(tailId);
        const slice = layerSvc.idsTopToBottom.slice(
            Math.min(anchorIndex, tailIndex),
            Math.max(anchorIndex, tailIndex) + 1
        );
        selection.set(slice, anchorId, tailId);
    }

    return { toolStart, toolMove, toolFinish, cancel, selectRange };
});
