import { defineStore } from 'pinia';
import { watch, computed } from 'vue';
import { useToolSelectionService } from './toolSelection';
import { useOverlayService } from './overlay';
import { useLayerPanelService } from './layerPanel';
import { useLayerQueryService } from './layerQuery';
import { useStore } from '../stores';
import { useToolbarStore } from '../stores/toolbar';
import { OVERLAY_STYLES, CURSOR_STYLE } from '@/constants';
import { indexToCoord, ensureOrientationPattern } from '../utils/pixels.js';
import { PIXEL_ORIENTATIONS } from '../stores/pixels';
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
        if (!usable.value) return;
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
    const overlayService = useOverlayService();
    const usable = computed(() => tool.shape === 'stroke' || tool.shape === 'rect');
    const toolbar = useToolbarStore();
    toolbar.register({ type: 'orientation', name: 'Orientation', icon: stageIcons.orientation, usable });
    const overlays = PIXEL_ORIENTATIONS.map(orientation => {
        const id = overlayService.createOverlay();
        overlayService.setStyles(id, {
            FILL_COLOR: `url(#${ensureOrientationPattern(orientation)})`,
            STROKE_COLOR: 'none',
            STROKE_WIDTH_SCALE: 0,
            FILL_RULE: 'evenodd'
        });
        return id;
    });
    function rebuild() {
        if (tool.current !== 'orientation') return;
        const layerIds = nodeTree.selectedLayerIds;
        const showAll = layerIds.length === 0;
        PIXEL_ORIENTATIONS.forEach((orientation, idx) => {
            const overlayId = overlays[idx];
            overlayService.clear(overlayId);
            if (showAll) {
                const add = new Set();
                for (let i = nodeTree.layerOrder.length - 1; i >= 0; i--) {
                    const id = nodeTree.layerOrder[i];
                    if (!nodes.visibility(id)) continue;
                    const pixels = pixelStore.getOrientationPixels(orientation, id);
                    if (!pixels.length) continue;
                    for (const pixel of pixels) {
                        if (layerQuery.topVisibleAt(pixel) === id) {
                            add.add(pixel);
                        }
                    }
                }
                overlayService.addPixels(overlayId, [...add]);
            }
            else {
                for (const id of layerIds) {
                    const pixels = pixelStore.getOrientationPixels(orientation, id);
                    if (!pixels.length) continue;
                    overlayService.addPixels(overlayId, pixels);
                }
            }
        });
    }
    watch(() => tool.current === 'orientation', (isOrientation) => {
        if (!isOrientation) {
            overlays.forEach(id => overlayService.clear(id));
            return;
        }
        if (!usable.value) return;
        rebuild();
        tool.setCursor({ stroke: CURSOR_STYLE.CHANGE, rect: CURSOR_STYLE.CHANGE });
    });
    watch(() => tool.hoverPixel, (pixel) => {
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
            if (prevPixel == null) {
                const current = pixelStore.orientationOf(target, pixel);
                const idx = PIXEL_ORIENTATIONS.indexOf(current);
                const next = PIXEL_ORIENTATIONS[(idx + 1) % PIXEL_ORIENTATIONS.length];
                pixelStore.addPixels(target, [pixel], next);
            }
            else {
                const [px, py] = indexToCoord(pixel);
                const [prevX, prevY] = indexToCoord(prevPixel);
                if (prevX === px) {
                    pixelStore.setOrientation(target, pixel, 'vertical');
                    if (prevY < py)
                        tool.setCursor({ stroke: CURSOR_STYLE.DOWN, rect: CURSOR_STYLE.DOWN });
                    else
                        tool.setCursor({ stroke: CURSOR_STYLE.UP, rect: CURSOR_STYLE.UP });
                }
                else {
                    pixelStore.setOrientation(target, pixel, 'horizontal');
                    if (prevX < px)
                        tool.setCursor({ stroke: CURSOR_STYLE.RIGHT, rect: CURSOR_STYLE.RIGHT });
                    else
                        tool.setCursor({ stroke: CURSOR_STYLE.LEFT, rect: CURSOR_STYLE.LEFT });
                }
            }
        }
        rebuild();
    });
    watch(() => nodeTree.selectedIds, rebuild);
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
        if (!usable.value) return;
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
            const lockedPixels = new Set(pixelStore.get(id));
            if (lockedPixels.has(pixel)) {
                tool.setCursor({ stroke: CURSOR_STYLE.LOCKED, rect: CURSOR_STYLE.LOCKED });
                return;
            }
            }
        }
        tool.setCursor({ stroke: CURSOR_STYLE.GLOBAL_ERASE_STROKE, rect: CURSOR_STYLE.GLOBAL_ERASE_RECT });
    });
    let prevEraseMap = new Map();
    watch(() => tool.previewPixels, (pixels) => {
        if (tool.current !== 'globalErase') {
            prevEraseMap = new Map();
            overlayService.clear(overlayId);
            return;
        }
        if (!pixels.length) {
            overlayService.setPixels(overlayId, []);
            prevEraseMap = new Map();
            return;
        }
        const targetIds = (nodeTree.layerSelectionExists ? nodeTree.selectedLayerIds : nodeTree.layerOrder)
            .filter(id => !nodes.locked(id));
        const overlaySet = new Set();
        const nextMap = new Map();
        for (const id of targetIds) {
            const layerPixels = new Set(pixelStore.get(id));
            const toRemove = [];
            for (const pixel of pixels) {
                if (layerPixels.has(pixel)) {
                    toRemove.push(pixel);
                    overlaySet.add(pixel);
                }
            }
            nextMap.set(id, toRemove);
        }
        overlayService.setPixels(overlayId, [...overlaySet]);
        for (const [id, toRemove] of nextMap) {
            const prev = prevEraseMap.get(id) || [];
            const added = toRemove.filter(p => !prev.includes(p));
            const removed = prev.filter(p => !toRemove.includes(p));
            if (added.length || removed.length) preview.applyPixelPreview(id, { add: removed, remove: added });
        }
        for (const [id, prev] of prevEraseMap) {
            if (!nextMap.has(id) && prev.length) {
                preview.applyPixelPreview(id, { add: prev, remove: [] });
            }
        }
        prevEraseMap = nextMap;
    });
    return { usable };
});

