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
        const index = Math.max(
            ...order.map((id, idx) => (idSet.has(id) ? idx : -1))
        );
        return index >= 0 ? order[index] : null;
    }

    function lowermostIdOf(ids) {
        const idSet = new Set(ids);
        if (!idSet.size) return null;
        const order = layers.idsBottomToTop;
        const index = Math.min(
            ...order.map((id, idx) => (idSet.has(id) ? idx : Infinity))
        );
        return isFinite(index) ? order[index] : null;
    }

    function uppermost(ids) {
        return ids == null ? uppermostId.value : uppermostIdOf(ids);
    }

    function lowermost(ids) {
        return ids == null ? lowermostId.value : lowermostIdOf(ids);
    }

    function above(id) {
        if (id == null) return null;
        const order = layers.idsBottomToTop;
        const idx = order.indexOf(id);
        return order[idx + 1] ?? null;
    }

    function below(id) {
        if (id == null) return null;
        const order = layers.idsBottomToTop;
        const idx = order.indexOf(id);
        return order[idx - 1] ?? null;
    }

    function empty() {
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

    function disconnected() {
        return layers.order.filter(layerId => layers.disconnectedCountOf(layerId) > 1);
    }

    function byDisconnectedCount(disconnectedCount) {
        return layers.order.filter(
            layerId => layers.disconnectedCountOf(layerId) === disconnectedCount
        );
    }

    return {
        uppermost,
        lowermost,
        above,
        below,
        empty,
        byPixelCount,
        byColor,
        disconnected,
        byDisconnectedCount,
    };
});

