import { defineStore } from 'pinia';
import { computed } from 'vue';
import { useStore } from '../stores';

export const useQueryService = defineStore('queryService', () => {
    const { layers } = useStore();

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

    function byEmpty() {
        return layers.order.filter(id => layers.getProperty(id, 'pixels').length === 0);
    }

    function byPixelCount(pixelCount) {
        return layers.order.filter(
            layerId => layers.getProperty(layerId, 'pixels').length === pixelCount
        );
    }

    function byColor(color) {
        return layers.order.filter(
            layerId => layers.getProperty(layerId, 'color') === color
        );
    }

    function byDisconnected() {
        return layers.order.filter(layerId => layers.disconnectedCountOf(layerId) > 1);
    }

    function byDisconnectedCount(disconnectedCount) {
        return layers.order.filter(
            layerId => layers.disconnectedCountOf(layerId) === disconnectedCount
        );
    }

    return {
        uppermostId,
        lowermostId,
        uppermostIdOf,
        lowermostIdOf,
        aboveId,
        belowId,
        byEmpty,
        byPixelCount,
        byColor,
        byDisconnected,
        byDisconnectedCount,
    };
});

