import { defineStore } from 'pinia';
import { watch, computed } from 'vue';
import { useToolSelectionService } from './toolSelection';
import { useOverlayService } from './overlay';
import { useLayerPanelService } from './layerPanel';
import { useLayerQueryService } from './layerQuery';
import { useStore } from '../stores';
import { useToolbarStore } from '../stores/toolbar';
import { OVERLAY_STYLES, CURSOR_STYLE } from '@/constants';
import { indexToCoord, ensureDirectionPattern } from '../utils';
import { PIXEL_DIRECTIONS } from '../stores/pixels';
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
            if (nodes.getProperty(id, 'locked'))
                tool.setCursor({ stroke: CURSOR_STYLE.LOCKED, rect: CURSOR_STYLE.LOCKED });
            else
                overlayService.setLayers(overlayId, [id]);
        }

    });
    watch(() => tool.dragPixel, (pixel) => {
        if (tool.current !== 'select') return;
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
        if (tool.current !== 'select') return;
        const intersectedIds = [];
        for (const pixel of pixels) {
            const id = layerQuery.topVisibleAt(pixel);
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
        if (tool.current !== 'select') return;
        if (pixels.length > 0) {
            const intersectedIds = new Set();
            for (const pixel of pixels) {
                const id = layerQuery.topVisibleAt(pixel);
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
    return { usable };
});

export const useDirectionToolService = defineStore('directionToolService', () => {
    const { nodeTree, nodes, pixels: pixelStore } = useStore();
    const tool = useToolSelectionService();
    const layerQuery = useLayerQueryService();
    const overlayService = useOverlayService();
    const usable = computed(() => tool.shape === 'stroke' || tool.shape === 'rect');
    const toolbar = useToolbarStore();
    toolbar.register({ type: 'direction', name: 'Direction', icon: stageIcons.direction, usable });
    const overlays = PIXEL_DIRECTIONS.map(direction => {
        const id = overlayService.createOverlay();
        overlayService.setStyles(id, {
            FILL_COLOR: `url(#${ensureDirectionPattern(direction)})`,
            STROKE_COLOR: 'none',
            STROKE_WIDTH_SCALE: 0,
            FILL_RULE: 'evenodd'
        });
        return id;
    });
    function rebuild() {
        if (tool.current !== 'direction') return;
        const layerIds = nodeTree.selectedLayerIds;
        const showAll = layerIds.length === 0;
        PIXEL_DIRECTIONS.forEach((direction, idx) => {
            const overlayId = overlays[idx];
            overlayService.clear(overlayId);
            if (showAll) {
                const add = new Set();
                for (let i = nodeTree.layerOrder.length - 1; i >= 0; i--) {
                    const id = nodeTree.layerOrder[i];
                    if (!nodes.getProperty(id, 'visibility')) continue;
                    const pixels = pixelStore.getDirectionPixels(direction, id);
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
                    const pixels = pixelStore.getDirectionPixels(direction, id);
                    if (!pixels.length) continue;
                    overlayService.addPixels(overlayId, pixels);
                }
            }
        });
    }
    watch(() => tool.current === 'direction', (isDirection) => {
        if (!isDirection) {
            overlays.forEach(id => overlayService.clear(id));
            return;
        }
        if (!usable.value) return;
        rebuild();
        tool.setCursor({ stroke: CURSOR_STYLE.CHANGE, rect: CURSOR_STYLE.CHANGE });
    });
    watch(() => tool.hoverPixel, (pixel) => {
        if (tool.current !== 'direction' || !pixel) return;
        tool.setCursor({ stroke: CURSOR_STYLE.CHANGE, rect: CURSOR_STYLE.CHANGE });
    });
    watch(() => tool.dragPixel, (pixel, prevPixel) => {
        if (tool.current !== 'direction' || pixel == null) return;
        const target = layerQuery.topVisibleAt(pixel);
        const editable = nodeTree.selectedLayerIds.length === 0 || nodeTree.selectedLayerIds.includes(target);
        if (target != null && editable) {
            if (nodes.getProperty(target, 'locked')) {
                tool.setCursor({ stroke: CURSOR_STYLE.LOCKED, rect: CURSOR_STYLE.LOCKED });
                return;
            }
            if (prevPixel == null) {
                const current = pixelStore.directionOf(target, pixel);
                const idx = PIXEL_DIRECTIONS.indexOf(current);
                const next = PIXEL_DIRECTIONS[(idx + 1) % PIXEL_DIRECTIONS.length];
                pixelStore.addPixels(target, [pixel], next);
            }
            else {
                const [px, py] = indexToCoord(pixel);
                const [prevX, prevY] = indexToCoord(prevPixel);
                if (prevX === px) {
                    pixelStore.setDirection(target, pixel, 'vertical');
                    if (prevY < py)
                        tool.setCursor({ stroke: CURSOR_STYLE.DOWN, rect: CURSOR_STYLE.DOWN });
                    else
                        tool.setCursor({ stroke: CURSOR_STYLE.UP, rect: CURSOR_STYLE.UP });
                }
                else {
                    pixelStore.setDirection(target, pixel, 'horizontal');
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
    const { nodeTree, nodes, pixels: pixelStore } = useStore();
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
            const lockedIds = nodeTree.layerOrder.filter(id => nodes.getProperty(id, 'locked'));
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
    watch(() => tool.previewPixels, (pixels) => {
        if (tool.current !== 'globalErase') return;
        const erasablePixels = [];
        if (pixels.length) {
            const unlockedIds = nodeTree.layerOrder.filter(id => !nodes.getProperty(id, 'locked'));
            const unlockedPixels = new Set();
            for (const id of unlockedIds) {
                pixelStore.get(id).forEach(pixel => unlockedPixels.add(pixel));
            }
            for (const pixel of pixels) {
                if (unlockedPixels.has(pixel)) erasablePixels.push(pixel);
            }
        }
        overlayService.setPixels(overlayId, erasablePixels);
    });
    watch(() => tool.affectedPixels, (pixels) => {
        if (tool.current !== 'globalErase' || !pixels.length) return;
        const targetIds = (nodeTree.layerSelectionExists ? nodeTree.selectedLayerIds : nodeTree.layerOrder)
            .filter(id => !nodes.getProperty(id, 'locked'));
        for (const id of targetIds) {
            const targetPixels = new Set(pixelStore.get(id));
            const pixelsToRemove = [];
            for (const pixel of pixels) {
                if (targetPixels.has(pixel)) pixelsToRemove.push(pixel);
            }
            if (pixelsToRemove.length) pixelStore.removePixels(id, pixelsToRemove);
        }
    });
    return { usable };
});

