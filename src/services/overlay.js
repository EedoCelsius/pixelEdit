import { defineStore } from 'pinia';
import { computed, reactive, ref, watch } from 'vue';
import { useStore } from '../stores';
import { coordToKey, keyToCoord, pixelsToUnionPath } from '../utils';
import { OVERLAY_CONFIG } from '@/constants';

export const useOverlayService = defineStore('overlayService', () => {
    const { layers } = useStore();

    function createOverlayState() {
        const pixelKeys = reactive(new Set());
        const pixels = computed(() => Array.from(pixelKeys).map(keyToCoord));
        const path = computed(() => {
            if (!pixelKeys.size) return '';
            return pixelsToUnionPath(pixels.value);
        });
        function clear() {
            pixelKeys.clear();
        }
        function addLayers(ids) {
            if (!Array.isArray(ids)) ids = [ids];
            for (const id of ids) {
                if (id == null) continue;
                const layerPixels = layers.getProperty(id, 'pixels') || [];
                addPixels(layerPixels);
            }
        }
        function setLayers(ids) {
            pixelKeys.clear();
            addLayers(ids);
        }
        function addPixels(coords) {
            for (const coord of coords) pixelKeys.add(coordToKey(coord));
        }
        function setPixels(coords) {
            pixelKeys.clear();
            addPixels(coords);
        }
        return { pixels, path, clear, addLayers, setLayers, addPixels, setPixels };
    }

    const overlays = reactive({});
    const list = computed(() => Object.values(overlays));

    function addOverlay(id, config = OVERLAY_CONFIG.ADD) {
        if (overlays[id]) return overlays[id];
        const state = createOverlayState();
        overlays[id] = { id, ...state, config: ref(config) };
        return overlays[id];
    }

    function removeOverlay(id) {
        delete overlays[id];
    }

    addOverlay('selection', OVERLAY_CONFIG.SELECTED);
    addOverlay('helper', OVERLAY_CONFIG.ADD);

    function rebuildSelection() {
        overlays.selection.setLayers(layers.selectedIds);
    }

    watch(() => layers.selectedIds.slice(), rebuildSelection, { immediate: true });

    function getOverlay(id) {
        return overlays[id];
    }

    return {
        overlays,
        list,
        addOverlay,
        removeOverlay,
        getOverlay,
    };
});

