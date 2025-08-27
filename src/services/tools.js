import { defineStore } from 'pinia';
import { watch } from 'vue';
import { useToolSelectionService } from './toolSelection';
import { useOverlayService } from './overlay';
import { useLayerPanelService } from './layerPanel';
import { useStore } from '../stores';
import { OVERLAY_CONFIG, CURSOR_CONFIG } from '@/constants';
import { coordToKey } from '../utils';

export const useDrawToolService = defineStore('drawToolService', () => {
    const tool = useToolSelectionService();
    const overlay = useOverlayService();
    const { layers } = useStore();
    watch(() => tool.active, (active) => {
        if (active !== 'draw') return
        tool.setCursor({ stroke: CURSOR_CONFIG.DRAW_STROKE, rect: CURSOR_CONFIG.DRAW_RECT });
    });
    watch(() => tool.previewPixels, (pixels) => {
        if (tool.active !== 'draw' || layers.selectionCount !== 1) return;
        overlay.helper.config = OVERLAY_CONFIG.ADD;
        overlay.helper.setPixels(pixels);
    });
    watch(() => tool.affectedPixels, (pixels) => {
        if (tool.active !== 'draw' || layers.selectionCount !== 1) return;
        const id = layers.selectedIds[0];
        layers.addPixels(id, pixels);
    });
    return {};
});

export const useEraseToolService = defineStore('eraseToolService', () => {
    const tool = useToolSelectionService();
    const overlay = useOverlayService();
    const { layers } = useStore();
    watch(() => tool.active, (active) => {
        if (active !== 'erase') return
        tool.setCursor({ stroke: CURSOR_CONFIG.ERASE_STROKE, rect: CURSOR_CONFIG.ERASE_RECT });
    });
    watch(() => tool.previewPixels, (pixels) => {
        if (tool.active !== 'erase' || layers.selectionCount !== 1) return;
        overlay.helper.config = OVERLAY_CONFIG.REMOVE;
        overlay.helper.setPixels(pixels);
    });
    watch(() => tool.affectedPixels, (pixels) => {
        if (tool.active !== 'erase' || layers.selectionCount !== 1) return;
        const id = layers.selectedIds[0];
        layers.removePixels(id, pixels);
    });
    return {};
});

export const useGlobalEraseToolService = defineStore('globalEraseToolService', () => {
    const tool = useToolSelectionService();
    const overlay = useOverlayService();
    const { layers } = useStore();
    watch(() => tool.active, (active) => {
        if (active !== 'globalErase') return
        tool.setCursor({ stroke: CURSOR_CONFIG.GLOBAL_ERASE_STROKE, rect: CURSOR_CONFIG.GLOBAL_ERASE_RECT });
    });
    watch(() => tool.previewPixels, (pixels) => {
        if (tool.active !== 'globalErase') return;
        overlay.helper.config = OVERLAY_CONFIG.REMOVE;
        overlay.helper.setPixels(pixels);
    });
    watch(() => tool.affectedPixels, (pixels) => {
        if (tool.active !== 'globalErase' || !pixels.length) return;
        const targetIds = layers.selectionExists ? layers.selectedIds : layers.order;
        for (const id of targetIds) {
            const targetKeys = new Set(layers.getProperty(id, "pixels").map(coordToKey));
            const pixelsToRemove = [];
            for (const coord of pixels) {
                if (targetKeys.has(coordToKey(coord))) pixelsToRemove.push(coord);
            }
            if (pixelsToRemove.length) layers.removePixels(id, pixelsToRemove);
        }
    });
    return {};
});

export const useCutToolService = defineStore('cutToolService', () => {
    const tool = useToolSelectionService();
    const overlay = useOverlayService();
    const { layers } = useStore();
    watch(() => tool.active, (active) => {
        if (active !== 'cut') return
        tool.setCursor({ stroke: CURSOR_CONFIG.CUT_STROKE, rect: CURSOR_CONFIG.CUT_RECT });
    });
    watch(() => tool.previewPixels, (pixels) => {
        if (tool.active !== 'cut' || layers.selectionCount !== 1) return;
        const sourceId = layers.selectedIds[0];
        const sourceKeys = new Set(layers.getProperty(sourceId, 'pixels').map(coordToKey));

        overlay.helper.config = OVERLAY_CONFIG.REMOVE;
        const previewCoords = [];
        for (const coord of pixels) {
            if (sourceKeys.has(coordToKey(coord))) {
                previewCoords.push(coord);
            }
        }
        overlay.helper.setPixels(previewCoords);
    });
    watch(() => tool.affectedPixels, (pixels) => {
        if (tool.active !== 'cut' || layers.selectionCount !== 1) return;
        const sourceId = layers.selectedIds[0];
        const sourceKeys = new Set(layers.getProperty(sourceId, 'pixels').map(coordToKey));
        
        const cutCoords = []
        for (const coord of pixels) {
            const affectedKey = coordToKey(coord);
            if (sourceKeys.has(affectedKey)) {
                cutCoords.push(coord);
            }
        }

        if (!cutCoords.length) return;
        
        layers.removePixels(sourceId, cutCoords);
        const newLayerId = layers.createLayer({
            name: `Cut of ${layers.getProperty(sourceId, 'name')}`,
            color: layers.getProperty(sourceId, 'color'),
            visibility: layers.getProperty(sourceId, 'visibility'),
            pixels: cutCoords,
        }, sourceId);

        layers.replaceSelection([newLayerId]);
    });
    return {};
});

export const useSelectService = defineStore('selectService', () => {
    const overlay = useOverlayService();
    const layerPanel = useLayerPanelService();
    const { layers, viewportEvent: viewportEvents } = useStore();
    const tool = useToolSelectionService();
    let mode = 'select';
    watch(() => tool.active, (active) => {
        if (active !== 'select') return
        tool.setCursor({ stroke: CURSOR_CONFIG.ADD_STROKE, rect: CURSOR_CONFIG.ADD_RECT });
    });
    watch(() => tool.previewPixels, (pixels) => {
        if (tool.active !== 'select') return;
        const intersectedIds = [];
        for (const coord of pixels) {
            const id = layers.topVisibleIdAt(coord);
            if (id !== null) intersectedIds.push(id);
        }
        if (intersectedIds.length === 1) {
            if (!viewportEvents.isPressed('Shift')) {
                mode = 'select';
                overlay.helper.config = OVERLAY_CONFIG.ADD;
                tool.setCursor({ stroke: CURSOR_CONFIG.ADD_STROKE, rect: CURSOR_CONFIG.ADD_RECT });
            } else if (layers.isSelected(intersectedIds[0])) {
                mode = 'remove';
                overlay.helper.config = OVERLAY_CONFIG.REMOVE;
                tool.setCursor({ stroke: CURSOR_CONFIG.REMOVE_STROKE, rect: CURSOR_CONFIG.REMOVE_RECT });
            } else {
                mode = 'add';
                overlay.helper.config = OVERLAY_CONFIG.ADD;
                tool.setCursor({ stroke: CURSOR_CONFIG.ADD_STROKE, rect: CURSOR_CONFIG.ADD_RECT });
            }
        }
        const highlightIds = [];
        intersectedIds.forEach(id => {
            if (mode === 'remove' && !layers.isSelected(id)) return;
            if (mode === 'add' && layers.isSelected(id)) return;
            highlightIds.push(id);
        });
        overlay.helper.setLayers(highlightIds);
    });
    watch(() => tool.affectedPixels, (pixels) => {
        if (tool.active !== 'select') return;
        if (pixels.length > 0) {
            const intersectedIds = new Set();
            for (const coord of pixels) {
                const id = layers.topVisibleIdAt(coord);
                if (id !== null) intersectedIds.add(id);
            }
            const currentSelection = new Set(mode === 'select' ? [] : layers.selectedIds);
            if (mode === 'add') {
                intersectedIds.forEach(id => currentSelection.add(id));
            } else if (mode === 'remove') {
                intersectedIds.forEach(id => currentSelection.delete(id));
            } else {
                intersectedIds.forEach(id => currentSelection.add(id));
            }
            layers.replaceSelection([...currentSelection]);
            layerPanel.setScrollRule({ type: 'follow', target: layers.selectedIds[0] });
        } else if (mode === 'select') {
            layers.clearSelection();
        }
    });

    return {};
});
