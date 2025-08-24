import { defineStore } from 'pinia';
import { useStageService } from './stage';
import { useToolStore } from '../stores/tool';
import { useLayerStore } from '../stores/layers';
import { useLayerService } from './layers';
import { useLayerPanelStore } from '../stores/layerPanel';
import { useOutputStore } from '../stores/output';
import { coordsToKey } from '../utils';

export const usePixelService = defineStore('pixelService', () => {
    const stage = useStageService();
    const toolStore = useToolStore();
    const layers = useLayerStore();
    const layerSvc = useLayerService();
    const layerPanel = useLayerPanelStore();
    const output = useOutputStore();
    let cutLayerId = null;

    function toolStart(event) {
        if (event.button !== 0) return;
        const pixel = stage.clientToPixel(event);
        if (!pixel) return;

        output.setRollbackPoint();

        if (toolStore.expected === 'cut') {
            if (layers.selectionCount !== 1) return;
            const sourceId = layers.selectedIds[0];
            const srcLayer = layers.getLayer(sourceId);
            if (!srcLayer) return;
            cutLayerId = layers.createLayer({
                name: `Cut of ${layers.nameOf(sourceId)}`,
                colorU32: srcLayer.getColorU32(),
                visible: srcLayer.visible,
            }, sourceId);
            toolStore.selectOverlayLayerIds.add(cutLayerId);
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
            toolStore.visited.add(coordsToKey(pixel.x, pixel.y));

            if (toolStore.isGlobalErase) {
                if (layers.selectionExists) removePixelsFromSelected([[pixel.x, pixel.y]]);
                else removePixelsFromAll([[pixel.x, pixel.y]]);
            } else if (toolStore.isDraw || toolStore.isErase || toolStore.isCut) {
                if (toolStore.isErase) removePixelsFromSelection([[pixel.x, pixel.y]]);
                else if (toolStore.isCut) cutPixelsFromSelection([[pixel.x, pixel.y]]);
                else addPixelsToSelection([[pixel.x, pixel.y]]);
            }
        }
    }

    function toolMove(event) {
        if (toolStore.pointer.status === 'idle') return;

        if (toolStore.shape === 'rect') {
            // rectangle interactions handled in stage component
        } else {
            const pixel = stage.clientToPixel(event);
            if (!pixel) {
                return;
            }
            const k = coordsToKey(pixel.x, pixel.y);
            if (toolStore.visited.has(k)) {
                return;
            }
            toolStore.visited.add(k);
            const delta = [[pixel.x, pixel.y]];
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
            if (layers.pixelCountOf(cutLayerId))
                layerPanel.setRange(cutLayerId, cutLayerId);
            else
                layers.deleteLayers([cutLayerId])
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
        toolStore.selectOverlayLayerIds.clear();
        cutLayerId = null;
    }

    function addPixelsToSelection(pixels) {
        if (layers.selectionCount !== 1) return;
        const id = layers.selectedIds[0];
        if (layers.lockedOf(id)) return;
        layers.addPixels(id, pixels);
    }

    function removePixelsFromSelection(pixels) {
        if (layers.selectionCount !== 1) return;
        const id = layers.selectedIds[0];
        if (layers.lockedOf(id)) return;
        layers.removePixels(id, pixels);
    }

    function cutPixelsFromSelection(pixels) {
        if (layers.selectionCount !== 1 || cutLayerId == null) return;
        const sourceId = layers.selectedIds[0];
        const srcLayer = layers.getLayer(sourceId);
        if (!srcLayer) return;
        const pixelsToMove = [];
        for (const [x, y] of pixels) {
            if (srcLayer.has(x, y)) pixelsToMove.push([x, y]);
        }
        if (!pixelsToMove.length) return;
        layers.removePixels(sourceId, pixelsToMove);
        layers.addPixels(cutLayerId, pixelsToMove);
    }

    function togglePointInSelection(x, y) {
        if (layers.selectionCount !== 1) return;
        const id = layers.selectedIds[0];
        if (layers.lockedOf(id)) return;
        layers.togglePixel(id, x, y);
    }

    function removePixelsFromSelected(pixels) {
        if (!pixels || !pixels.length) return;
        layerSvc.forEachSelected((layer, id) => {
            if (layer.locked) return;
            const pixelsToRemove = [];
            for (const [x, y] of pixels) {
                if (layer.has(x, y)) pixelsToRemove.push([x, y]);
            }
            if (pixelsToRemove.length) layers.removePixels(id, pixelsToRemove);
        });
    }

    function removePixelsFromAll(pixels) {
        if (!pixels || !pixels.length) return;
        for (const id of layers.order) {
            const layer = layers.getLayer(id);
            if (!layer || layer.locked) continue;
            const pixelsToRemove = [];
            for (const [x, y] of pixels) {
                if (layer.has(x, y)) pixelsToRemove.push([x, y]);
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
