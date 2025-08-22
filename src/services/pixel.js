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

            if (toolStore.isGlobalErase) {
                if (selection.exists) removePixelsFromSelected([[pixel.x, pixel.y]]);
                else removePixelsFromAll([[pixel.x, pixel.y]]);
            } else if (toolStore.isDraw || toolStore.isErase) {
                if (toolStore.isErase) removePixelsFromSelection([[pixel.x, pixel.y]]);
                else addPixelsToSelection([[pixel.x, pixel.y]]);
            }
        }
    }

    function toolMove(event) {
        if (toolStore.state.status === 'idle') return;

        if (toolStore.state.status === 'rect') {
            toolStore.state.lastPoint = { x: event.clientX, y: event.clientY };
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
            const delta = [[pixel.x, pixel.y]];
            if (toolStore.isGlobalErase) {
                if (selection.exists) removePixelsFromSelected(delta);
                else removePixelsFromAll(delta);
            } else if (toolStore.isDraw || toolStore.isErase) {
                if (toolStore.isErase) removePixelsFromSelection(delta);
                else addPixelsToSelection(delta);
            }
            toolStore.state.lastPoint = pixel;
        }
    }

    function toolFinish(event) {
        if (toolStore.state.status === 'idle') return;

        if (toolStore.state.status === 'rect') {
            const pixels = stage.getPixelsFromInteraction(event);
            if (pixels.length > 0) {
                if (toolStore.isGlobalErase) {
                    if (selection.exists) removePixelsFromSelected(pixels);
                    else removePixelsFromAll(pixels);
                } else if (toolStore.isDraw || toolStore.isErase) {
                    if (toolStore.isErase) removePixelsFromSelection(pixels);
                    else addPixelsToSelection(pixels);
                }
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
        toolStore.selectOverlayLayerIds.clear();
        toolStore.selectionBeforeDrag.clear();
    }

    function addPixelsToSelection(pixels) {
        if (selection.size !== 1) return;
        const id = selection.asArray[0];
        const layer = layers.layersById[id];
        if (layer) layer.addPixels(pixels);
    }

    function removePixelsFromSelection(pixels) {
        if (selection.size !== 1) return;
        const id = selection.asArray[0];
        const layer = layers.layersById[id];
        if (layer) layer.removePixels(pixels);
    }

    function togglePointInSelection(x, y) {
        if (selection.size !== 1) return;
        const id = selection.asArray[0];
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
