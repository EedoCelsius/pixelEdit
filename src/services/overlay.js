import { defineStore } from 'pinia';
import { computed, reactive, watch } from 'vue';
import { useStore } from '../stores';
import { pixelsToUnionPath } from '../utils';
import { OVERLAY_STYLES } from '@/constants';

export const useOverlayService = defineStore('overlayService', () => {
    const { nodeTree, pixels: pixelStore } = useStore();

    const overlayPixels = reactive({});
    const styles = reactive({});

    const list = computed(() => Object.keys(overlayPixels).map(id => getOverlay(id)));

    function createOverlay(style = OVERLAY_STYLES.ADD) {
        const id = Math.floor(Date.now() * Math.random());
        overlayPixels[id] = reactive(new Set());
        styles[id] = style;
        return id;
    }

    function removeOverlay(id) {
        delete overlayPixels[id];
        delete styles[id];
    }

    function clear(id) {
        overlayPixels[id]?.clear();
    }

    function addPixels(id, pixels) {
        const pixelSet = overlayPixels[id];
        if (!pixelSet) return;
        for (const pixel of pixels) pixelSet.add(pixel);
    }

    function setPixels(id, pixels) {
        const pixelSet = overlayPixels[id];
        if (!pixelSet) return;
        pixelSet.clear();
        addPixels(id, pixels);
    }

    function addLayers(id, ids) {
        if (!Array.isArray(ids)) ids = [ids];
        for (const layerId of ids) {
            if (layerId == null) continue;
            const layerPixels = pixelStore.get(layerId);
            addPixels(id, layerPixels);
        }
    }

    function setLayers(id, ids) {
        clear(id);
        addLayers(id, ids);
    }

    function setStyles(id, style) {
        if (styles[id]) styles[id] = style;
    }

    function getOverlay(id) {
        const pixelSet = overlayPixels[id];
        if (!pixelSet) return null;
        const pixels = Array.from(pixelSet);
        const path = pixelSet.size ? pixelsToUnionPath(pixels) : '';
        return { id: Number(id), pixelSet, pixels, path, styles: styles[id] };
    }

    const selectionId = createOverlay(OVERLAY_STYLES.SELECTED);

    function rebuildSelection() {
        setLayers(selectionId, nodeTree.selectedLayerIds);
    }

    watch(() => nodeTree.selectedLayerIds.slice(), rebuildSelection, { immediate: true });

    return {
        overlayPixels,
        styles,
        list,
        createOverlay,
        removeOverlay,
        clear,
        addLayers,
        setLayers,
        addPixels,
        setPixels,
        setStyles,
        getOverlay,
    };
});

