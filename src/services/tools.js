import { defineStore } from 'pinia';
import { watch } from 'vue';
import { useToolSelectionService } from './toolSelection';
import { useOverlayService } from './overlay';
import { useLayerPanelService } from './layerPanel';
import { useLayerQueryService } from './layerQuery';
import { useStore } from '../stores';
import { OVERLAY_STYLES, CURSOR_STYLE } from '@/constants';
import { coordToKey, keyToCoord, ensurePathPattern } from '../utils';
import { PIXEL_KINDS } from '../stores/pixels';

export const useDrawToolService = defineStore('drawToolService', () => {
    const tool = useToolSelectionService();
    const overlayService = useOverlayService();
    const overlayId = overlayService.createOverlay();
    overlayService.setStyles(overlayId, OVERLAY_STYLES.ADD);
    const { nodeTree, nodes, pixels: pixelStore } = useStore();
    watch(() => tool.prepared === 'draw', (isDraw) => {
        if (!isDraw) {
            overlayService.clear(overlayId);
            return;
        }
        tool.setCursor({ stroke: CURSOR_STYLE.DRAW_STROKE, rect: CURSOR_STYLE.DRAW_RECT });
    });
    watch(() => tool.hoverPixel, (pixel) => {
        if (tool.prepared !== 'draw') return;
        overlayService.setPixels(overlayId, pixel ? [pixel] : []);
    });
    watch(() => tool.dragPixel, (pixel) => {
        if (tool.prepared !== 'draw' || nodeTree.selectedLayerCount !== 1) return;
        const sourceId = nodeTree.selectedLayerIds[0];
        if (nodes.getProperty(sourceId, 'locked')) {
            if (pixel)
                tool.setCursor({ stroke: CURSOR_STYLE.LOCKED, rect: CURSOR_STYLE.LOCKED });
            else
                tool.setCursor({ stroke: CURSOR_STYLE.DRAW_STROKE, rect: CURSOR_STYLE.DRAW_RECT });
            return;
        }
    });
    watch(() => tool.previewPixels, (pixels) => {
        if (tool.prepared !== 'draw' || nodeTree.selectedLayerCount !== 1) return;
        overlayService.setPixels(overlayId, pixels);
    });
    watch(() => tool.affectedPixels, (pixels) => {
        if (tool.prepared !== 'draw' || nodeTree.selectedLayerCount !== 1) return;
        const id = nodeTree.selectedLayerIds[0];
        if (nodes.getProperty(id, 'locked')) return;
        pixelStore.addPixels(id, pixels);
    });
    return {};
});

export const useEraseToolService = defineStore('eraseToolService', () => {
    const tool = useToolSelectionService();
    const overlayService = useOverlayService();
    const overlayId = overlayService.createOverlay();
    overlayService.setStyles(overlayId, OVERLAY_STYLES.REMOVE);
    const { nodeTree, nodes, pixels: pixelStore } = useStore();
    watch(() => tool.prepared === 'erase', (isErase) => {
        if (!isErase) {
            overlayService.clear(overlayId);
            return;
        }
        tool.setCursor({ stroke: CURSOR_STYLE.ERASE_STROKE, rect: CURSOR_STYLE.ERASE_RECT });
    });
    watch(() => tool.hoverPixel, (pixel) => {
        if (tool.prepared !== 'erase') return;
        overlayService.setPixels(overlayId, pixel ? [pixel] : []);
    });
    watch(() => tool.dragPixel, (pixel) => {
        if (tool.prepared !== 'erase' || nodeTree.selectedLayerCount !== 1) return;
        const sourceId = nodeTree.selectedLayerIds[0];
        if (nodes.getProperty(sourceId, 'locked')) {
            const sourceKeys = new Set(pixelStore.get(sourceId).map(coordToKey));
            if (pixel && sourceKeys.has(coordToKey(pixel)))
                tool.setCursor({ stroke: CURSOR_STYLE.LOCKED, rect: CURSOR_STYLE.LOCKED });
            else
                tool.setCursor({ stroke: CURSOR_STYLE.ERASE_STROKE, rect: CURSOR_STYLE.ERASE_RECT });
        }
    });
    watch(() => tool.previewPixels, (pixels) => {
        if (tool.prepared !== 'erase' || nodeTree.selectedLayerCount !== 1) return;
        overlayService.setPixels(overlayId, pixels);
    });
    watch(() => tool.affectedPixels, (pixels) => {
        if (tool.prepared !== 'erase' || nodeTree.selectedLayerCount !== 1) return;
        const id = nodeTree.selectedLayerIds[0];
        if (nodes.getProperty(id, 'locked')) return;
        pixelStore.removePixels(id, pixels);
    });
    return {};
});

export const useCutToolService = defineStore('cutToolService', () => {
    const tool = useToolSelectionService();
    const overlayService = useOverlayService();
    const overlayId = overlayService.createOverlay();
    overlayService.setStyles(overlayId, OVERLAY_STYLES.REMOVE);
    const layerPanel = useLayerPanelService();
    const { nodeTree, nodes, pixels: pixelStore } = useStore();
    watch(() => tool.prepared === 'cut', (isCut) => {
        if (!isCut) {
            overlayService.clear(overlayId);
            return;
        }
        tool.setCursor({ stroke: CURSOR_STYLE.CUT_STROKE, rect: CURSOR_STYLE.CUT_RECT });
    });
    watch(() => tool.hoverPixel, (pixel) => {
        if (tool.prepared !== 'cut') return;
        overlayService.setPixels(overlayId, pixel ? [pixel] : []);
    });
    watch(() => tool.dragPixel, (pixel) => {
        if (tool.prepared !== 'cut' || nodeTree.selectedLayerCount !== 1) return;
        const sourceId = nodeTree.selectedLayerIds[0];
        if (nodes.getProperty(sourceId, 'locked')) {
            const sourceKeys = new Set(pixelStore.get(sourceId).map(coordToKey));
            if (pixel && sourceKeys.has(coordToKey(pixel)))
                tool.setCursor({ stroke: CURSOR_STYLE.LOCKED, rect: CURSOR_STYLE.LOCKED });
            else
                tool.setCursor({ stroke: CURSOR_STYLE.CUT_STROKE, rect: CURSOR_STYLE.CUT_RECT });
        }
    });
    watch(() => tool.previewPixels, (pixels) => {
        if (tool.prepared !== 'cut' || nodeTree.selectedLayerCount !== 1) return;
        overlayService.setPixels(overlayId, pixels);
    });
    watch(() => tool.affectedPixels, (pixels) => {
        if (tool.prepared !== 'cut' || nodeTree.selectedLayerCount !== 1) return;
        const sourceId = nodeTree.selectedLayerIds[0];
        if (nodes.getProperty(sourceId, 'locked')) return;
        const sourceKeys = new Set(pixelStore.get(sourceId).map(coordToKey));

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

        pixelStore.removePixels(sourceId, cutCoords);
        const id = nodes.createLayer({
            name: `Cut of ${nodes.getProperty(sourceId, 'name')}`,
            color: nodes.getProperty(sourceId, 'color'),
            visibility: nodes.getProperty(sourceId, 'visibility'),
            attributes: nodes.getProperty(sourceId, 'attributes'),
        });
        if (cutCoords.length) pixelStore.set(id, cutCoords);
        nodeTree.insert([id], sourceId, false);

        nodeTree.replaceSelection([sourceId]);
        layerPanel.setScrollRule({ type: 'follow', target: sourceId });
    });
    return {};
});

export const useTopToolService = defineStore('topToolService', () => {
    const tool = useToolSelectionService();
    const overlayService = useOverlayService();
    const overlayId = overlayService.createOverlay();
    overlayService.setStyles(overlayId, OVERLAY_STYLES.ADD);
    const layerPanel = useLayerPanelService();
    const layerQuery = useLayerQueryService();
    const { nodeTree, nodes } = useStore();
    watch(() => tool.prepared === 'top', (isTop) => {
        if (!isTop) {
            overlayService.clear(overlayId);
            return;
        }
        tool.setCursor({ stroke: CURSOR_STYLE.TOP, rect: CURSOR_STYLE.TOP });
    });
    watch(() => tool.hoverPixel, (pixel) => {
        if (tool.prepared !== 'top' || nodeTree.selectedIds.length !== 1) return;
        if (!pixel) {
            overlayService.clear(overlayId);
            return;
        }
        const id = layerQuery.topVisibleAt(pixel);
        if (id && nodes.getProperty(id, 'locked')) {
            tool.setCursor({ stroke: CURSOR_STYLE.LOCKED, rect: CURSOR_STYLE.LOCKED });
        }
        else {
            tool.setCursor({ stroke: CURSOR_STYLE.TOP, rect: CURSOR_STYLE.TOP });
        }
        overlayService.setLayers(overlayId, id ? [id] : []);
    });
    watch(() => tool.dragPixel, (pixel) => {
        if (tool.prepared !== 'top' || nodeTree.selectedIds.length !== 1 || !pixel) return;
        const id = layerQuery.topVisibleAt(pixel);
        if (!id) return;
        if (nodes.getProperty(id, 'locked')) {
            tool.setCursor({ stroke: CURSOR_STYLE.LOCKED, rect: CURSOR_STYLE.LOCKED });
        }
        else {
            nodeTree.insert([id], nodeTree.selectedIds[0], false);
            nodeTree.replaceSelection([id]);
            layerPanel.setScrollRule({ type: 'follow', target: id });
            tool.setCursor({ stroke: CURSOR_STYLE.TOP, rect: CURSOR_STYLE.TOP });
        }
    });
    return {};
});

export const useSelectService = defineStore('selectService', () => {
    const tool = useToolSelectionService();
    const overlayService = useOverlayService();
    const overlayId = overlayService.createOverlay();
    overlayService.setStyles(overlayId, OVERLAY_STYLES.ADD);
    const layerPanel = useLayerPanelService();
    const { nodeTree, nodes, keyboardEvent: keyboardEvents } = useStore();
    const layerQuery = useLayerQueryService();
    let mode = 'select';
    watch(() => tool.prepared === 'select', (isSelect) => {
        if (!isSelect) {
            overlayService.clear(overlayId);
            return;
        }
        tool.setCursor({ stroke: CURSOR_STYLE.ADD_STROKE, rect: CURSOR_STYLE.ADD_RECT });
    });
    watch(() => tool.hoverPixel, (pixel) => {
        if (tool.prepared !== 'select') return;
        if (!pixel) {
            overlayService.clear(overlayId);
            return;
        }
        const id = layerQuery.topVisibleAt(pixel);
        if (!keyboardEvents.isPressed('Shift')) {
            mode = 'select';
            overlayService.setStyles(overlayId, OVERLAY_STYLES.ADD);
            tool.setCursor({ stroke: CURSOR_STYLE.ADD_STROKE, rect: CURSOR_STYLE.ADD_RECT });
        } else if (nodeTree.selectedLayerIds.includes(id)) {
            mode = 'remove';
            overlayService.setStyles(overlayId, OVERLAY_STYLES.REMOVE);
            tool.setCursor({ stroke: CURSOR_STYLE.REMOVE_STROKE, rect: CURSOR_STYLE.REMOVE_RECT });
        } else {
            mode = 'add';
            overlayService.setStyles(overlayId, OVERLAY_STYLES.ADD);
            tool.setCursor({ stroke: CURSOR_STYLE.ADD_STROKE, rect: CURSOR_STYLE.ADD_RECT });
        }

        if (id && nodes.getProperty(id, 'locked')) {
            tool.setCursor({ stroke: CURSOR_STYLE.LOCKED, rect: CURSOR_STYLE.LOCKED });
        }
        overlayService.setLayers(overlayId, id ? [id] : []);
    });
    watch(() => tool.dragPixel, (pixel) => {
        if (tool.prepared !== 'select') return;
        if (pixel) {
            const id = layerQuery.topVisibleAt(pixel);
            if (id && nodes.getProperty(id, 'locked')) {
                tool.setCursor({ stroke: CURSOR_STYLE.LOCKED, rect: CURSOR_STYLE.LOCKED });
                return;
            }
        }
        tool.setCursor({ stroke: CURSOR_STYLE.ADD_STROKE, rect: CURSOR_STYLE.ADD_RECT });
    });
    watch(() => tool.previewPixels, (pixels) => {
        if (tool.prepared !== 'select') return;
        const intersectedIds = [];
        for (const coord of pixels) {
            const id = layerQuery.topVisibleAt(coord);
            if (id === null) continue;
            if (!nodes.getProperty(id, 'locked')) intersectedIds.push(id);
        }
        const highlightIds = [];
        intersectedIds.forEach(id => {
            if (mode === 'remove' && !nodeTree.selectedLayerIds.includes(id)) return;
            if (mode === 'add' && nodeTree.selectedLayerIds.includes(id)) return;
            highlightIds.push(id);
        });
        overlayService.setLayers(overlayId, highlightIds);
    });
    watch(() => tool.affectedPixels, (pixels) => {
        if (tool.prepared !== 'select') return;
        if (pixels.length > 0) {
            const intersectedIds = new Set();
            for (const coord of pixels) {
            const id = layerQuery.topVisibleAt(coord);
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

export const usePathToolService = defineStore('pathToolService', () => {
    const { nodeTree, pixels: pixelStore } = useStore();
    const tool = useToolSelectionService();
    const layerQuery = useLayerQueryService();
    const overlayService = useOverlayService();
    const overlays = PIXEL_KINDS.map(kind => {
        const id = overlayService.createOverlay();
        overlayService.setStyles(id, {
            FILL_COLOR: `url(#${ensurePathPattern(kind)})`,
            STROKE_COLOR: 'none',
            STROKE_WIDTH_SCALE: 0,
            FILL_RULE: 'evenodd'
        });
        return id;
    });
    function rebuild() {
        if (tool.prepared !== 'path') return;
        const layerIds = nodeTree.selectedLayerIds;
        PIXEL_KINDS.forEach((kind, idx) => {
            const overlayId = overlays[idx];
            overlayService.clear(overlayId);
            for (const id of layerIds) {
                const set = pixelStore[kind][id];
                if (!set) continue;
                overlayService.addPixels(overlayId, [...set].map(keyToCoord));
            }
        });
    }
    watch(() => tool.prepared === 'path', (isPath) => {
        console.log(0)
        if (!isPath) {
            overlays.forEach(id => overlayService.clear(id));
            return;
        }
        rebuild();
        tool.setCursor({ stroke: CURSOR_STYLE.CHANGE, rect: CURSOR_STYLE.CHANGE });
    });
    watch(() => tool.hoverPixel, (pixel) => {
        if (tool.prepared !== 'path' || !pixel) return;
        tool.setCursor({ stroke: CURSOR_STYLE.CHANGE, rect: CURSOR_STYLE.CHANGE });
    });
    watch(() => tool.dragPixel, (pixel, prevPixel) => {
        if (tool.prepared !== 'path' || !pixel) return;
        const target = layerQuery.topVisibleAt(pixel);
        if (nodeTree.selectedLayerIds.includes(target)) {
            if (!prevPixel) {
                pixelStore.cycleKind(target, pixel);
            }
            else if (prevPixel[0] === pixel[0]) {
                if (prevPixel[1] < pixel[1]) {
                    pixelStore.changeKind(target, pixel, 'down');
                    tool.setCursor({ stroke: CURSOR_STYLE.DOWN, rect: CURSOR_STYLE.DOWN });
                }
                else {
                    pixelStore.changeKind(target, pixel, 'up');
                    tool.setCursor({ stroke: CURSOR_STYLE.UP, rect: CURSOR_STYLE.UP });
                }
            }
            else {
                if (prevPixel[0] < pixel[0]) {
                    pixelStore.changeKind(target, pixel, 'right');
                    tool.setCursor({ stroke: CURSOR_STYLE.RIGHT, rect: CURSOR_STYLE.RIGHT });
                }
                else {
                    pixelStore.changeKind(target, pixel, 'left');
                    tool.setCursor({ stroke: CURSOR_STYLE.LEFT, rect: CURSOR_STYLE.LEFT });
                }
            }
        }
        rebuild();
    });
    watch(() => nodeTree.selectedIds, rebuild);
    return {};
});

export const useGlobalEraseToolService = defineStore('globalEraseToolService', () => {
    const tool = useToolSelectionService();
    const overlayService = useOverlayService();
    const overlayId = overlayService.createOverlay();
    overlayService.setStyles(overlayId, OVERLAY_STYLES.REMOVE);
    const { nodeTree, nodes } = useStore();
    watch(() => tool.prepared === 'globalErase', (isGlobalErase) => {
        if (!isGlobalErase) {
            overlayService.clear(overlayId);
            return;
        }
        tool.setCursor({ stroke: CURSOR_STYLE.GLOBAL_ERASE_STROKE, rect: CURSOR_STYLE.GLOBAL_ERASE_RECT });
    });
    watch(() => tool.hoverPixel, (pixel) => {
        if (tool.prepared !== 'globalErase') return;
        overlayService.setPixels(overlayId, pixel ? [pixel] : []);
    });
    watch(() => tool.dragPixel, (pixel) => {
        if (tool.prepared !== 'globalErase') return;
        if (pixel){
            const lockedIds = nodeTree.layerOrder.filter(id => nodes.getProperty(id, 'locked'));
            for (const id of lockedIds) {
                const lockedPixels = new Set(pixelStore.get(id).map(coordToKey));
                if (lockedPixels.has(coordToKey(pixel))) {
                    tool.setCursor({ stroke: CURSOR_STYLE.LOCKED, rect: CURSOR_STYLE.LOCKED });
                    return;
                }
            }
        }
        tool.setCursor({ stroke: CURSOR_STYLE.GLOBAL_ERASE_STROKE, rect: CURSOR_STYLE.GLOBAL_ERASE_RECT });
    });
    watch(() => tool.previewPixels, (pixels) => {
        if (tool.prepared !== 'globalErase') return;
        const erasablePixels = [];
        if (pixels.length) {
            const unlockedIds = nodeTree.layerOrder.filter(id => !nodes.getProperty(id, 'locked'));
            const unlockedPixels = new Set();
            for (const id of unlockedIds) {
                pixelStore.get(id).forEach(coord => unlockedPixels.add(coordToKey(coord)));
            }
            for (const coord of pixels) {
                if (unlockedPixels.has(coordToKey(coord))) erasablePixels.push(coord);
            }
        }
        overlayService.setPixels(overlayId, erasablePixels);
    });
    watch(() => tool.affectedPixels, (pixels) => {
        if (tool.prepared !== 'globalErase' || !pixels.length) return;
        const targetIds = (nodeTree.layerSelectionExists ? nodeTree.selectedLayerIds : nodeTree.layerOrder)
            .filter(id => !nodes.getProperty(id, 'locked'));
        for (const id of targetIds) {
            const targetKeys = new Set(pixelStore.get(id).map(coordToKey));
            const pixelsToRemove = [];
            for (const coord of pixels) {
                if (targetKeys.has(coordToKey(coord))) pixelsToRemove.push(coord);
            }
            if (pixelsToRemove.length) pixelStore.removePixels(id, pixelsToRemove);
        }
    });
    return {};
});
