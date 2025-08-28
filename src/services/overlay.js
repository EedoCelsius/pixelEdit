import { defineStore } from 'pinia';
import { computed, reactive, ref, watch } from 'vue';
import { useStore } from '../stores';
import { coordToKey, keyToCoord, pixelsToUnionPath } from '../utils';
import { OVERLAY_STYLES } from '@/constants';

export const useOverlayService = defineStore('overlayService', () => {
    const { nodeTree, nodes } = useStore();

    const overlays = reactive({});
    const list = computed(() => Object.values(overlays));

    function createOverlay(styles = OVERLAY_STYLES.ADD) {
        const id = Math.floor(Date.now() * Math.random());
        const pixelKeys = reactive(new Set());
        const pixels = computed(() => Array.from(pixelKeys).map(keyToCoord));
        const path = computed(() => {
            if (!pixelKeys.size) return '';
            return pixelsToUnionPath(pixels.value);
        });
        overlays[id] = { id, pixelKeys, pixels, path, styles: ref(styles) };
        return id;
    }

    function removeOverlay(id) {
        delete overlays[id];
    }

    function clear(id) {
        overlays[id]?.pixelKeys.clear();
    }

    function addPixels(id, coords) {
        const ov = overlays[id];
        if (!ov) return;
        for (const coord of coords) ov.pixelKeys.add(coordToKey(coord));
    }

    function setPixels(id, coords) {
        const ov = overlays[id];
        if (!ov) return;
        ov.pixelKeys.clear();
        addPixels(id, coords);
    }

    function addLayers(id, ids) {
        if (!Array.isArray(ids)) ids = [ids];
        for (const layerId of ids) {
            if (layerId == null) continue;
            const layerPixels = nodes.getProperty(layerId, 'pixels') || [];
            addPixels(id, layerPixels);
        }
    }

    function setLayers(id, ids) {
        clear(id);
        addLayers(id, ids);
    }

    function setStyles(id, styles) {
        const ov = overlays[id];
        if (ov) ov.styles.value = styles;
    }

    function getOverlay(id) {
        return overlays[id];
    }

    const selectionId = createOverlay(OVERLAY_STYLES.SELECTED);

    function rebuildSelection() {
        setLayers(selectionId, nodeTree.selectedLayerIds);
    }

    watch(() => nodeTree.selectedLayerIds.slice(), rebuildSelection, { immediate: true });

    return {
        overlays,
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

