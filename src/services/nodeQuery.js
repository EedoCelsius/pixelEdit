import { defineStore } from 'pinia';
import { useStore } from '../stores';

export const useNodeQueryService = defineStore('nodeQueryService', () => {
    const { nodeTree } = useStore();

    function lowermost(ids) {
        const order = nodeTree.allNodeIds;
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

    function below(id) {
        if (id == null) return null;
        const info = nodeTree._findNode(id);
        if (!info) return null;
        const siblings = info.parent ? info.parent.children : nodeTree.tree;
        return siblings[info.index - 1]?.id ?? null;
    }

    function parentOf(id) {
        const info = nodeTree._findNode(id);
        return info?.parent?.id ?? null;
    }

    return { lowermost, below, parentOf };
});

