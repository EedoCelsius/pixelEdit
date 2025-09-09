import { defineStore } from 'pinia';
import { computed, reactive, watch } from 'vue';
import { useStore } from '../stores';
import { MAX_DIMENSION, pixelsToUnionPath } from '../utils/pixels.js';
import { OVERLAY_STYLES } from '@/constants';

export const useOverlayService = defineStore('overlayService', () => {
    const { nodeTree, pixels: pixelStore } = useStore();

    const overlayPixels = reactive({});
    const styles = reactive({});

    const list = computed(() => Object.keys(overlayPixels).map(id => getOverlay(id)));

    function createOverlay(style = OVERLAY_STYLES.ADD) {
        const id = crypto.getRandomValues(new Uint32Array(1))[0];
        overlayPixels[id] = reactive(new Uint8Array(MAX_DIMENSION * MAX_DIMENSION));
        styles[id] = style;
        return id;
    }

    function removeOverlay(id) {
        delete overlayPixels[id];
        delete styles[id];
    }

    function clear(id) {
        overlayPixels[id].fill(0);
    }

    function addPixels(id, pixels) {
        const arr = overlayPixels[id];
        for (const pixel of pixels) arr[pixel] = 1;
    }

    function setPixels(id, pixels) {
        clear(id);
        addPixels(id, pixels);
    }

    function addLayers(id, ids) {
        if (!Array.isArray(ids)) ids = [ids];
        const overlayArr = overlayPixels[id];
        for (const layerId of ids) {
            const layerArr = pixelStore.get(layerId);
            for (let i = 0; i < layerArr.length; i++) if (layerArr[i]) overlayArr[i] = 1;
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
        return { id: Number(id), pixels, pixelsToUnionPath(pixels), styles: styles[id] };
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

