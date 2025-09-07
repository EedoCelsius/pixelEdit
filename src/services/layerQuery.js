import { defineStore } from 'pinia';
import { useStore } from '../stores';

export const useLayerQueryService = defineStore('layerQueryService', () => {
    const { nodeTree, nodes, pixels } = useStore();

    function uppermost(ids) {
        const order = nodeTree.layerIdsBottomToTop;
        if (ids == null) {
            return order[order.length - 1] ?? null;
        }
        const idSet = new Set(ids);
        if (!idSet.size) return null;
        const index = Math.max(
            ...order.map((id, idx) => (idSet.has(id) ? idx : -1))
        );
        return index >= 0 ? order[index] : null;
    }

    function lowermost(ids) {
        const order = nodeTree.layerIdsBottomToTop;
        if (ids == null) {
            return order[0] ?? null;
        }
        const idSet = new Set(ids);
        if (!idSet.size) return null;
        const index = Math.min(
            ...order.map((id, idx) => (idSet.has(id) ? idx : Infinity))
        );
        return isFinite(index) ? order[index] : null;
    }

    function above(id) {
        if (id == null) return null;
        const order = nodeTree.layerIdsBottomToTop;
        const idx = order.indexOf(id);
        return order[idx + 1] ?? null;
    }

    function below(id) {
        if (id == null) return null;
        const order = nodeTree.layerIdsBottomToTop;
        const idx = order.indexOf(id);
        return order[idx - 1] ?? null;
    }

    function topVisibleAt(pixel, ids = null) {
        const order = nodeTree.layerIdsBottomToTop;
        const idSet = ids ? new Set(ids) : null;
        for (let i = order.length - 1; i >= 0; i--) {
            const id = order[i];
            if (idSet && !idSet.has(id)) continue;
            if (!nodes._visibility[id]) continue;
            if (pixels.has(id, pixel)) return id;
        }
        return null;
    }

    function empty() {
        return nodeTree.layerOrder.filter(id => pixels.get(id).length === 0);
    }

    function disconnected() {
        return nodeTree.layerOrder.filter(layerId => pixels.disconnectedCountOfLayer(layerId) > 1);
    }

    function byColor(color) {
        return nodeTree.layerOrder.filter(
            layerId => nodes.getProperty(layerId, 'color') === color
        );
    }

    function byPixelCount(pixelCount) {
        return nodeTree.layerOrder.filter(
            layerId => pixels.get(layerId).length === pixelCount
        );
    }

    function byDisconnectedCount(disconnectedCount) {
        return nodeTree.layerOrder.filter(
            layerId => pixels.disconnectedCountOfLayer(layerId) === disconnectedCount
        );
    }

    return {
        uppermost,
        lowermost,
        above,
        below,
        topVisibleAt,
        empty,
        disconnected,
        byColor,
        byPixelCount,
        byDisconnectedCount,
    };
});

