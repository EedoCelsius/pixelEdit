import { defineStore } from 'pinia';
import { watch } from 'vue';
import { useToolSelectionService } from './toolSelection';
import { useOverlayService } from './overlay';
import { useLayerPanelService } from './layerPanel';
import { useLayerQueryService } from './layerQuery';
import { useHamiltonianService } from './hamiltonian';
import { useStore } from '../stores';
import { OVERLAY_STYLES, CURSOR_STYLE } from '@/constants';
import { indexToCoord, ensureDirectionPattern } from '../utils';
import { PIXEL_DIRECTIONS } from '../stores/pixels';

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
            const sourcePixels = new Set(pixelStore.get(sourceId));
            if (pixel != null && sourcePixels.has(pixel))
                tool.setCursor({ stroke: CURSOR_STYLE.LOCKED, rect: CURSOR_STYLE.LOCKED });
            else
                tool.setCursor({ stroke: CURSOR_STYLE.ERASE_STROKE, rect: CURSOR_STYLE.ERASE_RECT });
        }
    });
    watch(() => tool.previewPixels, (pixels) => {
        if (tool.prepared !== 'erase' || nodeTree.selectedLayerCount !== 1) return;
        const sourceId = nodeTree.selectedLayerIds[0];
        const sourcePixels = new Set(pixelStore.get(sourceId));
        overlayService.setPixels(overlayId, pixels.filter(pixel => sourcePixels.has(pixel)));
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
            const sourcePixels = new Set(pixelStore.get(sourceId));
            if (pixel != null && sourcePixels.has(pixel))
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
        const sourcePixels = new Set(pixelStore.get(sourceId));

        const cutPixels = [];
        for (const pixel of pixels) {
            if (sourcePixels.has(pixel)) {
                cutPixels.push(pixel);
            }
        }

        if (!cutPixels.length || cutPixels.length === sourcePixels.size) return;

        pixelStore.removePixels(sourceId, cutPixels);
        const id = nodes.createLayer({
            name: `Cut of ${nodes.getProperty(sourceId, 'name')}`,
            color: nodes.getProperty(sourceId, 'color'),
            visibility: nodes.getProperty(sourceId, 'visibility'),
            attributes: nodes.getProperty(sourceId, 'attributes'),
        });
        if (cutPixels.length) pixelStore.set(id, cutPixels);
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
            overlayService.setLayers(overlayId, [id]);
            tool.setCursor({ stroke: CURSOR_STYLE.LOCKED, rect: CURSOR_STYLE.LOCKED });
        }
        else {
            overlayService.setPixels(overlayId, [pixel]);
            tool.setCursor({ stroke: CURSOR_STYLE.TOP, rect: CURSOR_STYLE.TOP });
        }
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

export const usePathToolService = defineStore('pathToolService', () => {
    const tool = useToolSelectionService();
    const hamiltonian = useHamiltonianService();
    const layerQuery = useLayerQueryService();
    const { nodeTree, nodes, pixels: pixelStore } = useStore();

    watch(() => tool.prepared === 'path', (isActive) => {
        if (!isActive) return;
        tool.setCursor({ stroke: CURSOR_STYLE.CHANGE, rect: CURSOR_STYLE.CHANGE });
    });

    watch(() => tool.affectedPixels, (pixels) => {
        if (tool.prepared !== 'path' || nodeTree.selectedLayerCount !== 1) return;
        if (pixels.length !== 1) return;

        const startPixel = pixels[0];
        const layerId = nodeTree.selectedLayerIds[0];
        if (!pixelStore.has(layerId, startPixel)) return;

        const allPixels = pixelStore.get(layerId);
        const paths = hamiltonian.traverseWithStart(allPixels, startPixel);
        if (!paths.length) return;

        const color = nodes.getProperty(layerId, 'color');
        const name = nodes.getProperty(layerId, 'name');
        const groupId = nodes.createGroup({ name: `${name} Paths` });

        nodeTree.insert([groupId], layerQuery.lowermost([layerId]), true);

        nodeTree.remove([layerId]);
        nodes.remove([layerId]);
        pixelStore.remove([layerId]);

        paths.forEach((path, idx) => {
            const subGroupId = nodes.createGroup({ name: `Path ${idx + 1}` });
            nodeTree.append([subGroupId], groupId, false);

            const ids = [];
            path.forEach((pixel, j) => {
                const lid = nodes.createLayer({ name: `Pixel ${j + 1}`, color });
                pixelStore.addPixels(lid, [pixel]);
                ids.push(lid);
            });
            nodeTree.append(ids, subGroupId, false);
        });

        nodeTree.replaceSelection([groupId]);
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
        if (tool.prepared !== 'select') return;
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
    return {};
});

export const useDirectionToolService = defineStore('directionToolService', () => {
    const { nodeTree, nodes, pixels: pixelStore } = useStore();
    const tool = useToolSelectionService();
    const layerQuery = useLayerQueryService();
    const overlayService = useOverlayService();
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
        if (tool.prepared !== 'direction') return;
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
                    const set = pixelStore[direction][id];
                    if (!set) continue;
                    for (const pixel of set) {
                        if (layerQuery.topVisibleAt(pixel) === id) {
                            add.add(pixel);
                        }
                    }
                }
                overlayService.addPixels(overlayId, [...add]);
            }
            else {
                for (const id of layerIds) {
                    const set = pixelStore[direction][id];
                    if (!set) continue;
                    overlayService.addPixels(overlayId, [...set]);
                }
            }
        });
    }
    watch(() => tool.prepared === 'direction', (isDirection) => {
        if (!isDirection) {
            overlays.forEach(id => overlayService.clear(id));
            return;
        }
        rebuild();
        tool.setCursor({ stroke: CURSOR_STYLE.CHANGE, rect: CURSOR_STYLE.CHANGE });
    });
    watch(() => tool.hoverPixel, (pixel) => {
        if (tool.prepared !== 'direction' || !pixel) return;
        tool.setCursor({ stroke: CURSOR_STYLE.CHANGE, rect: CURSOR_STYLE.CHANGE });
    });
    watch(() => tool.dragPixel, (pixel, prevPixel) => {
        if (tool.prepared !== 'direction' || pixel == null) return;
        const target = layerQuery.topVisibleAt(pixel);
        const editable = nodeTree.selectedLayerIds.length === 0 || nodeTree.selectedLayerIds.includes(target);
        if (target != null && editable) {
            if (nodes.getProperty(target, 'locked')) {
                tool.setCursor({ stroke: CURSOR_STYLE.LOCKED, rect: CURSOR_STYLE.LOCKED });
                return;
            }
            if (prevPixel == null) {
                const idx = PIXEL_DIRECTIONS.findIndex(k => pixelStore[k][target]?.has(pixel));
                const current = idx >= 0 ? PIXEL_DIRECTIONS[idx] : 'none';
                const next = PIXEL_DIRECTIONS[(PIXEL_DIRECTIONS.indexOf(current) + 1) % PIXEL_DIRECTIONS.length];
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
    return {};
});

export const useGlobalEraseToolService = defineStore('globalEraseToolService', () => {
    const tool = useToolSelectionService();
    const overlayService = useOverlayService();
    const overlayId = overlayService.createOverlay();
    overlayService.setStyles(overlayId, OVERLAY_STYLES.REMOVE);
    const { nodeTree, nodes, pixels: pixelStore } = useStore();
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
        if (tool.prepared !== 'globalErase') return;
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
        if (tool.prepared !== 'globalErase' || !pixels.length) return;
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
    return {};
});
