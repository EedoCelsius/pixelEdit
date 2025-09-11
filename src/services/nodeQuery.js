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

    function shallowest(ids) {
        const order = ids ?? nodeTree.allNodeIds;
        let minDepth = Infinity;
        const result = [];
        for (const id of order) {
            const info = nodeTree._findNode(id);
            if (!info) continue;
            let depth = 0;
            for (let parent = info.parent; parent; parent = nodeTree._findNode(parent.id)?.parent) {
                depth++;
            }
            if (depth < minDepth) {
                minDepth = depth;
                result.length = 0;
                result.push(id);
            } else if (depth === minDepth) {
                result.push(id);
            }
        }
        return result;
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

    return { lowermost, uppermost, shallowest, below, parentOf, childrenOf };
});

