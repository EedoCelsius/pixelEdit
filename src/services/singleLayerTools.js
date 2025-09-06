import { defineStore } from 'pinia';
import { watch, computed } from 'vue';
import { useToolSelectionService } from './toolSelection';
import { useOverlayService } from './overlay';
import { useLayerPanelService } from './layerPanel';
import { useLayerQueryService } from './layerQuery';
import { useStore } from '../stores';
import { useToolbarStore } from '../stores/toolbar';
import { OVERLAY_STYLES, CURSOR_STYLE } from '@/constants';
import stageIcons from '../image/stage_toolbar';

export const useDrawToolService = defineStore('drawToolService', () => {
    const tool = useToolSelectionService();
    const overlayService = useOverlayService();
    const overlayId = overlayService.createOverlay();
    overlayService.setStyles(overlayId, OVERLAY_STYLES.ADD);
    const { nodeTree, nodes, pixels: pixelStore } = useStore();
    const usable = computed(() => (tool.shape === 'stroke' || tool.shape === 'rect') && nodeTree.selectedLayerCount === 1);
    const toolbar = useToolbarStore();
    toolbar.register({ type: 'draw', name: 'Draw', icon: stageIcons.draw, usable });
    watch(() => tool.current === 'draw', (isDraw) => {
        if (!isDraw) {
            overlayService.clear(overlayId);
            return;
        }
        if (!usable.value) return;
        tool.setCursor({ stroke: CURSOR_STYLE.DRAW_STROKE, rect: CURSOR_STYLE.DRAW_RECT });
    });
    watch(() => tool.hoverPixel, (pixel) => {
        if (tool.current !== 'draw') return;
        overlayService.setPixels(overlayId, pixel ? [pixel] : []);
    });
    watch(() => tool.dragPixel, (pixel) => {
        if (tool.current !== 'draw' || !usable.value) return;
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
        if (tool.current !== 'draw' || !usable.value) return;
        overlayService.setPixels(overlayId, pixels);
    });
    watch(() => tool.affectedPixels, (pixels) => {
        if (tool.current !== 'draw' || !usable.value) return;
        const id = nodeTree.selectedLayerIds[0];
        if (nodes.getProperty(id, 'locked')) return;
        pixelStore.addPixels(id, pixels);
    });
    return { usable };
});

export const useEraseToolService = defineStore('eraseToolService', () => {
    const tool = useToolSelectionService();
    const overlayService = useOverlayService();
    const overlayId = overlayService.createOverlay();
    overlayService.setStyles(overlayId, OVERLAY_STYLES.REMOVE);
    const { nodeTree, nodes, pixels: pixelStore } = useStore();
    const usable = computed(() => (tool.shape === 'stroke' || tool.shape === 'rect') && nodeTree.selectedLayerCount === 1);
    const toolbar = useToolbarStore();
    toolbar.register({ type: 'erase', name: 'Erase', icon: stageIcons.erase, usable });
    watch(() => tool.current === 'erase', (isErase) => {
        if (!isErase) {
            overlayService.clear(overlayId);
            return;
        }
        if (!usable.value) return;
        tool.setCursor({ stroke: CURSOR_STYLE.ERASE_STROKE, rect: CURSOR_STYLE.ERASE_RECT });
    });
    watch(() => tool.hoverPixel, (pixel) => {
        if (tool.current !== 'erase') return;
        overlayService.setPixels(overlayId, pixel ? [pixel] : []);
    });
    watch(() => tool.dragPixel, (pixel) => {
        if (tool.current !== 'erase' || !usable.value) return;
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
        if (tool.current !== 'erase' || !usable.value) return;
        const sourceId = nodeTree.selectedLayerIds[0];
        const sourcePixels = new Set(pixelStore.get(sourceId));
        overlayService.setPixels(overlayId, pixels.filter(pixel => sourcePixels.has(pixel)));
    });
    watch(() => tool.affectedPixels, (pixels) => {
        if (tool.current !== 'erase' || !usable.value) return;
        const id = nodeTree.selectedLayerIds[0];
       if (nodes.getProperty(id, 'locked')) return;
        pixelStore.removePixels(id, pixels);
    });
    return { usable };
});

export const useCutToolService = defineStore('cutToolService', () => {
    const tool = useToolSelectionService();
    const overlayService = useOverlayService();
    const overlayId = overlayService.createOverlay();
    overlayService.setStyles(overlayId, OVERLAY_STYLES.REMOVE);
    const layerPanel = useLayerPanelService();
    const { nodeTree, nodes, pixels: pixelStore } = useStore();
    const usable = computed(() => (tool.shape === 'stroke' || tool.shape === 'rect') && nodeTree.selectedLayerCount === 1);
    const toolbar = useToolbarStore();
    toolbar.register({ type: 'cut', name: 'Cut', icon: stageIcons.cut, usable });
    watch(() => tool.current === 'cut', (isCut) => {
        if (!isCut) {
            overlayService.clear(overlayId);
            return;
        }
        if (!usable.value) return;
        tool.setCursor({ stroke: CURSOR_STYLE.CUT_STROKE, rect: CURSOR_STYLE.CUT_RECT });
    });
    watch(() => tool.hoverPixel, (pixel) => {
        if (tool.current !== 'cut') return;
        overlayService.setPixels(overlayId, pixel ? [pixel] : []);
    });
    watch(() => tool.dragPixel, (pixel) => {
        if (tool.current !== 'cut' || !usable.value) return;
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
        if (tool.current !== 'cut' || !usable.value) return;
        overlayService.setPixels(overlayId, pixels);
    });
    watch(() => tool.affectedPixels, (pixels) => {
        if (tool.current !== 'cut' || !usable.value) return;
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
    return { usable };
});

export const useTopToolService = defineStore('topToolService', () => {
    const tool = useToolSelectionService();
    const overlayService = useOverlayService();
    const overlayId = overlayService.createOverlay();
    overlayService.setStyles(overlayId, OVERLAY_STYLES.ADD);
    const layerPanel = useLayerPanelService();
    const layerQuery = useLayerQueryService();
    const { nodeTree, nodes } = useStore();
    const usable = computed(() => (tool.shape === 'stroke' || tool.shape === 'rect') && nodeTree.selectedIds.length === 1);
    const toolbar = useToolbarStore();
    toolbar.register({ type: 'top', name: 'To Top', icon: stageIcons.top, usable });
    watch(() => tool.current === 'top', (isTop) => {
        if (!isTop) {
            overlayService.clear(overlayId);
            return;
        }
        if (!usable.value) return;
        tool.setCursor({ stroke: CURSOR_STYLE.TOP, rect: CURSOR_STYLE.TOP });
    });
    watch(() => tool.hoverPixel, (pixel) => {
        if (tool.current !== 'top' || !usable.value) return;
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
        if (tool.current !== 'top' || !usable.value || !pixel) return;
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
    return { usable };
});

