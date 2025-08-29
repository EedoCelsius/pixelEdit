import { defineStore } from 'pinia';
import { computed, reactive, watch } from 'vue';
import { useStore } from '../stores';
import { coordToKey, keyToCoord, pixelsToUnionPath } from '../utils';
import { OVERLAY_STYLES } from '@/constants';

export const useOverlayService = defineStore('overlayService', () => {
    const { nodeTree, pixels: pixelStore } = useStore();

    const pixelKeys = reactive({});
    const styles = reactive({});

    const list = computed(() => Object.keys(pixelKeys).map(id => getOverlay(id)));

    function createOverlay(style = OVERLAY_STYLES.ADD) {
        const id = Math.floor(Date.now() * Math.random());
        pixelKeys[id] = reactive(new Set());
        styles[id] = style;
        return id;
    }

    function removeOverlay(id) {
        delete pixelKeys[id];
        delete styles[id];
    }

    function clear(id) {
        pixelKeys[id]?.clear();
    }

    function addPixels(id, coords) {
        const keys = pixelKeys[id];
        if (!keys) return;
        for (const coord of coords) keys.add(coordToKey(coord));
    }

    function setPixels(id, coords) {
        const keys = pixelKeys[id];
        if (!keys) return;
        keys.clear();
        addPixels(id, coords);
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
        const keys = pixelKeys[id];
        if (!keys) return null;
        const pixels = Array.from(keys).map(keyToCoord);
        const path = keys.size ? pixelsToUnionPath(pixels) : '';
        return { id: Number(id), pixelKeys: keys, pixels, path, styles: styles[id] };
    }

    const selectionId = createOverlay(OVERLAY_STYLES.SELECTED);

    function rebuildSelection() {
        setLayers(selectionId, nodeTree.selectedLayerIds);
    }

    watch(() => nodeTree.selectedLayerIds.slice(), rebuildSelection, { immediate: true });

    return {
        pixelKeys,
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

