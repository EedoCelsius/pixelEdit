import { defineStore } from 'pinia';
import { useStore } from '../stores';

export const useQueryService = defineStore('queryService', () => {
    const { nodeTree, nodes } = useStore();

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

    function empty() {
        return nodeTree.layerOrder.filter(id => (nodes.getProperty(id, 'pixels') || []).length === 0);
    }

    function disconnected() {
        return nodeTree.layerOrder.filter(layerId => nodes.disconnectedCountOfLayer(layerId) > 1);
    }

    function byColor(color) {
        return nodeTree.layerOrder.filter(
            layerId => nodes.getProperty(layerId, 'color') === color
        );
    }

    function byPixelCount(pixelCount) {
        return nodeTree.layerOrder.filter(
            layerId => (nodes.getProperty(layerId, 'pixels') || []).length === pixelCount
        );
    }

    function byDisconnectedCount(disconnectedCount) {
        return nodeTree.layerOrder.filter(
            layerId => nodes.disconnectedCountOfLayer(layerId) === disconnectedCount
        );
    }

    return {
        uppermost,
        lowermost,
        above,
        below,
        empty,
        disconnected,
        byColor,
        byPixelCount,
        byDisconnectedCount,
    };
});

