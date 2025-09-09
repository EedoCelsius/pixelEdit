import { defineStore } from 'pinia';
import { watch, computed } from 'vue';
import { useToolSelectionService } from './toolSelection';
import { useOverlayService } from './overlay';
import { useLayerPanelService } from './layerPanel';
import { useLayerQueryService } from './layerQuery';
import { useStore } from '../stores';
import { useToolbarStore } from '../stores/toolbar';
import { OVERLAY_STYLES, CURSOR_STYLE } from '@/constants';
import { indexToCoord, ensureOrientationPattern, getPixelUnion } from '../utils/pixels.js';
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
    let orientationPreviews = {};
    function ensurePreview(id) {
        if (!orientationPreviews[id]) {
            orientationPreviews[id] = Object.fromEntries(PIXEL_ORIENTATIONS.map(o => [o, new Set()]));
        }
    }
    function toArrayMap(map) {
        const res = {};
        for (const [o, set] of Object.entries(map)) if (set.size) res[o] = [...set];
        return res;
    }
    function orientationOfWithPreview(id, pixel) {
        const previewMap = preview.pixels[id]?.orientationMap;
        if (previewMap) {
            for (const o of PIXEL_ORIENTATIONS) {
                const arr = previewMap[o];
                if (arr && arr.includes(pixel)) return o;
            }
        }
        return pixelStore.orientationOf(id, pixel);
    }
    function orientationPixels(id, orientation) {
        const arr = pixelStore.get(id);
        const target = PIXEL_ORIENTATIONS.indexOf(orientation) + 1;
        const res = [];
        for (let i = 0; i < arr.length; i++) if (arr[i] === target) res.push(i);
        return res;
    }
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
                    let pixels = preview.pixels[id]?.orientationMap?.[orientation];
                    if (!pixels) pixels = orientationPixels(id, orientation);
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
                    let pixels = preview.pixels[id]?.orientationMap?.[orientation];
                    if (!pixels) pixels = orientationPixels(id, orientation);
                    if (!pixels.length) continue;
                    overlayService.addPixels(overlayId, pixels);
                }
            }
        });
    }
    watch(() => tool.current === 'orientation', (isOrientation) => {
        if (!isOrientation) {
            overlays.forEach(id => overlayService.clear(id));
            preview.clearPreview();
            orientationPreviews = {};
            return;
        }
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
            ensurePreview(target);
            for (const o of PIXEL_ORIENTATIONS) orientationPreviews[target][o].delete(pixel);
            let next;
            if (prevPixel == null) {
                const current = orientationOfWithPreview(target, pixel);
                const idx = PIXEL_ORIENTATIONS.indexOf(current);
                next = PIXEL_ORIENTATIONS[(idx + 1) % PIXEL_ORIENTATIONS.length];
            }
            else {
                const [px, py] = indexToCoord(pixel);
                const [prevX, prevY] = indexToCoord(prevPixel);
                if (prevX === px) {
                    next = 'vertical';
                    if (prevY < py)
                        tool.setCursor({ stroke: CURSOR_STYLE.DOWN, rect: CURSOR_STYLE.DOWN });
                    else
                        tool.setCursor({ stroke: CURSOR_STYLE.UP, rect: CURSOR_STYLE.UP });
                }
                else {
                    next = 'horizontal';
                    if (prevX < px)
                        tool.setCursor({ stroke: CURSOR_STYLE.RIGHT, rect: CURSOR_STYLE.RIGHT });
                    else
                        tool.setCursor({ stroke: CURSOR_STYLE.LEFT, rect: CURSOR_STYLE.LEFT });
                }
            }
            orientationPreviews[target][next].add(pixel);
            preview.applyPixelPreview(target, { orientationMap: toArrayMap(orientationPreviews[target]) });
        }
        rebuild();
    });
    watch(() => tool.affectedPixels, (pixels) => {
        if (tool.current !== 'orientation') return;
        if (pixels.length) preview.commitPreview();
        else preview.clearPreview();
        orientationPreviews = {};
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
            preview.clearPreview();
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
                const lockedPixels = new Set(getPixelUnion(pixelStore.get(id)));
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
                const arr = pixelStore.get(id);
                for (let i = 0; i < arr.length; i++) if (arr[i]) unlockedPixels.add(i);
            }
            for (const pixel of pixels) {
                if (unlockedPixels.has(pixel)) erasablePixels.push(pixel);
            }
        }
        overlayService.setPixels(overlayId, erasablePixels);
        preview.clearPreview();
        if (!erasablePixels.length) return;
        const targetIds = (nodeTree.layerSelectionExists ? nodeTree.selectedLayerIds : nodeTree.layerOrder)
            .filter(id => !nodes.locked(id));
        for (const id of targetIds) {
            const targetPixels = new Set(getPixelUnion(pixelStore.get(id)));
            const pixelsToRemove = [];
            for (const pixel of erasablePixels) {
                if (targetPixels.has(pixel)) pixelsToRemove.push(pixel);
            }
            if (pixelsToRemove.length) {
                preview.applyPixelPreview(id, { remove: pixelsToRemove });
            }
        }
    });
    watch(() => tool.affectedPixels, (pixels) => {
        if (tool.current !== 'globalErase') return;
        if (!pixels.length) { preview.clearPreview(); return; }
        preview.commitPreview();
    });
    return { usable };
});

