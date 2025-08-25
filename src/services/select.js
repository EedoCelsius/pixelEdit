import { defineStore } from 'pinia';
import { useStageService } from './stage';
import { useOverlayService } from './overlay';
import { useLayerPanelService } from './layerPanel';
import { useStore } from '../stores';
import { useToolService } from './tool';
import { coordToKey } from '../utils';

export const useSelectService = defineStore('selectService', () => {
    const stage = useStageService();
    const overlay = useOverlayService();
    const layerPanel = useLayerPanelService();
    const { layers, output, stageEvent: stageEvents } = useStore();

    const addByMode = (id) => {
        const tool = useToolService();
        const mode = tool.pointer.status;
        if (mode === 'remove') {
            if (layers.isSelected(id)) overlay.helper.add(id);
        } else if (mode === 'add') {
            if (!layers.isSelected(id)) overlay.helper.add(id);
        } else {
            overlay.helper.add(id);
        }
    };

    function start(event) {
        const tool = useToolService();
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

        tool.pointer.status = mode;
        overlay.helper.mode = mode === 'remove' ? 'remove' : 'add';

        try {
            event.target.setPointerCapture?.(event.pointerId);
            tool.pointer.id = event.pointerId;
        } catch {}

        overlay.helper.clear();
        if (tool.shape === 'rect') {
            // rectangle interactions tracked directly in components
        } else {
            tool.visited.clear();
            tool.visited.add(coordToKey(coord));
            const id = layers.topVisibleIdAt(coord);
            if (id !== null) addByMode(id);
        }
    }

    function move(event) {
        const tool = useToolService();
        if (tool.pointer.status === 'idle') return;

        if (tool.shape === 'rect') {
            const pixels = tool.getPixelsFromInteraction(event);
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
            if (tool.visited.has(k)) {
                return;
            }
            tool.visited.add(k);
            const id = layers.topVisibleIdAt(coord);
            if (id !== null) {
                addByMode(id);
            }
        }
    }

    function finish(event) {
        const tool = useToolService();
        if (tool.pointer.status === 'idle') return;

        const mode = tool.pointer.status;

        const coord = stage.clientToCoord(event);
        const start = stageEvents.pointer.start;
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
            const pixels = tool.getPixelsFromInteraction(event);
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
    }

    const tools = { select: { start, move, finish } };

    return { tools, cancel };
});
