import { defineStore } from 'pinia';
import { useStageService } from './stage';
import { useOverlayService } from './overlay';
import { useStore } from '../stores';
import { useStageToolService } from './stageTool';
import { coordToKey } from '../utils';

export const usePixelService = defineStore('pixelService', () => {
    const stage = useStageService();
    const overlay = useOverlayService();
    const { layers, viewportEvent: viewportEvents } = useStore();
    let cutLayerId = null;

    function startDraw() {
        const tool = useStageToolService();
        if (tool.shape !== 'rect') {
            if (!viewportEvents.isDragging(tool.pointer.id)) return;
            const event = viewportEvents.getEvent('pointerdown', tool.pointer.id);
            if (!event) return;
            const pixels = tool.getPixelsFromInteraction('down');
            addPixelsToSelection(pixels);
        }
    }

    function moveDraw() {
        const tool = useStageToolService();
        if (tool.pointer.status !== 'draw' || tool.shape === 'rect' || !viewportEvents.isDragging(tool.pointer.id)) return;
        const event = viewportEvents.getEvent('pointermove', tool.pointer.id);
        const coord = stage.clientToCoord(event);
        if (!coord) return;
        addPixelsToSelection([coord]);
    }

    function finishDraw() {
        const tool = useStageToolService();
        if (tool.pointer.status !== 'draw') return;
        if (tool.shape === 'rect') {
            const event = viewportEvents.getEvent('pointerup', tool.pointer.id);
            if (!event) return;
            const pixels = tool.getPixelsFromInteraction('up');
            if (pixels.length > 0) addPixelsToSelection(pixels);
        }
    }

    function startErase() {
        const tool = useStageToolService();
        if (tool.shape !== 'rect') {
            if (!viewportEvents.isDragging(tool.pointer.id)) return;
            const event = viewportEvents.getEvent('pointerdown', tool.pointer.id);
            if (!event) return;
            const pixels = tool.getPixelsFromInteraction('down');
            removePixelsFromSelection(pixels);
        }
    }

    function moveErase() {
        const tool = useStageToolService();
        if (tool.pointer.status !== 'erase' || tool.shape === 'rect' || !viewportEvents.isDragging(tool.pointer.id)) return;
        const event = viewportEvents.getEvent('pointermove', tool.pointer.id);
        const coord = stage.clientToCoord(event);
        if (!coord) return;
        removePixelsFromSelection([coord]);
    }

    function finishErase() {
        const tool = useStageToolService();
        if (tool.pointer.status !== 'erase') return;
        if (tool.shape === 'rect') {
            const event = viewportEvents.getEvent('pointerup', tool.pointer.id);
            if (!event) return;
            const pixels = tool.getPixelsFromInteraction('up');
            if (pixels.length > 0) removePixelsFromSelection(pixels);
        }
    }

    function startGlobalErase() {
        const tool = useStageToolService();
        if (tool.shape !== 'rect') {
            if (!viewportEvents.isDragging(tool.pointer.id)) return;
            const event = viewportEvents.getEvent('pointerdown', tool.pointer.id);
            if (!event) return;
            const pixels = tool.getPixelsFromInteraction('down');
            if (layers.selectionExists) removePixelsFromSelected(pixels);
            else removePixelsFromAll(pixels);
        }
    }

    function moveGlobalErase() {
        const tool = useStageToolService();
        if (tool.pointer.status !== 'globalErase' || tool.shape === 'rect' || !viewportEvents.isDragging(tool.pointer.id)) return;
        const event = viewportEvents.getEvent('pointermove', tool.pointer.id);
        const coord = stage.clientToCoord(event);
        if (!coord) return;
        if (layers.selectionExists) removePixelsFromSelected([coord]);
        else removePixelsFromAll([coord]);
    }

    function finishGlobalErase() {
        const tool = useStageToolService();
        if (tool.pointer.status !== 'globalErase') return;
        if (tool.shape === 'rect') {
            const event = viewportEvents.getEvent('pointerup', tool.pointer.id);
            if (!event) return;
            const pixels = tool.getPixelsFromInteraction('up');
            if (pixels.length > 0) {
                if (layers.selectionExists) removePixelsFromSelected(pixels);
                else removePixelsFromAll(pixels);
            }
        }
    }

    function startCut() {
        const tool = useStageToolService();
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

        if (tool.shape !== 'rect') {
            if (!viewportEvents.isDragging(tool.pointer.id)) return;
            const event = viewportEvents.getEvent('pointerdown', tool.pointer.id);
            if (!event) return;
            const pixels = tool.getPixelsFromInteraction('down');
            cutPixelsFromSelection(pixels);
        }
    }

    function moveCut() {
        const tool = useStageToolService();
        if (tool.pointer.status !== 'cut' || tool.shape === 'rect' || !viewportEvents.isDragging(tool.pointer.id)) return;
        const event = viewportEvents.getEvent('pointermove', tool.pointer.id);
        const coord = stage.clientToCoord(event);
        if (!coord) return;
        cutPixelsFromSelection([coord]);
    }

    function finishCut() {
        const tool = useStageToolService();
        if (tool.pointer.status !== 'cut') return;
        if (tool.shape === 'rect') {
            const event = viewportEvents.getEvent('pointerup', tool.pointer.id);
            if (!event) return;
            const pixels = tool.getPixelsFromInteraction('up');
            if (pixels.length > 0) cutPixelsFromSelection(pixels);
        }
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
