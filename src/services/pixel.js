import { defineStore } from 'pinia';
import { useStore } from '../stores';
import { useStageToolService } from './stageTool';
import { coordToKey } from '../utils';

export const usePixelService = defineStore('pixelService', () => {
    const { layers } = useStore();
    let cutLayerId = null;

    function startDraw() {}

    function moveDraw() {}

    function finishDraw() {
        const tool = useStageToolService();
        if (tool.pointer.status !== 'draw') return;
        const pixels = tool.affectedPixels;
        if (pixels.length > 0) addPixelsToSelection(pixels);
    }

    function startErase() {}

    function moveErase() {}

    function finishErase() {
        const tool = useStageToolService();
        if (tool.pointer.status !== 'erase') return;
        const pixels = tool.affectedPixels;
        if (pixels.length > 0) removePixelsFromSelection(pixels);
    }

    function startGlobalErase() {}

    function moveGlobalErase() {}

    function finishGlobalErase() {
        const tool = useStageToolService();
        if (tool.pointer.status !== 'globalErase') return;
        const pixels = tool.affectedPixels;
        if (pixels.length > 0) {
            if (layers.selectionExists) removePixelsFromSelected(pixels);
            else removePixelsFromAll(pixels);
        }
    }

    function startCut() {
        if (layers.selectionCount !== 1) return;
        const sourceId = layers.selectedIds[0];
        const sourceProps = layers.getProperties(sourceId);
        cutLayerId = layers.createLayer({
            name: `Cut of ${sourceProps.name}`,
            color: sourceProps.color,
            visible: sourceProps.visible,
        }, sourceId);
    }

    function moveCut() {}

    function finishCut() {
        const tool = useStageToolService();
        if (tool.pointer.status !== 'cut') return;
        const pixels = tool.affectedPixels;
        if (pixels.length > 0) cutPixelsFromSelection(pixels);
        if (cutLayerId != null) {
            if (layers.getProperty(cutLayerId, 'pixels').length)
                layers.replaceSelection([cutLayerId]);
            else
                layers.deleteLayers([cutLayerId]);
        }
        cutLayerId = null;
    }

    function cancel() {
        cutLayerId = null;
    }

    function addPixelsToSelection(pixels) {
        if (layers.selectionCount !== 1) return;
        const id = layers.selectedIds[0];
        layers.addPixels(id, pixels);
    }

    function removePixelsFromSelection(pixels) {
        if (layers.selectionCount !== 1) return;
        const id = layers.selectedIds[0];
        layers.removePixels(id, pixels);
    }

    function cutPixelsFromSelection(pixels) {
        if (layers.selectionCount !== 1 || cutLayerId == null) return;
        const sourceId = layers.selectedIds[0];
        const coords = layers.getProperty(sourceId, 'pixels');
        const set = new Set(coords.map(coordToKey));
        const pixelsToMove = [];
        for (const coord of pixels) {
            if (set.has(coordToKey(coord))) pixelsToMove.push(coord);
        }
        if (!pixelsToMove.length) return;
        layers.removePixels(sourceId, pixelsToMove);
        layers.addPixels(cutLayerId, pixelsToMove);
    }

    function togglePointInSelection(coord) {
        if (layers.selectionCount !== 1) return;
        const id = layers.selectedIds[0];
        layers.togglePixel(id, coord);
    }

    function removePixelsFromSelected(pixels) {
        if (!pixels || !pixels.length) return;
        for (const id of layers.selectedIds) {
            const props = layers.getProperties(id);
            const coords = props.pixels;
            const set = new Set(coords.map(coordToKey));
            const pixelsToRemove = [];
            for (const coord of pixels) {
                if (set.has(coordToKey(coord))) pixelsToRemove.push(coord);
            }
            if (pixelsToRemove.length) layers.removePixels(id, pixelsToRemove);
        }
    }

    function removePixelsFromAll(pixels) {
        if (!pixels || !pixels.length) return;
        for (const id of layers.order) {
            const props = layers.getProperties(id);
            const coords = props.pixels;
            const set = new Set(coords.map(coordToKey));
            const pixelsToRemove = [];
            for (const coord of pixels) {
                if (set.has(coordToKey(coord))) pixelsToRemove.push(coord);
            }
            if (pixelsToRemove.length) layers.removePixels(id, pixelsToRemove);
        }
    }

    const tools = {
        draw: { start: startDraw, move: moveDraw, finish: finishDraw },
        erase: { start: startErase, move: moveErase, finish: finishErase },
        globalErase: { start: startGlobalErase, move: moveGlobalErase, finish: finishGlobalErase },
        cut: { start: startCut, move: moveCut, finish: finishCut }
    };

    return {
        tools,
        cancel,
        addPixelsToSelection,
        removePixelsFromSelection,
        togglePointInSelection,
        removePixelsFromSelected,
        removePixelsFromAll
    };
});
