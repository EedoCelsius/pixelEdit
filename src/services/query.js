import { defineStore } from 'pinia';
import { computed } from 'vue';
import { useLayerStore } from '../stores/layers';

export const useQueryService = defineStore('queryService', () => {
    const layers = useLayerStore();

    const uppermostId = computed(() => {
        const order = layers.idsBottomToTop;
        return order[order.length - 1] ?? null;
    });
    const lowermostId = computed(() => layers.idsBottomToTop[0] ?? null);

    function uppermostIdOf(ids) {
        const idSet = new Set(ids);
        if (!idSet.size) return null;
        const order = layers.idsBottomToTop;
        const index = Math.max(...order.map((id, idx) => idSet.has(id) ? idx : -1));
        return index >= 0 ? order[index] : null;
    }

    function lowermostIdOf(ids) {
        const idSet = new Set(ids);
        if (!idSet.size) return null;
        const order = layers.idsBottomToTop;
        const index = Math.min(...order.map((id, idx) => idSet.has(id) ? idx : Infinity));
        return isFinite(index) ? order[index] : null;
    }

    function aboveId(id) {
        if (id == null) return null;
        const order = layers.idsBottomToTop;
        const idx = order.indexOf(id);
        return order[idx + 1] ?? null;
    }

    function belowId(id) {
        if (id == null) return null;
        const order = layers.idsBottomToTop;
        const idx = order.indexOf(id);
        return order[idx - 1] ?? null;
    }

    return {
        uppermostId,
        lowermostId,
        uppermostIdOf,
        lowermostIdOf,
        aboveId,
        belowId,
    };
});

