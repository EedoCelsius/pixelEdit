import { defineStore } from 'pinia';
import { computed, reactive, watch } from 'vue';
import { useStore } from '../stores';
import { pixelsToUnionPath } from '../utils';
import { OVERLAY_STYLES } from '@/constants';

export const useOverlayService = defineStore('overlayService', () => {
    const { nodeTree, pixels: pixelStore } = useStore();

    const pixelIndexes = reactive({});
    const styles = reactive({});

    const list = computed(() => Object.keys(pixelIndexes).map(id => getOverlay(id)));

    function createOverlay(style = OVERLAY_STYLES.ADD) {
        const id = Math.floor(Date.now() * Math.random());
        pixelIndexes[id] = reactive(new Set());
        styles[id] = style;
        return id;
    }

    function removeOverlay(id) {
        delete pixelIndexes[id];
        delete styles[id];
    }

    function clear(id) {
        pixelIndexes[id]?.clear();
    }

    function addPixels(id, indexes) {
        const indexSet = pixelIndexes[id];
        if (!indexSet) return;
        for (const index of indexes) indexSet.add(index);
    }

    function setPixels(id, indexes) {
        const indexSet = pixelIndexes[id];
        if (!indexSet) return;
        indexSet.clear();
        addPixels(id, indexes);
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
        const indexSet = pixelIndexes[id];
        if (!indexSet) return null;
        const pixels = Array.from(indexSet);
        const path = indexSet.size ? pixelsToUnionPath(pixels) : '';
        return { id: Number(id), pixelIndexes: indexSet, pixels, path, styles: styles[id] };
    }

    const selectionId = createOverlay(OVERLAY_STYLES.SELECTED);

    function rebuildSelection() {
        setLayers(selectionId, nodeTree.selectedLayerIds);
    }

    watch(() => nodeTree.selectedLayerIds.slice(), rebuildSelection, { immediate: true });

    return {
        pixelIndexes,
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

