import { defineStore } from 'pinia';
import { computed, reactive, ref } from 'vue';
import { useStore } from '../stores';
import { pixelsToUnionPath, getPixelUnion } from '../utils';

export const useOverlayService = defineStore('overlayService', () => {
    const { tool: toolStore, layers } = useStore();

    const hoverLayerId = ref(null);
    const selectOverlayLayerIds = reactive(new Set());

    const selectOverlayPath = computed(() => {
        if (!selectOverlayLayerIds.size) return '';
        const pixelUnion = getPixelUnion(layers.getProperties([...selectOverlayLayerIds]));
        return pixelsToUnionPath(pixelUnion);
    });

    const hoverOverlayPath = computed(() => {
        return hoverLayerId.value != null ? layers.pathOf(hoverLayerId.value) : '';
    });

    function setHover(id) {
        hoverLayerId.value = id;
    }

    function clearHover() {
        hoverLayerId.value = null;
    }

    function add(id) {
        if (id == null) return;
        selectOverlayLayerIds.add(id);
    }

    function clear() {
        selectOverlayLayerIds.clear();
    }

    function addByMode(id) {
        if (id == null) return;
        const mode = toolStore.pointer.status;
        if (mode === 'remove') {
            if (layers.isSelected(id)) add(id);
        } else if (mode === 'add') {
            if (!layers.isSelected(id)) add(id);
        } else {
            add(id);
        }
    }

    function setFromIntersected(ids) {
        clear();
        for (const id of ids) {
            addByMode(id);
        }
    }

    return {
        hoverLayerId,
        hoverOverlayPath,
        selectOverlayPath,
        setHover,
        clearHover,
        add,
        clear,
        addByMode,
        setFromIntersected,
    };
});
