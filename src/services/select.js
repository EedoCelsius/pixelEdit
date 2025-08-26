import { defineStore } from 'pinia';
import { useLayerPanelService } from './layerPanel';
import { useStore } from '../stores';
import { useStageToolService } from './stageTool';

export const useSelectService = defineStore('selectService', () => {
    const layerPanel = useLayerPanelService();
    const { layers, viewportEvent: viewportEvents, viewport: viewportStore } = useStore();

    function start(coord, startId) {}

    function move() {}

    function finish() {
        const tool = useStageToolService();
        if (tool.pointer.status === 'idle') return;

        const mode = tool.pointer.status;
        const event = viewportEvents.get('pointerup', tool.pointer.id);
        if (!event) return;

        const coord = viewportStore.clientToCoord(event);
        const startEvent = viewportEvents.get('pointerdown', tool.pointer.id);
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
            const pixels = tool.affectedPixels;
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
