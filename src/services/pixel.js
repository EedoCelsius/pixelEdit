import { defineStore } from 'pinia';
import { useStageService } from './stage';
import { useToolStore } from '../stores/tool';
import { useSelectionStore } from '../stores/selection';
import { useLayerStore } from '../stores/layers';
import { useOutputStore } from '../stores/output';
import { coordsToKey, clamp } from '../utils';
import { useStageStore } from '../stores/stage';

export const usePixelService = defineStore('pixelService', () => {
    const stage = useStageService();
    const toolStore = useToolStore();
    const selection = useSelectionStore();
    const layers = useLayerStore();
    const output = useOutputStore();
    const stageStore = useStageStore();

    function toolStart(event) {
        if (event.button !== 0) return;
        const pixel = stage.clientToPixel(event);
        if (!pixel) return;

        output.setRollbackPoint();

        toolStore.state.status = toolStore.toolShape;
        toolStore.state.startPoint = { x: event.clientX, y: event.clientY };
        toolStore.state.isDragging = false;

        try {
            event.target.setPointerCapture?.(event.pointerId);
            toolStore.state.pointerId = event.pointerId;
        } catch {}

        if (toolStore.state.status === 'rect') {
            toolStore.marquee.x = pixel.x;
            toolStore.marquee.y = pixel.y;
            toolStore.marquee.w = 0;
            toolStore.marquee.h = 0;
            toolStore.marquee.visible = true;
        } else if (toolStore.state.status === 'stroke') {
            toolStore.lastPoint = pixel;
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

        if (!toolStore.state.isDragging && toolStore.state.startPoint) {
            const dx = Math.abs(event.clientX - toolStore.state.startPoint.x);
            const dy = Math.abs(event.clientY - toolStore.state.startPoint.y);
            if (dx > 4 || dy > 4) toolStore.state.isDragging = true;
        }
        if (!toolStore.state.isDragging) return;

        if (toolStore.state.status === 'rect') {
            const left = Math.min(toolStore.state.startPoint.x, event.clientX) - stageStore.canvas.x;
            const top = Math.min(toolStore.state.startPoint.y, event.clientY) - stageStore.canvas.y;
            const right = Math.max(toolStore.state.startPoint.x, event.clientX) - stageStore.canvas.x;
            const bottom = Math.max(toolStore.state.startPoint.y, event.clientY) - stageStore.canvas.y;
            const minX = Math.floor(left / stageStore.canvas.scale),
                  maxX = Math.floor((right - 1) / stageStore.canvas.scale);
            const minY = Math.floor(top / stageStore.canvas.scale),
                  maxY = Math.floor((bottom - 1) / stageStore.canvas.scale);
            const minx = clamp(minX, 0, stageStore.canvas.width - 1),
                  maxx = clamp(maxX, 0, stageStore.canvas.width - 1);
            const miny = clamp(minY, 0, stageStore.canvas.height - 1),
                  maxy = clamp(maxY, 0, stageStore.canvas.height - 1);
            toolStore.marquee.x = minx;
            toolStore.marquee.y = miny;
            toolStore.marquee.w = (maxx >= minx) ? (maxx - minx + 1) : 0;
            toolStore.marquee.h = (maxy >= miny) ? (maxy - miny + 1) : 0;
        } else if (toolStore.state.status === 'stroke') {
            const pixel = stage.clientToPixel(event);
            if (!pixel || !toolStore.lastPoint) {
                toolStore.lastPoint = pixel;
                return;
            }
            const line = stage.bresenhamLine(toolStore.lastPoint.x, toolStore.lastPoint.y, pixel.x, pixel.y);
            const delta = [];
            for (const [x, y] of line) {
                const k = coordsToKey(x, y);
                if (!toolStore.visited.has(k)) {
                    toolStore.visited.add(k);
                    delta.push([x, y]);
                }
            }
            if (delta.length) {
                if (toolStore.isGlobalErase) {
                    if (selection.exists) removePixelsFromSelected(delta);
                    else removePixelsFromAll(delta);
                } else if (toolStore.isDraw || toolStore.isErase) {
                    if (toolStore.isErase) removePixelsFromSelection(delta);
                    else addPixelsToSelection(delta);
                }
            }
            toolStore.lastPoint = pixel;
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
        toolStore.state.isDragging = false;
        toolStore.state.selectionMode = null;
        toolStore.marquee.visible = false;
        toolStore.lastPoint = null;
        toolStore.visited.clear();
        toolStore.addOverlayLayerIds.clear();
        toolStore.removeOverlayLayerIds.clear();
        toolStore.initialSelectionOnDrag.clear();
    }

    function forEachSelected(fn) {
        for (const id of selection.asArray) {
            const layer = layers.layersById[id];
            if (layer) fn(layer, id);
        }
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
        forEachSelected(layer => {
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
