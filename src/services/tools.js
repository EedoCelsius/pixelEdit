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
    const overlayService = useOverlayService();
    const overlay = overlayService.addOverlay('draw');
    overlay.config.value = OVERLAY_CONFIG.ADD;
    const { nodeTree, nodes } = useStore();
    watch(() => tool.prepared === 'draw', (isDraw) => {
        if (!isDraw) {
            overlay.clear();
            return;
        }
        tool.setCursor({ stroke: CURSOR_CONFIG.DRAW_STROKE, rect: CURSOR_CONFIG.DRAW_RECT });
    });
    watch(() => tool.hoverPixel, (pixel) => {
        if (tool.prepared !== 'draw') return;
        overlay.setPixels(pixel ? [pixel] : []);
    });
    watch(() => tool.dragPixel, (pixel) => {
        if (tool.prepared !== 'draw' || nodeTree.selectedLayerCount !== 1) return;
        const sourceId = nodeTree.selectedLayerIds[0];
        if (nodes.getProperty(sourceId, 'locked')) {
            if (pixel)
                tool.setCursor({ stroke: CURSOR_CONFIG.LOCKED, rect: CURSOR_CONFIG.LOCKED });
            else
                tool.setCursor({ stroke: CURSOR_CONFIG.DRAW_STROKE, rect: CURSOR_CONFIG.DRAW_RECT });
            return;
        }
    });
    watch(() => tool.previewPixels, (pixels) => {
        if (tool.prepared !== 'draw' || nodeTree.selectedLayerCount !== 1) return;
        overlay.setPixels(pixels);
    });
    watch(() => tool.affectedPixels, (pixels) => {
        if (tool.prepared !== 'draw' || nodeTree.selectedLayerCount !== 1) return;
        const id = nodeTree.selectedLayerIds[0];
        if (nodes.getProperty(id, 'locked')) return;
        nodes.addPixelsToLayer(id, pixels);
    });
    return {};
});

export const useEraseToolService = defineStore('eraseToolService', () => {
    const tool = useToolSelectionService();
    const overlayService = useOverlayService();
    const overlay = overlayService.addOverlay('erase');
    overlay.config.value = OVERLAY_CONFIG.REMOVE;
    const { nodeTree, nodes } = useStore();
    watch(() => tool.prepared === 'erase', (isErase) => {
        if (!isErase) {
            overlay.clear();
            return;
        }
        tool.setCursor({ stroke: CURSOR_CONFIG.ERASE_STROKE, rect: CURSOR_CONFIG.ERASE_RECT });
    });
    watch(() => tool.hoverPixel, (pixel) => {
        if (tool.prepared !== 'erase') return;
        overlay.setPixels(pixel ? [pixel] : []);
    });
    watch(() => tool.dragPixel, (pixel) => {
        if (tool.prepared !== 'erase' || nodeTree.selectedLayerCount !== 1) return;
        const sourceId = nodeTree.selectedLayerIds[0];
        if (nodes.getProperty(sourceId, 'locked')) {
            const sourceKeys = new Set((nodes.getProperty(sourceId, 'pixels') || []).map(coordToKey));
            if (pixel && sourceKeys.has(coordToKey(pixel)))
                tool.setCursor({ stroke: CURSOR_CONFIG.LOCKED, rect: CURSOR_CONFIG.LOCKED });
            else
                tool.setCursor({ stroke: CURSOR_CONFIG.ERASE_STROKE, rect: CURSOR_CONFIG.ERASE_RECT });
        }
    });
    watch(() => tool.previewPixels, (pixels) => {
        if (tool.prepared !== 'erase' || nodeTree.selectedLayerCount !== 1) return;
        overlay.setPixels(pixels);
    });
    watch(() => tool.affectedPixels, (pixels) => {
        if (tool.prepared !== 'erase' || nodeTree.selectedLayerCount !== 1) return;
        const id = nodeTree.selectedLayerIds[0];
        if (nodes.getProperty(id, 'locked')) return;
        nodes.removePixelsFromLayer(id, pixels);
    });
    return {};
});

export const useCutToolService = defineStore('cutToolService', () => {
    const tool = useToolSelectionService();
    const overlayService = useOverlayService();
    const overlay = overlayService.addOverlay('cut');
    overlay.config.value = OVERLAY_CONFIG.REMOVE;
    const layerPanel = useLayerPanelService();
    const { nodeTree, nodes } = useStore();
    watch(() => tool.prepared === 'cut', (isCut) => {
        if (!isCut) {
            overlay.clear();
            return;
        }
        tool.setCursor({ stroke: CURSOR_CONFIG.CUT_STROKE, rect: CURSOR_CONFIG.CUT_RECT });
    });
    watch(() => tool.hoverPixel, (pixel) => {
        if (tool.prepared !== 'cut') return;
        overlay.setPixels(pixel ? [pixel] : []);
    });
    watch(() => tool.dragPixel, (pixel) => {
        if (tool.prepared !== 'cut' || nodeTree.selectedLayerCount !== 1) return;
        const sourceId = nodeTree.selectedLayerIds[0];
        if (nodes.getProperty(sourceId, 'locked')) {
            const sourceKeys = new Set((nodes.getProperty(sourceId, 'pixels') || []).map(coordToKey));
            if (pixel && sourceKeys.has(coordToKey(pixel)))
                tool.setCursor({ stroke: CURSOR_CONFIG.LOCKED, rect: CURSOR_CONFIG.LOCKED });
            else
                tool.setCursor({ stroke: CURSOR_CONFIG.CUT_STROKE, rect: CURSOR_CONFIG.CUT_RECT });
        }
    });
    watch(() => tool.previewPixels, (pixels) => {
        if (tool.prepared !== 'cut' || nodeTree.selectedLayerCount !== 1) return;
        overlay.setPixels(pixels);
    });
    watch(() => tool.affectedPixels, (pixels) => {
        if (tool.prepared !== 'cut' || nodeTree.selectedLayerCount !== 1) return;
        const sourceId = nodeTree.selectedLayerIds[0];
        if (nodes.getProperty(sourceId, 'locked')) return;
        const sourceKeys = new Set((nodes.getProperty(sourceId, 'pixels') || []).map(coordToKey));

        const cutCoords = [];
        const cutKeys = new Set();
        for (const coord of pixels) {
            const affectedKey = coordToKey(coord);
            if (sourceKeys.has(affectedKey) && !cutKeys.has(affectedKey)) {
                cutCoords.push(coord);
                cutKeys.add(affectedKey);
            }
        }

        if (!cutCoords.length || cutKeys.size === sourceKeys.size) return;

        nodes.removePixelsFromLayer(sourceId, cutCoords);
        const id = nodes.createLayer({
            name: `Cut of ${nodes.getProperty(sourceId, 'name')}`,
            color: nodes.getProperty(sourceId, 'color'),
            visibility: nodes.getProperty(sourceId, 'visibility'),
            pixels: cutCoords,
            attributes: nodes.getProperty(sourceId, 'attributes'),
        });
        nodeTree.insert([id], sourceId, false);

        nodeTree.replaceSelection([sourceId]);
        layerPanel.setScrollRule({ type: 'follow', target: sourceId });
    });
    return {};
});

export const useTopToolService = defineStore('topToolService', () => {
    const tool = useToolSelectionService();
    const overlayService = useOverlayService();
    const overlay = overlayService.addOverlay('top');
    overlay.config.value = OVERLAY_CONFIG.ADD;
    const layerPanel = useLayerPanelService();
    const { nodeTree, nodes } = useStore();
    watch(() => tool.prepared === 'top', (isTop) => {
        if (!isTop) {
            overlay.clear();
            return;
        }
        tool.setCursor({ stroke: CURSOR_CONFIG.TOP, rect: CURSOR_CONFIG.TOP });
    });
    watch(() => tool.hoverPixel, (pixel) => {
        if (tool.prepared !== 'top') return;
        if (!pixel) {
            overlay.clear();
            return;
        }
        const id = nodes.topVisibleIdAt(pixel);
        if (id && nodes.getProperty(id, 'locked')) {
            tool.setCursor({ stroke: CURSOR_CONFIG.LOCKED, rect: CURSOR_CONFIG.LOCKED });
        }
        else {
            tool.setCursor({ stroke: CURSOR_CONFIG.TOP, rect: CURSOR_CONFIG.TOP });
        }
        overlay.setLayers(id ? [id] : []);
    });
    watch(() => tool.dragPixel, (pixel) => {
        if (tool.prepared !== 'top' || !pixel) return;
        const id = nodes.topVisibleIdAt(pixel);
        if (!id) return;
        if (nodes.getProperty(id, 'locked')) {
            tool.setCursor({ stroke: CURSOR_CONFIG.LOCKED, rect: CURSOR_CONFIG.LOCKED });
        }
        else {
            nodeTree.insert([id], nodeTree.layerIdsTopToBottom[0], false);
            nodeTree.replaceSelection([id]);
            layerPanel.setScrollRule({ type: 'follow', target: id });
            tool.setCursor({ stroke: CURSOR_CONFIG.TOP, rect: CURSOR_CONFIG.TOP });
        } 
    });
    return {};
});

export const useSelectService = defineStore('selectService', () => {
    const tool = useToolSelectionService();
    const overlayService = useOverlayService();
    const overlay = overlayService.addOverlay('select');
    overlay.config.value = OVERLAY_CONFIG.ADD;
    const layerPanel = useLayerPanelService();
    const { nodeTree, nodes, viewportEvent: viewportEvents } = useStore();
    let mode = 'select';
    watch(() => tool.prepared === 'select', (isSelect) => {
        if (!isSelect) {
            overlay.clear();
            return;
        }
        tool.setCursor({ stroke: CURSOR_CONFIG.ADD_STROKE, rect: CURSOR_CONFIG.ADD_RECT });
    });
    watch(() => tool.hoverPixel, (pixel) => {
        if (tool.prepared !== 'select') return;
        if (!pixel) {
            overlay.clear();
            return;
        }
        const id = nodes.topVisibleIdAt(pixel);
        if (!viewportEvents.isPressed('Shift')) {
            mode = 'select';
            overlay.config.value = OVERLAY_CONFIG.ADD;
            tool.setCursor({ stroke: CURSOR_CONFIG.ADD_STROKE, rect: CURSOR_CONFIG.ADD_RECT });
        } else if (nodeTree.isSelected(id)) {
            mode = 'remove';
            overlay.config.value = OVERLAY_CONFIG.REMOVE;
            tool.setCursor({ stroke: CURSOR_CONFIG.REMOVE_STROKE, rect: CURSOR_CONFIG.REMOVE_RECT });
        } else {
            mode = 'add';
            overlay.config.value = OVERLAY_CONFIG.ADD;
            tool.setCursor({ stroke: CURSOR_CONFIG.ADD_STROKE, rect: CURSOR_CONFIG.ADD_RECT });
        }

        if (id && nodes.getProperty(id, 'locked')) {
            tool.setCursor({ stroke: CURSOR_CONFIG.LOCKED, rect: CURSOR_CONFIG.LOCKED });
        }
        overlay.setLayers(id ? [id] : []);
    });
    watch(() => tool.dragPixel, (pixel) => {
        if (tool.prepared !== 'select') return;
        if (pixel) {
            const id = nodes.topVisibleIdAt(pixel);
            if (id && nodes.getProperty(id, 'locked')) {
                tool.setCursor({ stroke: CURSOR_CONFIG.LOCKED, rect: CURSOR_CONFIG.LOCKED });
                return;
            }
        }
        tool.setCursor({ stroke: CURSOR_CONFIG.ADD_STROKE, rect: CURSOR_CONFIG.ADD_RECT });
    });
    watch(() => tool.previewPixels, (pixels) => {
        if (tool.prepared !== 'select') return;
        const intersectedIds = [];
        for (const coord of pixels) {
            const id = nodes.topVisibleIdAt(coord);
            if (id === null) continue;
            if (!nodes.getProperty(id, 'locked')) intersectedIds.push(id);
        }
        const highlightIds = [];
        intersectedIds.forEach(id => {
            if (mode === 'remove' && !nodeTree.isSelected(id)) return;
            if (mode === 'add' && nodeTree.isSelected(id)) return;
            highlightIds.push(id);
        });
        overlay.setLayers(highlightIds);
    });
    watch(() => tool.affectedPixels, (pixels) => {
        if (tool.prepared !== 'select') return;
        if (pixels.length > 0) {
            const intersectedIds = new Set();
            for (const coord of pixels) {
            const id = nodes.topVisibleIdAt(coord);
            if (id !== null && !nodes.getProperty(id, 'locked')) intersectedIds.add(id);
            }
            const currentSelection = new Set(mode === 'select' ? [] : nodeTree.selectedLayerIds);
            if (mode === 'add') {
                intersectedIds.forEach(id => currentSelection.add(id));
            } else if (mode === 'remove') {
                intersectedIds.forEach(id => currentSelection.delete(id));
            } else {
                intersectedIds.forEach(id => currentSelection.add(id));
            }
            nodeTree.replaceSelection([...currentSelection]);
            layerPanel.setScrollRule({ type: 'follow', target: nodeTree.selectedLayerIds[0] });
        } else if (mode === 'select') {
            nodeTree.clearSelection();
        }
    });
    return {};
});

export const useGlobalEraseToolService = defineStore('globalEraseToolService', () => {
    const tool = useToolSelectionService();
    const overlayService = useOverlayService();
    const overlay = overlayService.addOverlay('globalErase');
    overlay.config.value = OVERLAY_CONFIG.REMOVE;
    const { nodeTree, nodes } = useStore();
    watch(() => tool.prepared === 'globalErase', (isGlobalErase) => {
        if (!isGlobalErase) {
            overlay.clear();
            return;
        }
        tool.setCursor({ stroke: CURSOR_CONFIG.GLOBAL_ERASE_STROKE, rect: CURSOR_CONFIG.GLOBAL_ERASE_RECT });
    });
    watch(() => tool.hoverPixel, (pixel) => {
        if (tool.prepared !== 'globalErase') return;
        overlay.setPixels(pixel ? [pixel] : []);
    });
    watch(() => tool.dragPixel, (pixel) => {
        if (tool.prepared !== 'globalErase') return;
        if (pixel){
            const lockedIds = nodeTree.layerOrder.filter(id => nodes.getProperty(id, 'locked'));
            for (const id of lockedIds) {
                const lockedPixels = new Set((nodes.getProperty(id, 'pixels') || []).map(coordToKey));
                if (lockedPixels.has(coordToKey(pixel))) {
                    tool.setCursor({ stroke: CURSOR_CONFIG.LOCKED, rect: CURSOR_CONFIG.LOCKED });
                    return;
                }
            }
        }
        tool.setCursor({ stroke: CURSOR_CONFIG.GLOBAL_ERASE_STROKE, rect: CURSOR_CONFIG.GLOBAL_ERASE_RECT });
    });
    watch(() => tool.previewPixels, (pixels) => {
        if (tool.prepared !== 'globalErase') return;
        const erasablePixels = [];
        if (pixels.length) {
            const unlockedIds = nodeTree.layerOrder.filter(id => !nodes.getProperty(id, 'locked'));
            const unlockedPixels = new Set();
            for (const id of unlockedIds) {
                (nodes.getProperty(id, 'pixels') || []).forEach(coord => unlockedPixels.add(coordToKey(coord)));
            }
            for (const coord of pixels) {
                if (unlockedPixels.has(coordToKey(coord))) erasablePixels.push(coord);
            }
        }
        overlay.setPixels(erasablePixels);
    });
    watch(() => tool.affectedPixels, (pixels) => {
        if (tool.prepared !== 'globalErase' || !pixels.length) return;
        const targetIds = (nodeTree.layerSelectionExists ? nodeTree.selectedLayerIds : nodeTree.layerOrder)
            .filter(id => !nodes.getProperty(id, 'locked'));
        for (const id of targetIds) {
            const targetKeys = new Set((nodes.getProperty(id, "pixels") || []).map(coordToKey));
            const pixelsToRemove = [];
            for (const coord of pixels) {
                if (targetKeys.has(coordToKey(coord))) pixelsToRemove.push(coord);
            }
            if (pixelsToRemove.length) nodes.removePixelsFromLayer(id, pixelsToRemove);
        }
    });
    return {};
});