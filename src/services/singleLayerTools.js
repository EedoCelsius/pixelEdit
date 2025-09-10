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
import { getPixelUnion } from '../utils/pixels.js';
import { OT } from '../stores/pixels';

export const useDrawToolService = defineStore('drawToolService', () => {
    const tool = useToolSelectionService();
    const overlayService = useOverlayService();
    const overlayId = overlayService.createOverlay();
    overlayService.setStyles(overlayId, OVERLAY_STYLES.ADD);
    const { nodeTree, nodes, pixels: pixelStore, preview } = useStore();
    const pixelsOf = (id) => getPixelUnion(pixelStore.get(id));
    const usable = computed(() => (tool.shape === 'stroke' || tool.shape === 'rect') && nodeTree.selectedLayerCount === 1);
    const toolbar = useToolbarStore();
    toolbar.register({ type: 'draw', name: 'Draw', icon: stageIcons.draw, usable });
    watch(() => tool.current === 'draw', (isDraw) => {
        if (!isDraw) {
            overlayService.clear(overlayId);
            preview.clear();
            return;
        }
        tool.setCursor({ stroke: CURSOR_STYLE.DRAW_STROKE, rect: CURSOR_STYLE.DRAW_RECT });
    });
    watch(() => tool.hoverPixel, (pixel) => {
        if (tool.current !== 'draw') return;
        overlayService.setPixels(overlayId, pixel ? [pixel] : []);
    });
    watch(() => tool.dragPixel, (pixel) => {
        if (tool.current !== 'draw') return;
        const sourceId = nodeTree.selectedLayerIds[0];
        if (nodes.locked(sourceId)) {
            if (pixel)
                tool.setCursor({ stroke: CURSOR_STYLE.LOCKED, rect: CURSOR_STYLE.LOCKED });
            else
                tool.setCursor({ stroke: CURSOR_STYLE.DRAW_STROKE, rect: CURSOR_STYLE.DRAW_RECT });
            return;
        }
    });
    watch(() => tool.previewPixels, (pixels) => {
        if (tool.current !== 'draw') return;
        overlayService.setPixels(overlayId, pixels);
        const id = nodeTree.selectedLayerIds[0];
        if (nodes.locked(id)) { preview.clear(); return; }
        if (pixels.length) {
            preview.clearPixel(id);
            preview.addPixels(id, pixels, OT.DEFAULT);
        }
        else preview.clear();
    });
    watch(() => tool.affectedPixels, (pixels) => {
        if (tool.current !== 'draw') return;
        const id = nodeTree.selectedLayerIds[0];
        if (nodes.locked(id)) { preview.clear(); return; }
        if (pixels.length) preview.commitPreview();
        else preview.clear();
    });
    return { usable };
});

export const useEraseToolService = defineStore('eraseToolService', () => {
    const tool = useToolSelectionService();
    const overlayService = useOverlayService();
    const overlayId = overlayService.createOverlay();
    overlayService.setStyles(overlayId, OVERLAY_STYLES.REMOVE);
    const { nodeTree, nodes, pixels: pixelStore, preview } = useStore();
    const pixelsOf = (id) => getPixelUnion(pixelStore.get(id));
    const usable = computed(() => (tool.shape === 'stroke' || tool.shape === 'rect') && nodeTree.selectedLayerCount === 1);
    const toolbar = useToolbarStore();
    toolbar.register({ type: 'erase', name: 'Erase', icon: stageIcons.erase, usable });
    watch(() => tool.current === 'erase', (isErase) => {
        if (!isErase) {
            overlayService.clear(overlayId);
            preview.clear();
            return;
        }
        tool.setCursor({ stroke: CURSOR_STYLE.ERASE_STROKE, rect: CURSOR_STYLE.ERASE_RECT });
    });
    watch(() => tool.hoverPixel, (pixel) => {
        if (tool.current !== 'erase') return;
        overlayService.setPixels(overlayId, pixel ? [pixel] : []);
    });
    watch(() => tool.dragPixel, (pixel) => {
        if (tool.current !== 'erase') return;
        const sourceId = nodeTree.selectedLayerIds[0];
        if (nodes.locked(sourceId)) {
            const sourcePixels = new Set(pixelsOf(sourceId));
            if (pixel != null && sourcePixels.has(pixel))
                tool.setCursor({ stroke: CURSOR_STYLE.LOCKED, rect: CURSOR_STYLE.LOCKED });
            else
                tool.setCursor({ stroke: CURSOR_STYLE.ERASE_STROKE, rect: CURSOR_STYLE.ERASE_RECT });
        }
    });
    watch(() => tool.previewPixels, (pixels) => {
        if (tool.current !== 'erase') return;
        const id = nodeTree.selectedLayerIds[0];
        const sourcePixels = new Set(pixelsOf(id));
        const previewPixels = pixels.filter(pixel => sourcePixels.has(pixel));
        overlayService.setPixels(overlayId, previewPixels);
        if (nodes.locked(id)) { preview.clear(); return; }
        if (previewPixels.length) {
            preview.clearPixel(id);
            preview.removePixels(id, previewPixels);
        } else preview.clear();
    });
    watch(() => tool.affectedPixels, (pixels) => {
        if (tool.current !== 'erase') return;
        const id = nodeTree.selectedLayerIds[0];
        if (nodes.locked(id)) { preview.clear(); return; }
        if (pixels.length) preview.commitPreview();
        else preview.clear();
    });
    return { usable };
});

export const useCutToolService = defineStore('cutToolService', () => {
    const tool = useToolSelectionService();
    const overlayService = useOverlayService();
    const overlayId = overlayService.createOverlay();
    overlayService.setStyles(overlayId, OVERLAY_STYLES.REMOVE);
    const layerPanel = useLayerPanelService();
    const { nodeTree, nodes, pixels: pixelStore, preview } = useStore();
    const usable = computed(() => (tool.shape === 'stroke' || tool.shape === 'rect') && nodeTree.selectedLayerCount === 1);
    const toolbar = useToolbarStore();
    toolbar.register({ type: 'cut', name: 'Cut', icon: stageIcons.cut, usable });
    watch(() => tool.current === 'cut', (isCut) => {
        if (!isCut) {
            overlayService.clear(overlayId);
            preview.clear();
            return;
        }
        tool.setCursor({ stroke: CURSOR_STYLE.CUT_STROKE, rect: CURSOR_STYLE.CUT_RECT });
    });
    watch(() => tool.hoverPixel, (pixel) => {
        if (tool.current !== 'cut') return;
        overlayService.setPixels(overlayId, pixel ? [pixel] : []);
    });
    watch(() => tool.dragPixel, (pixel) => {
        if (tool.current !== 'cut') return;
        const sourceId = nodeTree.selectedLayerIds[0];
        if (nodes.locked(sourceId)) {
            const sourcePixels = new Set(pixelsOf(sourceId));
            if (pixel != null && sourcePixels.has(pixel))
                tool.setCursor({ stroke: CURSOR_STYLE.LOCKED, rect: CURSOR_STYLE.LOCKED });
            else
                tool.setCursor({ stroke: CURSOR_STYLE.CUT_STROKE, rect: CURSOR_STYLE.CUT_RECT });
        }
    });
    watch(() => tool.previewPixels, (pixels) => {
        if (tool.current !== 'cut') return;
        overlayService.setPixels(overlayId, pixels);
        const sourceId = nodeTree.selectedLayerIds[0];
        if (nodes.locked(sourceId)) { preview.clear(); return; }
        const sourcePixels = new Set(pixelsOf(sourceId));
        const cutPreview = pixels.filter(pixel => sourcePixels.has(pixel));
        if (cutPreview.length) {
            preview.clearPixel(sourceId);
            preview.removePixels(sourceId, cutPreview);
        } else preview.clear();
    });
    watch(() => tool.affectedPixels, (pixels) => {
        if (tool.current !== 'cut') return;
        const sourceId = nodeTree.selectedLayerIds[0];
        if (nodes.locked(sourceId)) { preview.clear(); return; }
        const sourcePixels = new Set(pixelsOf(sourceId));
        const cutPixels = pixels.filter(pixel => sourcePixels.has(pixel));
        if (!cutPixels.length || cutPixels.length === sourcePixels.size) { preview.clear(); return; }
        preview.commitPreview();
        const id = nodes.addLayer({
            name: `Cut of ${nodes.name(sourceId)}`,
            color: nodes.color(sourceId),
            visibility: nodes.visibility(sourceId),
            attributes: nodes.attributes(sourceId),
        });
        pixelStore.addLayer(id);
        pixelStore.add(id, cutPixels);
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
        tool.setCursor({ stroke: CURSOR_STYLE.TOP, rect: CURSOR_STYLE.TOP });
    });
    watch(() => tool.hoverPixel, (pixel) => {
        if (tool.current !== 'top') return;
        if (!pixel) {
            overlayService.clear(overlayId);
            return;
        }
        const id = layerQuery.topVisibleAt(pixel);
        if (id && nodes.locked(id)) {
            overlayService.setLayers(overlayId, [id]);
            tool.setCursor({ stroke: CURSOR_STYLE.LOCKED, rect: CURSOR_STYLE.LOCKED });
        }
        else {
            overlayService.setPixels(overlayId, [pixel]);
            tool.setCursor({ stroke: CURSOR_STYLE.TOP, rect: CURSOR_STYLE.TOP });
        }
    });
    watch(() => tool.dragPixel, (pixel) => {
        if (tool.current !== 'top' || !pixel) return;
        const id = layerQuery.topVisibleAt(pixel);
        if (!id) return;
        if (nodes.locked(id)) {
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

