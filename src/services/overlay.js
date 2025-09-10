import { defineStore } from 'pinia';
import { computed, reactive, watch } from 'vue';
import { useNodeTreeStore } from '../stores/nodeTree.js';
import { usePixelStore } from '../stores/pixels.js';
import { pixelsToUnionPath } from '../utils/pixels.js';
import { OVERLAY_STYLES } from '@/constants';

export const useOverlayService = defineStore('overlayService', () => {
    const nodeTree = useNodeTreeStore();
    const pixelStore = usePixelStore();

    const overlayPixels = reactive({});
    const styles = reactive({});

    const list = computed(() => Object.keys(overlayPixels).map(id => getOverlay(id)));

    function createOverlay(style = OVERLAY_STYLES.ADD) {
        const id = crypto.getRandomValues(new Uint32Array(1))[0];
        overlayPixels[id] = reactive(new Set());
        styles[id] = style;
        return id;
    }

    function removeOverlay(id) {
        delete overlayPixels[id];
        delete styles[id];
    }

    function clear(id) {
        overlayPixels[id].clear();
    }

    function addPixels(id, pixels) {
        const set = overlayPixels[id];
        for (const pixel of pixels) set.add(pixel);
    }

    function setPixels(id, pixels) {
        clear(id);
        addPixels(id, pixels);
    }

    function addLayers(id, ids) {
        if (!Array.isArray(ids)) ids = [ids];
        const overlaySet = overlayPixels[id];
        for (const layerId of ids) {
            const layerMap = pixelStore.get(layerId);
            for (const idx of layerMap.keys()) overlaySet.add(idx);
        }
    }

    function setLayers(id, ids) {
        clear(id);
        addLayers(id, ids);
    }

    function setStyles(id, style) {
        styles[id] = style;
    }

    function getOverlay(id) {
        const pixels = overlayPixels[id];
        return { id: Number(id), pixels, path: pixelsToUnionPath(pixels), styles: styles[id] };
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

