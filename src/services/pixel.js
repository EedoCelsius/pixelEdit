import { defineStore } from 'pinia';
import { useStageService } from './stage';
import { useToolStore } from '../stores/tool';
import { useSelectionStore } from '../stores/selection';
import { useLayerStore } from '../stores/layers';
import { useLayerService } from './layers';
import { useOutputStore } from '../stores/output';
import { coordsToKey } from '../utils';

export const usePixelService = defineStore('pixelService', () => {
    const stage = useStageService();
    const toolStore = useToolStore();
    const selection = useSelectionStore();
    const layers = useLayerStore();
    const layerSvc = useLayerService();
    const output = useOutputStore();

    function toolStart(event) {
        if (event.button !== 0) return;
        const pixel = stage.clientToPixel(event);
        if (!pixel) return;

        output.setRollbackPoint();

        toolStore.pointer.status = toolStore.expected;
        toolStore.pointer.start = { x: event.clientX, y: event.clientY };

        try {
            event.target.setPointerCapture?.(event.pointerId);
            toolStore.pointer.id = event.pointerId;
        } catch {}

        if (toolStore.shape === 'rect') {
            toolStore.pointer.current = { x: event.clientX, y: event.clientY };
        } else {
            toolStore.pointer.current = pixel;
            toolStore.visited.clear();
            toolStore.visited.add(coordsToKey(pixel.x, pixel.y));

            if (toolStore.isGlobalErase) {
                if (selection.hasSelection) removePixelsFromSelected([[pixel.x, pixel.y]]);
                else removePixelsFromAll([[pixel.x, pixel.y]]);
            } else if (toolStore.isDraw || toolStore.isErase) {
                if (toolStore.isErase) removePixelsFromSelection([[pixel.x, pixel.y]]);
                else addPixelsToSelection([[pixel.x, pixel.y]]);
            }
        }
    }

    function toolMove(event) {
        if (toolStore.pointer.status === 'idle') return;

        if (toolStore.shape === 'rect') {
            toolStore.pointer.current = { x: event.clientX, y: event.clientY };
        } else {
            const pixel = stage.clientToPixel(event);
            if (!pixel) {
                toolStore.pointer.current = pixel;
                return;
            }
            const k = coordsToKey(pixel.x, pixel.y);
            if (toolStore.visited.has(k)) {
                toolStore.pointer.current = pixel;
                return;
            }
            toolStore.visited.add(k);
            const delta = [[pixel.x, pixel.y]];
            if (toolStore.isGlobalErase) {
                if (selection.hasSelection) removePixelsFromSelected(delta);
                else removePixelsFromAll(delta);
            } else if (toolStore.isDraw || toolStore.isErase) {
                if (toolStore.isErase) removePixelsFromSelection(delta);
                else addPixelsToSelection(delta);
            }
            toolStore.pointer.current = pixel;
        }
    }

    function toolFinish(event) {
        if (toolStore.pointer.status === 'idle') return;

        if (toolStore.shape === 'rect') {
            const pixels = stage.getPixelsFromInteraction(event);
            if (pixels.length > 0) {
                if (toolStore.isGlobalErase) {
                    if (selection.hasSelection) removePixelsFromSelected(pixels);
                    else removePixelsFromAll(pixels);
                } else if (toolStore.isDraw || toolStore.isErase) {
                    if (toolStore.isErase) removePixelsFromSelection(pixels);
                    else addPixelsToSelection(pixels);
                }
            }
        }

        try {
            event.target?.releasePointerCapture?.(toolStore.pointer.id);
        } catch {}

        output.commit();
        reset();
    }

    function cancel() {
        if (toolStore.pointer.status === 'idle') return;
        output.rollbackPending();
        reset();
    }

    function reset() {
        toolStore.pointer.status = 'idle';
        toolStore.pointer.id = null;
        toolStore.pointer.start = null;
        toolStore.pointer.current = null;
        toolStore.visited.clear();
        toolStore.selectOverlayLayerIds.clear();
        toolStore.selectionBeforeDrag.clear();
    }

    function addPixelsToSelection(pixels) {
        if (selection.count !== 1) return;
        const id = selection.ids[0];
        const layer = layers.layersById[id];
        if (layer) layer.addPixels(pixels);
    }

    function removePixelsFromSelection(pixels) {
        if (selection.count !== 1) return;
        const id = selection.ids[0];
        const layer = layers.layersById[id];
        if (layer) layer.removePixels(pixels);
    }

    function togglePointInSelection(x, y) {
        if (selection.count !== 1) return;
        const id = selection.ids[0];
        const layer = layers.layersById[id];
        if (layer) layer.togglePixel(x, y);
    }

    function removePixelsFromSelected(pixels) {
        if (!pixels || !pixels.length) return;
        layerSvc.forEachSelected(layer => {
            const pixelsToRemove = [];
            for (const [x, y] of pixels) {
                if (layer.has(x, y)) pixelsToRemove.push([x, y]);
            }
            if (pixelsToRemove.length) layer.removePixels(pixelsToRemove);
        });
    }

    function removePixelsFromAll(pixels) {
        if (!pixels || !pixels.length) return;
        for (const id of layers.order) {
            const layer = layers.layersById[id];
            const pixelsToRemove = [];
            for (const [x, y] of pixels) {
                if (layer.has(x, y)) pixelsToRemove.push([x, y]);
            }
            if (pixelsToRemove.length) layer.removePixels(pixelsToRemove);
        }
    }

    return {
        toolStart,
        toolMove,
        toolFinish,
        cancel,
        addPixelsToSelection,
        removePixelsFromSelection,
        togglePointInSelection,
        removePixelsFromSelected,
        removePixelsFromAll
    };
});
