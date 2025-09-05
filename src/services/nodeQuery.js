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

    function uppermost(ids) {
        const order = nodeTree.allNodeIds;
        if (ids == null) {
            return order[order.length - 1] ?? null;
        }
        const idSet = new Set(ids);
        if (!idSet.size) return null;
        const index = Math.max(
            ...order.map((id, idx) => (idSet.has(id) ? idx : -Infinity))
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

    function childrenOf(id) {
        if (id == null) {
            return nodeTree.tree.map(n => n.id);
        }
        const info = nodeTree._findNode(id);
        const children = info?.node?.children;
        return children ? children.map(n => n.id) : [];
    }

    return { lowermost, uppermost, below, parentOf, childrenOf };
});

