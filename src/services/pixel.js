import { defineStore } from 'pinia';
import { useOverlayService } from './overlay';
import { useStore } from '../stores';
import { useStageToolService } from './stageTool';
import { coordToKey } from '../utils';

export const usePixelService = defineStore('pixelService', () => {
    const overlay = useOverlayService();
    const { layers } = useStore();
    let cutLayerId = null;

    function startDraw() {
        const tool = useStageToolService();
        if (tool.pointer.status !== 'draw') return;
        if (tool.affectedPixels.length) addPixelsToSelection(tool.affectedPixels);
    }

    function moveDraw() {
        const tool = useStageToolService();
        if (tool.pointer.status !== 'draw' || !tool.affectedPixels.length) return;
        addPixelsToSelection(tool.affectedPixels);
    }

    function finishDraw() {
        const tool = useStageToolService();
        if (tool.pointer.status !== 'draw' || !tool.affectedPixels.length) return;
        addPixelsToSelection(tool.affectedPixels);
    }

    function startErase() {
        const tool = useStageToolService();
        if (tool.pointer.status !== 'erase') return;
        if (tool.affectedPixels.length) removePixelsFromSelection(tool.affectedPixels);
    }

    function moveErase() {
        const tool = useStageToolService();
        if (tool.pointer.status !== 'erase' || !tool.affectedPixels.length) return;
        removePixelsFromSelection(tool.affectedPixels);
    }

    function finishErase() {
        const tool = useStageToolService();
        if (tool.pointer.status !== 'erase' || !tool.affectedPixels.length) return;
        removePixelsFromSelection(tool.affectedPixels);
    }

    function startGlobalErase() {
        const tool = useStageToolService();
        if (tool.pointer.status !== 'globalErase') return;
        if (!tool.affectedPixels.length) return;
        if (layers.selectionExists) removePixelsFromSelected(tool.affectedPixels);
        else removePixelsFromAll(tool.affectedPixels);
    }

    function moveGlobalErase() {
        const tool = useStageToolService();
        if (tool.pointer.status !== 'globalErase' || !tool.affectedPixels.length) return;
        if (layers.selectionExists) removePixelsFromSelected(tool.affectedPixels);
        else removePixelsFromAll(tool.affectedPixels);
    }

    function finishGlobalErase() {
        const tool = useStageToolService();
        if (tool.pointer.status !== 'globalErase' || !tool.affectedPixels.length) return;
        if (layers.selectionExists) removePixelsFromSelected(tool.affectedPixels);
        else removePixelsFromAll(tool.affectedPixels);
    }

    function startCut() {
        const tool = useStageToolService();
        if (tool.pointer.status !== 'cut') return;
        if (layers.selectionCount !== 1) return;
        const sourceId = layers.selectedIds[0];
        const sourceProps = layers.getProperties(sourceId);
        cutLayerId = layers.createLayer({
            name: `Cut of ${sourceProps.name}`,
            color: sourceProps.color,
            visible: sourceProps.visible,
        }, sourceId);
        overlay.helper.clear();
        overlay.helper.add(cutLayerId);
        overlay.helper.mode = 'add';
        if (tool.affectedPixels.length) cutPixelsFromSelection(tool.affectedPixels);
    }

    function moveCut() {
        const tool = useStageToolService();
        if (tool.pointer.status !== 'cut' || !tool.affectedPixels.length) return;
        cutPixelsFromSelection(tool.affectedPixels);
    }

    function finishCut() {
        const tool = useStageToolService();
        if (tool.pointer.status !== 'cut') return;
        if (tool.affectedPixels.length) cutPixelsFromSelection(tool.affectedPixels);
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
        overlay.helper.clear();
        overlay.helper.add(cutLayerId);
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

