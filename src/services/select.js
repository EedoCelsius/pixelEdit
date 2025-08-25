import { defineStore } from 'pinia';
import { useStageService } from './stage';
import { useOverlayService } from './overlay';
import { useLayerPanelService } from './layerPanel';
import { useStore } from '../stores';
import { useStageToolService } from './stageTool';
import { useToolService } from './tool';

export const useSelectService = defineStore('selectService', () => {
    const stage = useStageService();
    const overlay = useOverlayService();
    const layerPanel = useLayerPanelService();
    const { layers, stageEvent: stageEvents } = useStore();

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

    function start(event) {
        const tool = useStageToolService();
        if (event.button !== 0) return;
        const coord = stage.clientToCoord(event);
        if (!coord) return;

        const startId = layers.topVisibleIdAt(coord);
        const mode = !event.shiftKey
            ? 'select'
            : layers.isSelected(startId)
                ? 'remove'
                : 'add';

        if (!tool.begin(event, mode)) return;
        overlay.helper.mode = mode === 'remove' ? 'remove' : 'add';

        overlay.helper.clear();
        if (tool.shape === 'rect') {
            // rectangle interactions tracked directly in components
        } else {
            const id = layers.topVisibleIdAt(coord);
            if (id !== null) addByMode(id);
        }
    }

    function move(event) {
        const tool = useStageToolService();
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
            const id = layers.topVisibleIdAt(coord);
            if (id !== null) {
                addByMode(id);
            }
        }
    }

    function finish(event) {
        const tool = useStageToolService();
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

        const common = useToolService();
        common.finish(event);
    }

    function cancel(event) {
        const common = useToolService();
        common.cancel();
    }

    function reset() {
        const common = useToolService();
        common.reset();
    }

    const tools = { select: { start, move, finish } };

    return { tools, cancel };
});
