import { defineStore } from 'pinia';
import { useStageService } from './stage';
import { useToolStore } from '../stores/tool';
import { useSelectionStore } from '../stores/selection';
import { useLayerService } from './layers';
import { useOutputStore } from '../stores/output';
import { coordsToKey, clamp } from '../utils';
import { useStageStore } from '../stores/stage';

export const useSelectService = defineStore('selectService', () => {
    const stage = useStageService();
    const toolStore = useToolStore();
    const selection = useSelectionStore();
    const layerSvc = useLayerService();
    const output = useOutputStore();
    const stageStore = useStageStore();

    function toolStart(event) {
        if (event.button !== 0) return;
        const pixel = stage.clientToPixel(event);
        if (!pixel) return;

        const startId = layerSvc.topVisibleLayerIdAt(pixel.x, pixel.y);
        toolStore.initialSelectionOnDrag = new Set(selection.asArray);
        toolStore.state.selectionMode = (event.shiftKey && selection.has(startId)) ? 'remove' : 'add';

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

            const id = layerSvc.topVisibleLayerIdAt(pixel.x, pixel.y);
            if (id !== null) {
                if (toolStore.state.selectionMode === 'add') {
                    if (!toolStore.initialSelectionOnDrag.has(id)) toolStore.addOverlayLayerIds.add(id);
                } else {
                    if (toolStore.initialSelectionOnDrag.has(id)) toolStore.removeOverlayLayerIds.add(id);
                }
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

            const pixels = [];
            for (let yy = toolStore.marquee.y; yy < toolStore.marquee.y + toolStore.marquee.h; yy++) {
                for (let xx = toolStore.marquee.x; xx < toolStore.marquee.x + toolStore.marquee.w; xx++) {
                    pixels.push([xx, yy]);
                }
            }
            const intersectedIds = new Set();
            if (pixels.length > 0) {
                for (const [x, y] of pixels) {
                    const id = layerSvc.topVisibleLayerIdAt(x, y);
                    if (id !== null) intersectedIds.add(id);
                }
            }
            toolStore.addOverlayLayerIds.clear();
            toolStore.removeOverlayLayerIds.clear();
            if (toolStore.state.selectionMode === 'add') {
                for (const id of intersectedIds) {
                    if (!toolStore.initialSelectionOnDrag.has(id)) toolStore.addOverlayLayerIds.add(id);
                }
            } else {
                for (const id of intersectedIds) {
                    if (toolStore.initialSelectionOnDrag.has(id)) toolStore.removeOverlayLayerIds.add(id);
                }
            }
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
                const intersectedIds = new Set();
                for (const [x, y] of delta) {
                    const id = layerSvc.topVisibleLayerIdAt(x, y);
                    if (id !== null) intersectedIds.add(id);
                }
                if (toolStore.state.selectionMode === 'add') {
                    for (const id of intersectedIds) {
                        if (!toolStore.initialSelectionOnDrag.has(id)) toolStore.addOverlayLayerIds.add(id);
                    }
                } else {
                    for (const id of intersectedIds) {
                        if (toolStore.initialSelectionOnDrag.has(id)) toolStore.removeOverlayLayerIds.add(id);
                    }
                }
            }
            toolStore.lastPoint = pixel;
        }
    }

    function toolFinish(event) {
        if (toolStore.state.status === 'idle') return;

        const pixel = stage.clientToPixel(event);
        if (!toolStore.state.isDragging && pixel) {
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
        toolStore.state.isDragging = false;
        toolStore.state.selectionMode = null;
        toolStore.marquee.visible = false;
        toolStore.lastPoint = null;
        toolStore.visited.clear();
        stage.hoverLayerId = null;
        toolStore.addOverlayLayerIds.clear();
        toolStore.removeOverlayLayerIds.clear();
        toolStore.initialSelectionOnDrag.clear();
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
