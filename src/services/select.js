import { defineStore } from 'pinia';
import { watch } from 'vue';
import { useOverlayService } from './overlay';
import { useLayerPanelService } from './layerPanel';
import { useStore } from '../stores';
import { useStageToolService } from './stageTool';
import { OVERLAY_CONFIG } from '@/constants';

export const useSelectService = defineStore('selectService', () => {
    const overlay = useOverlayService();
    const layerPanel = useLayerPanelService();
    const { layers, viewportEvent: viewportEvents, viewport: viewportStore } = useStore();
    const tool = useStageToolService();

    const addByMode = (id) => {
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
        overlay.helper.config = tool.pointer.status === 'remove' ? OVERLAY_CONFIG.REMOVE : OVERLAY_CONFIG.ADD;
        overlay.helper.clear();
        if (startId !== null) addByMode(startId);
    }

    function move() {
        if (tool.pointer.status === 'idle') return;
        if (!viewportEvents.isDragging(tool.pointer.id)) return;
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
        overlay.helper.clear();
        overlay.helper.config = OVERLAY_CONFIG.ADD;
    }

    function cancel() {
        overlay.helper.clear();
        overlay.helper.config = OVERLAY_CONFIG.ADD;
    }

    const tools = { select: { start, move, finish } };

    const updateHoverOverlay = () => {
        if (!tool.isSelect) {
            overlay.helper.clear();
            overlay.helper.config = OVERLAY_CONFIG.ADD;
            return;
        }
        if (tool.pointer.status !== 'idle') return;
        const pixels = tool.previewPixels;
        if (!pixels.length) {
            overlay.helper.clear();
            overlay.helper.config = OVERLAY_CONFIG.ADD;
            return;
        }
        const coord = pixels[0];
        const id = layers.topVisibleIdAt(coord);
        overlay.helper.clear();
        overlay.helper.add(id);
        overlay.helper.config = (id != null && viewportEvents.isPressed('Shift') && layers.isSelected(id)) ? OVERLAY_CONFIG.REMOVE : OVERLAY_CONFIG.ADD;
    };

    watch(() => tool.previewPixels.slice(), updateHoverOverlay);
    watch(() => tool.pointer.status, updateHoverOverlay);
    watch(() => tool.isSelect, updateHoverOverlay);

    return { tools, cancel };
});
