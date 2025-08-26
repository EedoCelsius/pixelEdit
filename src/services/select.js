import { defineStore } from 'pinia';
import { useOverlayService } from './overlay';
import { useLayerPanelService } from './layerPanel';
import { useStore } from '../stores';
import { useStageToolService } from './stageTool';

export const useSelectService = defineStore('selectService', () => {
    const overlay = useOverlayService();
    const layerPanel = useLayerPanelService();
    const { layers } = useStore();

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
        if (startId !== null && tool.affectedPixels.length) addByMode(startId);
    }

    function move() {
        const tool = useStageToolService();
        if (tool.pointer.status === 'idle') return;
        const pixels = tool.previewPixels;
        const intersectedIds = new Set();
        for (const coord of pixels) {
            const id = layers.topVisibleIdAt(coord);
            if (id !== null) intersectedIds.add(id);
        }
        overlay.helper.clear();
        intersectedIds.forEach(addByMode);
    }

    function finish() {
        const tool = useStageToolService();
        if (tool.pointer.status === 'idle') return;

        const mode = tool.pointer.status;
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
            if (intersectedIds.size === 1 && (mode === 'select' || !mode)) {
                const target = intersectedIds.values().next().value;
                layerPanel.setScrollRule({ type: 'follow', target });
            }
        } else if (mode === 'select' || !mode) {
            layers.clearSelection();
        }
    }

    function cancel() {}

    const tools = { select: { start, move, finish } };

    return { tools, cancel };
});
