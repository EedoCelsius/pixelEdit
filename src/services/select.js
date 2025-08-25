import { defineStore } from 'pinia';
import { useStageService } from './stage';
import { useOverlayService } from './overlay';
import { useLayerPanelService } from './layerPanel';
import { useStore } from '../stores';
import { coordToKey } from '../utils';

export const useSelectService = defineStore('selectService', () => {
    const stage = useStageService();
    const overlay = useOverlayService();
    const layerPanel = useLayerPanelService();
    const { tool: toolStore, layers, output } = useStore();

    const addByMode = (id) => {
        const mode = toolStore.pointer.status;
        if (mode === 'remove') {
            if (layers.isSelected(id)) overlay.helper.add(id);
        } else if (mode === 'add') {
            if (!layers.isSelected(id)) overlay.helper.add(id);
        } else {
            overlay.helper.add(id);
        }
    };

    function toolStart(event) {
        if (event.button !== 0) return;
        const coord = stage.clientToCoord(event);
        if (!coord) return;

        const startId = layers.topVisibleIdAt(coord);
        const mode = !event.shiftKey
            ? 'select'
            : layers.isSelected(startId)
                ? 'remove'
                : 'add';

        output.setRollbackPoint();

        toolStore.pointer.status = mode;
        toolStore.pointer.start = { x: event.clientX, y: event.clientY };
        overlay.helper.mode = mode === 'remove' ? 'remove' : 'add';

        try {
            event.target.setPointerCapture?.(event.pointerId);
            toolStore.pointer.id = event.pointerId;
        } catch {}

        overlay.helper.clear();
        if (toolStore.shape === 'rect') {
            // rectangle interactions tracked directly in components
        } else {
            toolStore.visited.clear();
            toolStore.visited.add(coordToKey(coord));
            const id = layers.topVisibleIdAt(coord);
            if (id !== null) addByMode(id);
        }
    }

    function toolMove(event) {
        if (toolStore.pointer.status === 'idle') return;

        if (toolStore.shape === 'rect') {
            const pixels = stage.getPixelsFromInteraction(event);
            const intersectedIds = new Set();
            for (const coord of pixels) {
                const id = layers.topVisibleIdAt(coord);
                if (id !== null) intersectedIds.add(id);
            }
            overlay.helper.clear();
            intersectedIds.forEach(addByMode);
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
            const id = layers.topVisibleIdAt(coord);
            if (id !== null) {
                addByMode(id);
            }
        }
    }

    function toolFinish(event) {
        if (toolStore.pointer.status === 'idle') return;

        const mode = toolStore.pointer.status;

        const coord = stage.clientToCoord(event);
        const start = toolStore.pointer.start;
        const dx = start ? Math.abs(event.clientX - start.x) : 0;
        const dy = start ? Math.abs(event.clientY - start.y) : 0;
        const isClick = dx <= 4 && dy <= 4;
        if (isClick && coord) {
            const id = layers.topVisibleIdAt(coord);
            if (id !== null) {
                if (mode === 'select' || !mode) {
                    layers.replaceSelection([id]);
                } else {
                    layers.toggleSelection(id);
                }
                layerPanel.setScrollRule({ type: 'follow', target: id });
            }
        } else {
            const pixels = stage.getPixelsFromInteraction(event);
            if (pixels.length > 0) {
                const intersectedIds = new Set();
                for (const coord of pixels) {
                    const id = layers.topVisibleIdAt(coord);
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
        overlay.helper.clear();
        overlay.helper.mode = 'add';
    }

    return { toolStart, toolMove, toolFinish, cancel };
});
