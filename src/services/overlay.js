import { defineStore } from 'pinia';
import { computed, reactive, ref, watch } from 'vue';
import { useStore } from '../stores';
import { coordToKey, keyToCoord, pixelsToUnionPath } from '../utils';
import { OVERLAY_CONFIG } from '@/constants';

export const useOverlayService = defineStore('overlayService', () => {
    const { layers } = useStore();

    function createOverlayState() {
        const pixelKeys = reactive(new Set());
        const path = computed(() => {
            if (!pixelKeys.size) return '';
            const coords = Array.from(pixelKeys).map(keyToCoord);
            return pixelsToUnionPath(coords);
        });
        function clear() {
            pixelKeys.clear();
        }
        function add(id) {
            if (id == null) return;
            const pixels = layers.getProperty(id, 'pixels') || [];
            for (const coord of pixels) pixelKeys.add(coordToKey(coord));
        }
        return { pixels: pixelKeys, path, clear, add };
    }

    const selection = createOverlayState();
    const helper = createOverlayState();
    const helperConfig = ref(OVERLAY_CONFIG.ADD);

    function rebuildSelection() {
        selection.clear();
        layers.selectedIds.forEach(id => selection.add(id));
    }

    watch(() => layers.selectedIds.slice(), rebuildSelection, { immediate: true });

    return {
        selection,
        helper: { ...helper, config: helperConfig }
    };
});
