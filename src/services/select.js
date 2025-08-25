import { defineStore } from 'pinia';
import { useStageService } from './stage';
import { useOverlayService } from './overlay';
import { useLayerPanelService } from './layerPanel';
import { useStore } from '../stores';
import { coordsToKey } from '../utils';

export const useSelectService = defineStore('selectService', () => {
    const stage = useStageService();
    const overlay = useOverlayService();
    const layerPanel = useLayerPanelService();
    const { tool: toolStore, layers, output } = useStore();

    function toolStart(event) {
        if (event.button !== 0) return;
        const pixel = stage.clientToPixel(event);
        if (!pixel) return;

        const startId = layers.topVisibleIdAt(pixel.x, pixel.y);
        const mode = !event.shiftKey
            ? 'select'
            : layers.isSelected(startId)
                ? 'remove'
                : 'add';

        output.setRollbackPoint();

        toolStore.pointer.status = mode;
        toolStore.pointer.start = { x: event.clientX, y: event.clientY };

        try {
            event.target.setPointerCapture?.(event.pointerId);
            toolStore.pointer.id = event.pointerId;
        } catch {}

        if (toolStore.shape === 'rect') {
            // rectangle interactions tracked directly in components
        } else {
            toolStore.visited.clear();
            toolStore.visited.add(coordsToKey(pixel.x, pixel.y));

            const id = layers.topVisibleIdAt(pixel.x, pixel.y);
            if (id !== null) {
                overlay.addByMode(id);
            }
        }
    }

    function toolMove(event) {
        if (toolStore.pointer.status === 'idle') return;

        if (toolStore.shape === 'rect') {
            const pixels = stage.getPixelsFromInteraction(event);
            const intersectedIds = new Set();
            for (const [xx, yy] of pixels) {
                const id = layers.topVisibleIdAt(xx, yy);
                if (id !== null) intersectedIds.add(id);
            }
            overlay.setFromIntersected(intersectedIds);
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
            const id = layers.topVisibleIdAt(pixel.x, pixel.y);
            if (id !== null) {
                overlay.addByMode(id);
            }
        }
    }

    function toolFinish(event) {
        if (toolStore.pointer.status === 'idle') return;

        const mode = toolStore.pointer.status;

        const pixel = stage.clientToPixel(event);
        const start = toolStore.pointer.start;
        const dx = start ? Math.abs(event.clientX - start.x) : 0;
        const dy = start ? Math.abs(event.clientY - start.y) : 0;
        const isClick = dx <= 4 && dy <= 4;
        if (isClick && pixel) {
            const id = layers.topVisibleIdAt(pixel.x, pixel.y);
            if (id !== null) {
                if (mode === 'select' || !mode) {
                    layerPanel.setRange(id, id);
                } else {
                    layers.toggleSelection(id);
                    layerPanel.clearRange();
                }
                layerPanel.setScrollRule({ type: 'follow', target: id });
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
                    (mode === 'select' || !mode) ? [] : layers.selectedIds
                );
                if (mode === 'add') {
                    intersectedIds.forEach(id => currentSelection.add(id));
                } else if (mode === 'remove') {
                    intersectedIds.forEach(id => currentSelection.delete(id));
                } else {
                    intersectedIds.forEach(id => currentSelection.add(id));
                }
                layers.replaceSelection([...currentSelection]);
                if (mode === 'select' || !mode) {
                    layerPanel.clearRange();
                }
            } else if (mode === 'select' || !mode) {
                    layers.clearSelection();
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
        toolStore.visited.clear();
        overlay.clearHover();
        overlay.clear();
    }

    function selectRange(anchorId, tailId) {
        layerPanel.setRange(anchorId, tailId);
    }

    return { toolStart, toolMove, toolFinish, cancel, selectRange };
});
