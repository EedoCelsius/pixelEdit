import { defineStore } from 'pinia';
import { useStageService } from './stage';
import { useOverlayService } from './overlay';
import { useStore } from '../stores';
import { coordToKey } from '../utils';

export const usePixelService = defineStore('pixelService', () => {
    const stage = useStageService();
    const overlay = useOverlayService();
    const { tool: toolStore, layers, output } = useStore();
    let cutLayerId = null;

    function toolStart(event) {
        if (event.button !== 0) return;
        const coord = stage.clientToCoord(event);
        if (!coord) return;

        output.setRollbackPoint();

        if (toolStore.expected === 'cut') {
            if (layers.selectionCount !== 1) return;
            const sourceId = layers.selectedIds[0];
            const sourceProps = layers.getProperties(sourceId);
            cutLayerId = layers.createLayer({
                name: `Cut of ${sourceProps.name}`,
                color: sourceProps.color,
                visible: sourceProps.visible,
            }, sourceId);
            overlay.add(cutLayerId);
        }

        toolStore.pointer.status = toolStore.expected;
        toolStore.pointer.start = { x: event.clientX, y: event.clientY };

        try {
            event.target.setPointerCapture?.(event.pointerId);
            toolStore.pointer.id = event.pointerId;
        } catch {}

        if (toolStore.shape === 'rect') {
            // no additional pointer state needed for rectangle interactions
        } else {
            toolStore.visited.clear();
            toolStore.visited.add(coordToKey(coord));
            const pixels = stage.getPixelsFromInteraction(event);

            if (toolStore.isGlobalErase) {
                if (layers.selectionExists) removePixelsFromSelected(pixels);
                else removePixelsFromAll(pixels);
            } else if (toolStore.isDraw || toolStore.isErase || toolStore.isCut) {
                if (toolStore.isErase) removePixelsFromSelection(pixels);
                else if (toolStore.isCut) cutPixelsFromSelection(pixels);
                else addPixelsToSelection(pixels);
            }
        }
    }

    function toolMove(event) {
        if (toolStore.pointer.status === 'idle') return;

        if (toolStore.shape === 'rect') {
            // rectangle interactions handled in stage component
        } else {
            const coord = stage.clientToCoord(event);
            if (!coord) {
                return;
            }
            const k = coordToKey(coord);
            if (toolStore.visited.has(k)) {
                return;
            }
            toolStore.visited.add(k);
            const delta = [coord];
            if (toolStore.isGlobalErase) {
                if (layers.selectionExists) removePixelsFromSelected(delta);
                else removePixelsFromAll(delta);
            } else if (toolStore.isDraw || toolStore.isErase || toolStore.isCut) {
                if (toolStore.isErase) removePixelsFromSelection(delta);
                else if (toolStore.isCut) cutPixelsFromSelection(delta);
                else addPixelsToSelection(delta);
            }
        }
    }

    function toolFinish(event) {
        if (toolStore.pointer.status === 'idle') return;

        if (toolStore.shape === 'rect') {
            const pixels = stage.getPixelsFromInteraction(event);
            if (pixels.length > 0) {
                if (toolStore.isGlobalErase) {
                    if (layers.selectionExists) removePixelsFromSelected(pixels);
                    else removePixelsFromAll(pixels);
                } else if (toolStore.isDraw || toolStore.isErase || toolStore.isCut) {
                    if (toolStore.isErase) removePixelsFromSelection(pixels);
                    else if (toolStore.isCut) cutPixelsFromSelection(pixels);
                    else addPixelsToSelection(pixels);
                }
            }
        }

        if (toolStore.isCut && cutLayerId != null) {
            if (layers.getProperty(cutLayerId, 'pixels').length)
                layers.replaceSelection([cutLayerId]);
            else
                layers.deleteLayers([cutLayerId]);
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
        toolStore.visited.clear();
        overlay.clear();
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
