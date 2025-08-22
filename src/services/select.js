import { defineStore } from 'pinia';
import { useStageService } from './stage';
import { useToolStore } from '../stores/tool';
import { useSelectionStore } from '../stores/selection';
import { useLayerStore } from '../stores/layers';
import { useOutputStore } from '../stores/output';
import { coordsToKey } from '../utils';

export const useSelectService = defineStore('selectService', () => {
    const stage = useStageService();
    const toolStore = useToolStore();
    const selection = useSelectionStore();
    const layers = useLayerStore();
    const output = useOutputStore();

    function toolStart(event) {
        if (event.button !== 0) return;
        const pixel = stage.clientToPixel(event);
        if (!pixel) return;

        const startId = layers.topVisibleIdAt(pixel.x, pixel.y);
        const mode = !event.shiftKey
            ? 'select'
            : selection.isSelected(startId)
                ? 'remove'
                : 'add';

        output.setRollbackPoint();

        toolStore.pointer.status = `select:${mode}`;
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

            const id = layers.topVisibleIdAt(pixel.x, pixel.y);
            if (id !== null) {
                if (mode === 'remove') {
                    if (selection.isSelected(id)) toolStore.selectOverlayLayerIds.add(id);
                } else if (mode === 'add') {
                    if (!selection.isSelected(id)) toolStore.selectOverlayLayerIds.add(id);
                } else {
                    toolStore.selectOverlayLayerIds.add(id);
                }
            }
        }
    }

    function toolMove(event) {
        if (toolStore.pointer.status === 'idle') return;

        const [, mode] = toolStore.pointer.status.split(':');

        if (toolStore.shape === 'rect') {
            toolStore.pointer.current = { x: event.clientX, y: event.clientY };
            const { x, y, w, h } = toolStore.marquee;
            const intersectedIds = new Set();
            for (let yy = y; yy < y + h; yy++) {
                for (let xx = x; xx < x + w; xx++) {
                    const id = layers.topVisibleIdAt(xx, yy);
                    if (id !== null) intersectedIds.add(id);
                }
            }
            toolStore.selectOverlayLayerIds.clear();
            if (mode === 'add') {
                for (const id of intersectedIds) {
                    if (!selection.isSelected(id)) toolStore.selectOverlayLayerIds.add(id);
                }
            } else if (mode === 'remove') {
                for (const id of intersectedIds) {
                    if (selection.isSelected(id)) toolStore.selectOverlayLayerIds.add(id);
                }
            } else {
                for (const id of intersectedIds) {
                    toolStore.selectOverlayLayerIds.add(id);
                }
            }
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
            const id = layers.topVisibleIdAt(pixel.x, pixel.y);
            if (id !== null) {
                if (mode === 'remove') {
                    if (selection.isSelected(id)) toolStore.selectOverlayLayerIds.add(id);
                } else if (mode === 'add') {
                    if (!selection.isSelected(id)) toolStore.selectOverlayLayerIds.add(id);
                } else {
                    toolStore.selectOverlayLayerIds.add(id);
                }
            }
            toolStore.pointer.current = pixel;
        }
    }

    function toolFinish(event) {
        if (toolStore.pointer.status === 'idle') return;

        const [, mode] = toolStore.pointer.status.split(':');

        const pixel = stage.clientToPixel(event);
        const start = toolStore.pointer.start;
        const dx = start ? Math.abs(event.clientX - start.x) : 0;
        const dy = start ? Math.abs(event.clientY - start.y) : 0;
        const isClick = dx <= 4 && dy <= 4;
        if (isClick && pixel) {
            const id = layers.topVisibleIdAt(pixel.x, pixel.y);
            if (id !== null) {
                if (mode === 'select' || !mode) {
                    selection.selectOne(id);
                } else {
                    selection.toggle(id);
                }
                selection.setScrollRule({ type: 'follow', target: id });
            }
        } else {
            const pixels = stage.getPixelsFromInteraction(event);
            if (pixels.length > 0) {
                const intersectedIds = new Set();
                for (const [x, y] of pixels) {
                    const id = layers.topVisibleIdAt(x, y);
                    if (id !== null) intersectedIds.add(id);
                }
                const currentSelection = new Set(
                    (mode === 'select' || !mode) ? [] : selection.ids
                );
                if (mode === 'add') {
                    intersectedIds.forEach(id => currentSelection.add(id));
                } else if (mode === 'remove') {
                    intersectedIds.forEach(id => currentSelection.delete(id));
                } else {
                    intersectedIds.forEach(id => currentSelection.add(id));
                }
                if (mode === 'select' || !mode) {
                    selection.replace([...currentSelection], null, null);
                } else {
                    selection.replace([...currentSelection], selection.anchorId, selection.tailId);
                }
            } else if (mode === 'select' || !mode) {
                selection.clear();
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
        toolStore.hoverLayerId = null;
        toolStore.selectOverlayLayerIds.clear();
    }

    function selectRange(anchorId, tailId) {
        const anchorIndex = layers.idsTopToBottom.indexOf(anchorId);
        const tailIndex = layers.idsTopToBottom.indexOf(tailId);
        const slice = layers.idsTopToBottom.slice(
            Math.min(anchorIndex, tailIndex),
            Math.max(anchorIndex, tailIndex) + 1
        );
        selection.replace(slice, anchorId, tailId);
    }

    return { toolStart, toolMove, toolFinish, cancel, selectRange };
});
