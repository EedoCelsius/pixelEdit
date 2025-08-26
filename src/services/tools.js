import { defineStore } from 'pinia';
import { watch, ref } from 'vue';
import { useToolSelectionService } from './toolSelection';
import { useOverlayService } from './overlay';
import { useLayerPanelService } from './layerPanel';
import { useStore } from '../stores';
import { OVERLAY_CONFIG, CURSOR_CONFIG } from '@/constants';
import { coordToKey } from '../utils';

export const useDrawToolService = defineStore('drawToolService', () => {
    const tool = useToolSelectionService();
    const { layers } = useStore();
    watch(() => tool.active, (active) => {
        if (active === 'draw') {
            tool.setCursor({ stroke: CURSOR_CONFIG.DRAW_STROKE, rect: CURSOR_CONFIG.DRAW_RECT });
        }
    }, { immediate: true });
    watch(() => tool.affectedPixels.slice(), (pixels) => {
        if (tool.pointer.status !== 'draw' || layers.selectionCount !== 1) return;
        const id = layers.selectedIds[0];
        layers.addPixels(id, pixels);
    });
    return {};
});

export const useEraseToolService = defineStore('eraseToolService', () => {
    const tool = useToolSelectionService();
    const { layers } = useStore();
    watch(() => tool.active, (active) => {
        if (active === 'erase') {
            tool.setCursor({ stroke: CURSOR_CONFIG.ERASE_STROKE, rect: CURSOR_CONFIG.ERASE_RECT });
        }
    }, { immediate: true });
    watch(() => tool.affectedPixels.slice(), (pixels) => {
        if (tool.pointer.status !== 'erase' || layers.selectionCount !== 1) return;
        const id = layers.selectedIds[0];
        layers.removePixels(id, pixels);
    });
    return {};
});

export const useGlobalEraseToolService = defineStore('globalEraseToolService', () => {
    const tool = useToolSelectionService();
    const { layers } = useStore();
    watch(() => tool.active, (active) => {
        if (active === 'globalErase') {
            tool.setCursor({ stroke: CURSOR_CONFIG.GLOBAL_ERASE_STROKE, rect: CURSOR_CONFIG.GLOBAL_ERASE_RECT });
        }
    }, { immediate: true });
    watch(() => tool.affectedPixels.slice(), (pixels) => {
        if (tool.pointer.status !== 'globalErase' || !pixels.length) return;
        if (layers.selectionExists) {
            for (const id of layers.selectedIds) {
                const props = layers.getProperties(id);
                const set = new Set(props.pixels.map(coordToKey));
                const pixelsToRemove = [];
                for (const coord of pixels) {
                    if (set.has(coordToKey(coord))) pixelsToRemove.push(coord);
                }
                if (pixelsToRemove.length) layers.removePixels(id, pixelsToRemove);
            }
        } else {
            for (const id of layers.order) {
                const props = layers.getProperties(id);
                const set = new Set(props.pixels.map(coordToKey));
                const pixelsToRemove = [];
                for (const coord of pixels) {
                    if (set.has(coordToKey(coord))) pixelsToRemove.push(coord);
                }
                if (pixelsToRemove.length) layers.removePixels(id, pixelsToRemove);
            }
        }
    });
    return {};
});

export const useCutToolService = defineStore('cutToolService', () => {
    const tool = useToolSelectionService();
    const overlay = useOverlayService();
    const { layers } = useStore();
    let cutLayerId = null;
    watch(() => tool.active, (active) => {
        if (active === 'cut') {
            tool.setCursor({ stroke: CURSOR_CONFIG.CUT_STROKE, rect: CURSOR_CONFIG.CUT_RECT });
        }
    }, { immediate: true });

    const cutPixels = (pixels) => {
        if (layers.selectionCount !== 1 || cutLayerId == null) return;
        const sourceId = layers.selectedIds[0];
        const coords = layers.getProperty(sourceId, 'pixels');
        const set = new Set(coords.map(coordToKey));
        const pixelsToMove = [];
        for (const coord of pixels) {
            if (set.has(coordToKey(coord))) pixelsToMove.push(coord);
        }
        if (!pixelsToMove.length) return;
        layers.removePixels(sourceId, pixelsToMove);
        layers.addPixels(cutLayerId, pixelsToMove);
        overlay.helper.clear();
        overlay.helper.add(cutLayerId);
    };

    const startCut = () => {
        if (layers.selectionCount !== 1) return;
        const sourceId = layers.selectedIds[0];
        const sourceProps = layers.getProperties(sourceId);
        cutLayerId = layers.createLayer({
            name: `Cut of ${sourceProps.name}`,
            color: sourceProps.color,
            visible: sourceProps.visible,
        }, sourceId);
        overlay.helper.clear();
        overlay.helper.add(cutLayerId);
        overlay.helper.config = OVERLAY_CONFIG.ADD;
        cutPixels(tool.affectedPixels);
    };

    const finishCut = () => {
        cutPixels(tool.affectedPixels);
        if (cutLayerId != null && layers.has(cutLayerId)) {
            if (layers.getProperty(cutLayerId, 'pixels').length)
                layers.replaceSelection([cutLayerId]);
            else
                layers.deleteLayers([cutLayerId]);
        }
        cutLayerId = null;
        overlay.helper.clear();
        overlay.helper.config = OVERLAY_CONFIG.ADD;
    };

    const cancelCut = () => {
        cutLayerId = null;
        overlay.helper.clear();
        overlay.helper.config = OVERLAY_CONFIG.ADD;
    };

    watch(() => tool.pointer.status, (status, prev) => {
        if (status === 'cut' && prev !== 'cut') {
            startCut();
        } else if (prev === 'cut' && status !== 'cut') {
            if (tool.pointer.event === 'pointercancel' || tool.pointer.event === 'pinch') cancelCut();
            else finishCut();
        }
    });

    watch(() => tool.affectedPixels.slice(), (pixels) => {
        if (tool.pointer.status === 'cut') cutPixels(pixels);
    });

    return { cancel: cancelCut };
});

export const useSelectService = defineStore('selectService', () => {
    const overlay = useOverlayService();
    const layerPanel = useLayerPanelService();
    const { layers, viewportEvent: viewportEvents, viewport: viewportStore } = useStore();
    const tool = useToolSelectionService();
    const mode = ref('select');

    watch([
        () => tool.active,
        () => overlay.helper.config,
    ], ([active, helperConfig]) => {
        if (active === 'select') {
            const helperMode = helperConfig === OVERLAY_CONFIG.REMOVE ? 'remove' : 'add';
            tool.setCursor({
                stroke: helperMode === 'remove' ? CURSOR_CONFIG.REMOVE_STROKE : CURSOR_CONFIG.ADD_STROKE,
                rect: helperMode === 'remove' ? CURSOR_CONFIG.REMOVE_RECT : CURSOR_CONFIG.ADD_RECT,
            });
        }
    }, { immediate: true });

    const addByMode = (id) => {
        const m = mode.value;
        if (m === 'remove') {
            if (layers.isSelected(id)) overlay.helper.add(id);
        } else if (m === 'add') {
            if (!layers.isSelected(id)) overlay.helper.add(id);
        } else {
            overlay.helper.add(id);
        }
    };

    function start() {
        const event = viewportEvents.get('pointerdown', tool.pointer.id);
        const coord = viewportStore.clientToCoord(event);
        const startId = coord ? layers.topVisibleIdAt(coord) : null;
        if (!viewportEvents.isPressed('Shift')) {
            mode.value = 'select';
        } else {
            mode.value = layers.isSelected(startId) ? 'remove' : 'add';
        }
        overlay.helper.config = mode.value === 'remove' ? OVERLAY_CONFIG.REMOVE : OVERLAY_CONFIG.ADD;
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
        const m = mode.value;
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
                if (m === 'select' || !m) {
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
                    (m === 'select' || !m) ? [] : layers.selectedIds
                );
                if (m === 'add') {
                    intersectedIds.forEach(id => currentSelection.add(id));
                } else if (m === 'remove') {
                    intersectedIds.forEach(id => currentSelection.delete(id));
                } else {
                    intersectedIds.forEach(id => currentSelection.add(id));
                }
                layers.replaceSelection([...currentSelection]);
            } else if (m === 'select' || !m) {
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

    watch(() => tool.pointer.status, (status, prev) => {
        if (status === 'select' && prev !== 'select') {
            start();
        } else if (status !== 'select' && prev === 'select') {
            if (tool.pointer.event === 'pointercancel' || tool.pointer.event === 'pinch') cancel();
            else finish();
        }
    });

    watch(() => tool.previewPixels.slice(), () => {
        if (tool.pointer.status === 'select') move();
    });

    const updateHoverOverlay = () => {
        if (tool.active !== 'select') {
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
    watch(() => tool.active, updateHoverOverlay);

    return { cancel };
});
