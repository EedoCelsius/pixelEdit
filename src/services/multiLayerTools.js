import { defineStore } from 'pinia';
import { watch, computed } from 'vue';
import { useToolSelectionService } from './toolSelection';
import { useLayerPanelService } from './layerPanel';
import { useLayerQueryService } from './layerQuery';
import { useOverlayService } from './overlay';
import { useStore } from '../stores';
import { useToolbarStore } from '../stores/toolbar';
import { OVERLAY_STYLES, CURSOR_STYLE } from '@/constants';
import { indexToCoord } from '../utils/pixels.js';
import { PIXEL_ORIENTATIONS, OT } from '../stores/pixels';
import stageIcons from '../image/stage_toolbar';

export const useSelectToolService = defineStore('selectToolService', () => {
    const tool = useToolSelectionService();
    const overlayService = useOverlayService();
    const overlayId = overlayService.createOverlay();
    overlayService.setStyles(overlayId, OVERLAY_STYLES.ADD);
    const layerPanel = useLayerPanelService();
    const { nodeTree, nodes, keyboardEvent: keyboardEvents } = useStore();
    const layerQuery = useLayerQueryService();
    const usable = computed(() => tool.shape === 'stroke' || tool.shape === 'rect');
    const toolbar = useToolbarStore();
    toolbar.register({ type: 'select', name: 'Select', icon: stageIcons.select, usable });
    let mode = 'select';
    watch(() => tool.current === 'select', (isSelect) => {
        if (!isSelect) {
            overlayService.clear(overlayId);
            return;
        }
        tool.setCursor({ stroke: CURSOR_STYLE.ADD_STROKE, rect: CURSOR_STYLE.ADD_RECT });
    });
    watch(() => tool.hoverPixel, (pixel) => {
        if (tool.current !== 'select') return;
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

        if (!id)
            overlayService.setPixels(overlayId, [pixel]);
        else {
            if (nodes.locked(id))
                tool.setCursor({ stroke: CURSOR_STYLE.LOCKED, rect: CURSOR_STYLE.LOCKED });
            else
                overlayService.setLayers(overlayId, [id]);
        }

    });
    watch(() => tool.dragPixel, (pixel) => {
        if (tool.current !== 'select') return;
        if (pixel) {
            const id = layerQuery.topVisibleAt(pixel);
            if (id && nodes.locked(id)) {
                tool.setCursor({ stroke: CURSOR_STYLE.LOCKED, rect: CURSOR_STYLE.LOCKED });
                return;
            }
        }
        tool.setCursor({ stroke: CURSOR_STYLE.ADD_STROKE, rect: CURSOR_STYLE.ADD_RECT });
    });
    watch(() => tool.previewPixels, (pixels) => {
        if (tool.current !== 'select') return;
        const intersectedIds = [];
        for (const pixel of pixels) {
            const id = layerQuery.topVisibleAt(pixel);
            if (id === null) continue;
            if (!nodes.locked(id)) intersectedIds.push(id);
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
        if (tool.current !== 'select') return;
        if (pixels.length > 0) {
            const intersectedIds = new Set();
            for (const pixel of pixels) {
                const id = layerQuery.topVisibleAt(pixel);
                if (id !== null && !nodes.locked(id)) intersectedIds.add(id);
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
    return { usable };
});

export const useOrientationToolService = defineStore('orientationToolService', () => {
    const { nodeTree, nodes, pixels: pixelStore, preview } = useStore();
    const tool = useToolSelectionService();
    const layerQuery = useLayerQueryService();
    const usable = computed(() => tool.shape === 'stroke' || tool.shape === 'rect');
    const toolbar = useToolbarStore();
    toolbar.register({ type: 'orientation', name: 'Orientation', icon: stageIcons.orientation, usable });

    watch(() => tool.current === 'orientation', isOrientation => {
        if (!isOrientation) {
            preview.clearOrientationLayers();
            preview.clear();
            return;
        }
        preview.initOrientationRenderer();
        preview.setOrientationLayers(nodeTree.selectedLayerIds);
        tool.setCursor({ stroke: CURSOR_STYLE.CHANGE, rect: CURSOR_STYLE.CHANGE });
    });

    watch(() => tool.hoverPixel, pixel => {
        if (tool.current !== 'orientation' || !pixel) return;
        tool.setCursor({ stroke: CURSOR_STYLE.CHANGE, rect: CURSOR_STYLE.CHANGE });
    });

    watch(() => tool.dragPixel, (pixel, prevPixel) => {
        if (tool.current !== 'orientation' || pixel == null) return;
        const target = layerQuery.topVisibleAt(pixel);
        const editable = nodeTree.selectedLayerIds.length === 0 || nodeTree.selectedLayerIds.includes(target);
        if (target != null && editable) {
            if (nodes.locked(target)) {
                tool.setCursor({ stroke: CURSOR_STYLE.LOCKED, rect: CURSOR_STYLE.LOCKED });
                return;
            }
            if (prevPixel != null) {
                const [px, py] = indexToCoord(pixel);
                const [prevX, prevY] = indexToCoord(prevPixel);
                let next;
                if (prevX === px) {
                    next = OT.VERTICAL;
                    tool.setCursor({ stroke: prevY < py ? CURSOR_STYLE.DOWN : CURSOR_STYLE.UP,
                                     rect: prevY < py ? CURSOR_STYLE.DOWN : CURSOR_STYLE.UP });
                } else {
                    next = OT.HORIZONTAL;
                    tool.setCursor({ stroke: prevX < px ? CURSOR_STYLE.RIGHT : CURSOR_STYLE.LEFT,
                                     rect: prevX < px ? CURSOR_STYLE.RIGHT : CURSOR_STYLE.LEFT });
                }
                preview.updatePixels(target, { [pixel]: next });
            }
        }
    });

    watch(() => tool.affectedPixels, pixels => {
        if (tool.current !== 'orientation') return;
        if (pixels.length === 1) {
            const pixel = pixels[0];
            const target = layerQuery.topVisibleAt(pixel);
            const editable = nodeTree.selectedLayerIds.length === 0 || nodeTree.selectedLayerIds.includes(target);
            if (target != null && editable && !nodes.locked(target)) {
                const current = pixelStore.orientationOf(target, pixel);
                const idx = PIXEL_ORIENTATIONS.indexOf(current);
                const next = PIXEL_ORIENTATIONS[(idx + 1) % PIXEL_ORIENTATIONS.length];
                pixelStore.update(target, { [pixel]: next });
            }
        }
        preview.commitPreview();
    });

    watch(() => nodeTree.selectedLayerIds.slice(), ids => {
        if (tool.current === 'orientation') preview.setOrientationLayers(ids);
    });

    return { usable };
});

export const useGlobalEraseToolService = defineStore('globalEraseToolService', () => {
    const tool = useToolSelectionService();
    const overlayService = useOverlayService();
    const overlayId = overlayService.createOverlay();
    overlayService.setStyles(overlayId, OVERLAY_STYLES.REMOVE);
    const { nodeTree, nodes, pixels: pixelStore, preview } = useStore();
    const usable = computed(() => tool.shape === 'stroke' || tool.shape === 'rect');
    const toolbar = useToolbarStore();
    toolbar.register({ type: 'globalErase', name: 'Global Erase', icon: stageIcons.globalErase, usable });
    watch(() => tool.current === 'globalErase', (isGlobalErase) => {
        if (!isGlobalErase) {
            overlayService.clear(overlayId);
            return;
        }
        tool.setCursor({ stroke: CURSOR_STYLE.GLOBAL_ERASE_STROKE, rect: CURSOR_STYLE.GLOBAL_ERASE_RECT });
    });
    watch(() => tool.hoverPixel, (pixel) => {
        if (tool.current !== 'globalErase') return;
        overlayService.setPixels(overlayId, pixel ? [pixel] : []);
    });
    watch(() => tool.dragPixel, (pixel) => {
        if (tool.current !== 'globalErase') return;
        if (pixel){
            const lockedIds = nodeTree.layerOrder.filter(id => nodes.locked(id));
            for (const id of lockedIds) {
                const lockedPixels = pixelStore.get(id);
                if (lockedPixels.has(pixel)) {
                    tool.setCursor({ stroke: CURSOR_STYLE.LOCKED, rect: CURSOR_STYLE.LOCKED });
                    return;
                }
            }
        }
        tool.setCursor({ stroke: CURSOR_STYLE.GLOBAL_ERASE_STROKE, rect: CURSOR_STYLE.GLOBAL_ERASE_RECT });
    });
    watch(() => tool.previewPixels, (pixels) => {
        if (tool.current !== 'globalErase') return;
        const erasablePixels = [];
        if (pixels.length) {
            const unlockedIds = nodeTree.layerOrder.filter(id => !nodes.locked(id));
            const unlockedPixels = new Set();
            for (const id of unlockedIds) {
                const map = pixelStore.get(id);
                for (const i of map.keys()) unlockedPixels.add(i);
            }
            for (const pixel of pixels) {
                if (unlockedPixels.has(pixel)) erasablePixels.push(pixel);
            }
        }
        overlayService.setPixels(overlayId, erasablePixels);
        preview.clear();
        if (!erasablePixels.length) return;
        const targetLayers = nodeTree.layerSelectionExists ? nodeTree.selectedLayerIds : nodeTree.layerOrder
        for (const layer of targetLayers) {
            if (nodes.locked(id)) return;
            preview.removePixels(layer, erasablePixels);
        }
    });
    watch(() => tool.affectedPixels, (pixels) => {
        if (tool.current !== 'globalErase') return;
        preview.commitPreview();
    });
    return { usable };
});

