import { defineStore } from 'pinia';
import { useStageService } from './stage';
import { useOverlayService } from './overlay';
import { useStore } from '../stores';
import { useToolService } from './tool';
import { coordToKey } from '../utils';

export const usePixelService = defineStore('pixelService', () => {
    const stage = useStageService();
    const overlay = useOverlayService();
    const { layers, output } = useStore();
    let cutLayerId = null;

    function begin(event, status, tool) {
        if (event.button !== 0) return null;
        const coord = stage.clientToCoord(event);
        if (!coord) return null;

        output.setRollbackPoint();

        tool.pointer.status = status;
        try {
            event.target.setPointerCapture?.(event.pointerId);
            tool.pointer.id = event.pointerId;
        } catch {}

        if (tool.shape !== 'rect') {
            tool.visited.clear();
            tool.visited.add(coordToKey(coord));
        }
        return coord;
    }

    function startDraw(event) {
        const tool = useToolService();
        const coord = begin(event, 'draw', tool);
        if (!coord) return;
        if (tool.shape !== 'rect') {
            const pixels = tool.getPixelsFromInteraction(event);
            addPixelsToSelection(pixels);
        }
    }

    function moveDraw(event) {
        const tool = useToolService();
        if (tool.pointer.status !== 'draw' || tool.shape === 'rect') return;
        const coord = stage.clientToCoord(event);
        if (!coord) return;
        const k = coordToKey(coord);
        if (tool.visited.has(k)) return;
        tool.visited.add(k);
        addPixelsToSelection([coord]);
    }

    function finishDraw(event) {
        const tool = useToolService();
        if (tool.pointer.status !== 'draw') return;
        if (tool.shape === 'rect') {
            const pixels = tool.getPixelsFromInteraction(event);
            if (pixels.length > 0) addPixelsToSelection(pixels);
        }
        try {
            event.target?.releasePointerCapture?.(tool.pointer.id);
        } catch {}
        output.commit();
        reset();
    }

    function startErase(event) {
        const tool = useToolService();
        const coord = begin(event, 'erase', tool);
        if (!coord) return;
        if (tool.shape !== 'rect') {
            const pixels = tool.getPixelsFromInteraction(event);
            removePixelsFromSelection(pixels);
        }
    }

    function moveErase(event) {
        const tool = useToolService();
        if (tool.pointer.status !== 'erase' || tool.shape === 'rect') return;
        const coord = stage.clientToCoord(event);
        if (!coord) return;
        const k = coordToKey(coord);
        if (tool.visited.has(k)) return;
        tool.visited.add(k);
        removePixelsFromSelection([coord]);
    }

    function finishErase(event) {
        const tool = useToolService();
        if (tool.pointer.status !== 'erase') return;
        if (tool.shape === 'rect') {
            const pixels = tool.getPixelsFromInteraction(event);
            if (pixels.length > 0) removePixelsFromSelection(pixels);
        }
        try {
            event.target?.releasePointerCapture?.(tool.pointer.id);
        } catch {}
        output.commit();
        reset();
    }

    function startGlobalErase(event) {
        const tool = useToolService();
        const coord = begin(event, 'globalErase', tool);
        if (!coord) return;
        if (tool.shape !== 'rect') {
            const pixels = tool.getPixelsFromInteraction(event);
            if (layers.selectionExists) removePixelsFromSelected(pixels);
            else removePixelsFromAll(pixels);
        }
    }

    function moveGlobalErase(event) {
        const tool = useToolService();
        if (tool.pointer.status !== 'globalErase' || tool.shape === 'rect') return;
        const coord = stage.clientToCoord(event);
        if (!coord) return;
        const k = coordToKey(coord);
        if (tool.visited.has(k)) return;
        tool.visited.add(k);
        if (layers.selectionExists) removePixelsFromSelected([coord]);
        else removePixelsFromAll([coord]);
    }

    function finishGlobalErase(event) {
        const tool = useToolService();
        if (tool.pointer.status !== 'globalErase') return;
        if (tool.shape === 'rect') {
            const pixels = tool.getPixelsFromInteraction(event);
            if (pixels.length > 0) {
                if (layers.selectionExists) removePixelsFromSelected(pixels);
                else removePixelsFromAll(pixels);
            }
        }
        try {
            event.target?.releasePointerCapture?.(tool.pointer.id);
        } catch {}
        output.commit();
        reset();
    }

    function startCut(event) {
        const tool = useToolService();
        if (event.button !== 0) return;
        const coord = stage.clientToCoord(event);
        if (!coord) return;

        output.setRollbackPoint();

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

        tool.pointer.status = 'cut';
        try {
            event.target.setPointerCapture?.(event.pointerId);
            tool.pointer.id = event.pointerId;
        } catch {}

        if (tool.shape !== 'rect') {
            tool.visited.clear();
            tool.visited.add(coordToKey(coord));
            const pixels = tool.getPixelsFromInteraction(event);
            cutPixelsFromSelection(pixels);
        }
    }

    function moveCut(event) {
        const tool = useToolService();
        if (tool.pointer.status !== 'cut' || tool.shape === 'rect') return;
        const coord = stage.clientToCoord(event);
        if (!coord) return;
        const k = coordToKey(coord);
        if (tool.visited.has(k)) return;
        tool.visited.add(k);
        cutPixelsFromSelection([coord]);
    }

    function finishCut(event) {
        const tool = useToolService();
        if (tool.pointer.status !== 'cut') return;
        if (tool.shape === 'rect') {
            const pixels = tool.getPixelsFromInteraction(event);
            if (pixels.length > 0) cutPixelsFromSelection(pixels);
        }
        if (cutLayerId != null) {
            if (layers.getProperty(cutLayerId, 'pixels').length)
                layers.replaceSelection([cutLayerId]);
            else
                layers.deleteLayers([cutLayerId]);
        }
        try {
            event.target?.releasePointerCapture?.(tool.pointer.id);
        } catch {}
        output.commit();
        reset();
    }

    function cancel() {
        const tool = useToolService();
        if (tool.pointer.status === 'idle') return;
        output.rollbackPending();
        reset();
    }

    function reset() {
        const tool = useToolService();
        tool.pointer.status = 'idle';
        tool.pointer.id = null;
        tool.visited.clear();
        overlay.helper.clear();
        overlay.helper.mode = 'add';
        cutLayerId = null;
    }

    function addPixelsToSelection(pixels) {
        if (layers.selectionCount !== 1) return;
        const id = layers.selectedIds[0];
        if (layers.getProperty(id, 'locked')) return;
        layers.addPixels(id, pixels);
    }

    function removePixelsFromSelection(pixels) {
        if (layers.selectionCount !== 1) return;
        const id = layers.selectedIds[0];
        if (layers.getProperty(id, 'locked')) return;
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
        if (layers.getProperty(id, 'locked')) return;
        layers.togglePixel(id, coord);
    }

    function removePixelsFromSelected(pixels) {
        if (!pixels || !pixels.length) return;
        for (const id of layers.selectedIds) {
            const props = layers.getProperties(id);
            if (props.locked) continue;
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
            if (props.locked) continue;
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
