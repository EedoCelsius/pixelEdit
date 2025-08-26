import { defineStore } from 'pinia';
import { useOverlayService } from './overlay';
import { useLayerPanelService } from './layerPanel';
import { useStore } from '../stores';
import { useStageToolService } from './stageTool';
import { useViewportService } from './viewport';

export const useSelectService = defineStore('selectService', () => {
    const overlay = useOverlayService();
    const layerPanel = useLayerPanelService();
    const { layers, viewportEvent: viewportEvents, viewport: viewportStore } = useStore();
    const viewport = useViewportService();

    const addByMode = (id) => {
        const tool = useStageToolService();
        const mode = tool.pointer.status;
        if (mode === 'remove') {
            if (layers.isSelected(id)) overlay.helper.add(id);
        } else if (mode === 'add') {
            if (!layers.isSelected(id)) overlay.helper.add(id);
        } else {
            overlay.helper.add(id);
        }
    };

    function start(coord, startId) {
        const tool = useStageToolService();
        overlay.helper.clear();
        if (tool.shape === 'rect') {
            // rectangle interactions tracked directly in components
        } else {
            if (startId !== null) addByMode(startId);
        }
    }

    function move() {
        const tool = useStageToolService();
        if (tool.pointer.status === 'idle') return;
        if (!viewportEvents.isDragging(tool.pointer.id)) return;
        const event = viewportEvents.getEvent('pointermove', tool.pointer.id);

        if (tool.shape === 'rect') {
            const pixels = tool.getPixelsFromInteraction('move');
            const intersectedIds = new Set();
            for (const coord of pixels) {
                const id = layers.topVisibleIdAt(coord);
                if (id !== null) intersectedIds.add(id);
            }
            overlay.helper.clear();
            intersectedIds.forEach(addByMode);
        } else {
            const coord = viewportStore.clientToCoord(event);
            if (!coord) {
                return;
            }
            const id = layers.topVisibleIdAt(coord);
            if (id !== null) {
                addByMode(id);
            }
        }
    }

    function finish() {
        const tool = useStageToolService();
        if (tool.pointer.status === 'idle') return;

        const mode = tool.pointer.status;
        const event = viewportEvents.getEvent('pointerup', tool.pointer.id);
        if (!event) return;

        const coord = viewportStore.clientToCoord(event);
            const startEvent = viewportEvents.getEvent('pointerdown', tool.pointer.id);
            const dx = startEvent ? Math.abs(event.clientX - startEvent.clientX) : 0;
            const dy = startEvent ? Math.abs(event.clientY - startEvent.clientY) : 0;
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
            const pixels = tool.getPixelsFromInteraction('up');
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
    }

    function cancel() {}

    const tools = { select: { start, move, finish } };

    return { tools, cancel };
});
