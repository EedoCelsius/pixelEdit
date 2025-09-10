import { defineStore } from 'pinia';
import { reactive, toRefs, watch, computed } from 'vue';
import { useStore } from '../stores';

export const useLayerPanelService = defineStore('layerPanelService', () => {
    const { nodeTree } = useStore();

    const state = reactive({
        anchorId: null,
        tailId: null,
        scrollRule: null,
    });

    const folded = reactive({});

    const exists = computed(() => state.anchorId != null && state.tailId != null);

    let stopWatch = null;
    function enableWatch() {
        if (!stopWatch) {
            stopWatch = watch(
                () => nodeTree.selectedLayerIds,
                () => { clearRange(); },
                { flush: 'sync' }
            );
        }
    }
    function disableWatch() {
        if (stopWatch) {
            stopWatch();
            stopWatch = null;
        }
    }

    function dfs(skipFolded = false) {
        const order = [];
        const ancestors = new Map();
        const walk = (list, anc) => {
            for (let i = list.length - 1; i >= 0; i--) {
                const node = list[i];
                ancestors.set(node.id, anc.slice());
                order.push(node.id);
                if (node.children && !(skipFolded && folded[node.id])) {
                    walk(node.children, anc.concat(node.id));
                }
            }
        };
        walk(nodeTree.tree, []);
        return { order, ancestors };
    }

    function unfoldAncestors(id) {
        let info = nodeTree._findNode(id);
        while (info && info.parent) {
            folded[info.parent.id] = false;
            info = nodeTree._findNode(info.parent.id);
        }
    }

    function getVisibleOrder() {
        const { order } = dfs(true);
        const map = new Map(order.map((id, idx) => [id, idx]));
        return { order, map };
    }

    function findTopBottomFromMap(map, selection) {
        let topId = null, bottomId = null;
        let topIdx = Infinity, bottomIdx = -Infinity;
        for (const id of selection) {
            const idx = map.get(id);
            if (idx == null) continue;
            if (idx < topIdx) { topIdx = idx; topId = id; }
            if (idx > bottomIdx) { bottomIdx = idx; bottomId = id; }
        }
        return { topId, bottomId };
    }

    function findTopBottom(order, selection) {
        const map = new Map(order.map((id, idx) => [id, idx]));
        return findTopBottomFromMap(map, selection);
    }

    function siblingMove(id, dir) {
        const info = nodeTree._findNode(id);
        if (!info || !info.parent) return id;
        const sibs = info.parent.children;
        const idx = sibs.findIndex(n => n.id === id);
        if (dir === 'up') {
            if (idx < sibs.length - 1) return sibs[idx + 1].id;
            return info.parent.id;
        } else {
            if (idx > 0) return sibs[idx - 1].id;
            const pInfo = nodeTree._findNode(info.parent.id);
            if (!pInfo.parent) return info.parent.id;
            const pSibs = pInfo.parent.children;
            const pIdx = pSibs.findIndex(n => n.id === info.parent.id);
            if (pIdx > 0) return pSibs[pIdx - 1].id;
            return info.parent.id;
        }
    }

    function setRange(anchorId = null, tailId = null) {
        disableWatch();
        if (anchorId == null || tailId == null) {
            state.anchorId = null;
            state.tailId = null;
            nodeTree.clearSelection();
            return;
        }

        const { order, ancestors } = dfs(false);
        const idxA = order.indexOf(anchorId);
        const idxB = order.indexOf(tailId);
        if (idxA === -1 || idxB === -1) {
            state.anchorId = null;
            state.tailId = null;
            nodeTree.clearSelection();
            return;
        }
        const [start, end] = idxA < idxB ? [idxA, idxB] : [idxB, idxA];
        const slice = order.slice(start, end + 1);
        const ancToRemove = new Set([
            ...(ancestors.get(anchorId) || []),
            ...(ancestors.get(tailId) || []),
        ]);
        const selection = slice.filter(id => !ancToRemove.has(id));
        nodeTree.replaceSelection(selection);
        state.anchorId = anchorId;
        state.tailId = tailId;
        enableWatch();
    }

    function clearRange() {
        disableWatch();
        state.anchorId = null;
        state.tailId = null;
    }

    function setScrollRule(rule) {
        if (rule?.target != null) {
            const info = nodeTree._findNode(rule.target);
            if (info) {
                const path = [];
                let cur = info;
                while (cur) {
                    path.unshift(cur.node);
                    if (!cur.parent) break;
                    cur = nodeTree._findNode(cur.parent.id);
                }
                for (let i = 0; i < path.length - 1; i++) {
                    const anc = path[i];
                    const next = path[i + 1];
                    if (folded[anc.id]) {
                        folded[anc.id] = false;
                        if (anc.children) {
                            for (const child of anc.children) {
                                if (child.id !== next.id && child.children) {
                                    folded[child.id] = true;
                                }
                            }
                        }
                    }
                }
            }
        }
        state.scrollRule = rule;
    }

    function onLayerClick(id, event) {
        if (event.shiftKey) {
            setRange(state.anchorId ?? id, id);
        } else if (event.ctrlKey || event.metaKey) {
            nodeTree.toggleSelection(id);
        } else {
            setRange(id, id);
        }
        setScrollRule({ type: 'follow', target: id });
    }

    function handleArrow(dir, shift, ctrl) {
        if (!nodeTree.exists) return;
        const selection = nodeTree.selectedIds;
        if (!selection.length) return;
        const anchorExists = state.anchorId != null && state.tailId != null;
        const single = selection.length === 1;
        const type = dir === 'up' ? 'follow-up' : 'follow-down';

        if (!anchorExists) {
            if (single) {
                const cur = selection[0];
                if (!ctrl) unfoldAncestors(cur);
                const { order, map } = getVisibleOrder();
                const idx = map.get(cur);
                if (idx == null) return;
                const newIdx = dir === 'up' ? Math.max(0, idx - 1) : Math.min(order.length - 1, idx + 1);
                const id = order[newIdx];
                setRange(id, id);
                setScrollRule({ type, target: id });
            } else {
                if (ctrl) {
                    const { order } = getVisibleOrder();
                    const { topId, bottomId } = findTopBottom(order, selection);
                    const id = dir === 'up' ? topId : bottomId;
                    if (id == null) return;
                    setRange(id, id);
                    setScrollRule({ type, target: id });
                } else {
                    const { order: fullOrder } = dfs(false);
                    const mapFull = new Map(fullOrder.map((id, i) => [id, i]));
                    const { topId, bottomId } = findTopBottomFromMap(mapFull, selection);
                    const id = dir === 'up' ? topId : bottomId;
                    if (id == null) return;
                    unfoldAncestors(id);
                    const { order } = getVisibleOrder();
                    if (!order.includes(id)) return;
                    setRange(id, id);
                    setScrollRule({ type, target: id });
                }
            }
            return;
        }

        if (single) {
            if (ctrl && shift) {
                unfoldAncestors(state.tailId);
                const newTail = siblingMove(state.tailId, dir);
                setRange(state.anchorId, newTail);
                setScrollRule({ type, target: newTail });
            } else if (ctrl) {
                unfoldAncestors(state.anchorId);
                const id = siblingMove(state.anchorId, dir);
                setRange(id, id);
                setScrollRule({ type, target: id });
            } else if (shift) {
                unfoldAncestors(state.tailId);
                const { order, map } = getVisibleOrder();
                const idx = map.get(state.tailId);
                if (idx == null) return;
                const newIdx = dir === 'up' ? Math.max(0, idx - 1) : Math.min(order.length - 1, idx + 1);
                const newTail = order[newIdx];
                setRange(state.anchorId, newTail);
                setScrollRule({ type, target: newTail });
            } else {
                unfoldAncestors(state.anchorId);
                const { order, map } = getVisibleOrder();
                const idx = map.get(state.anchorId);
                if (idx == null) return;
                const newIdx = dir === 'up' ? Math.max(0, idx - 1) : Math.min(order.length - 1, idx + 1);
                const id = order[newIdx];
                setRange(id, id);
                setScrollRule({ type, target: id });
            }
        } else {
            if (ctrl && shift) {
                unfoldAncestors(state.tailId);
                const newTail = siblingMove(state.tailId, dir);
                setRange(state.anchorId, newTail);
                setScrollRule({ type, target: newTail });
            } else if (ctrl) {
                const { order } = getVisibleOrder();
                const { topId, bottomId } = findTopBottom(order, selection);
                const id = dir === 'up' ? topId : bottomId;
                if (id == null) return;
                setRange(id, id);
                setScrollRule({ type, target: id });
            } else if (shift) {
                unfoldAncestors(state.tailId);
                const { order, map } = getVisibleOrder();
                const idx = map.get(state.tailId);
                if (idx == null) return;
                const newIdx = dir === 'up' ? Math.max(0, idx - 1) : Math.min(order.length - 1, idx + 1);
                const newTail = order[newIdx];
                setRange(state.anchorId, newTail);
                setScrollRule({ type, target: newTail });
            } else {
                const { order: fullOrder } = dfs(false);
                const mapFull = new Map(fullOrder.map((id, i) => [id, i]));
                const { topId, bottomId } = findTopBottomFromMap(mapFull, selection);
                const id = dir === 'up' ? topId : bottomId;
                if (id == null) return;
                unfoldAncestors(id);
                const { order } = getVisibleOrder();
                if (!order.includes(id)) return;
                setRange(id, id);
                setScrollRule({ type, target: id });
            }
        }
    }

    function onArrowUp(shift, ctrl) { handleArrow('up', shift, ctrl); }
    function onArrowDown(shift, ctrl) { handleArrow('down', shift, ctrl); }

    function toggleFold(id) {
        folded[id] = !folded[id];
    }

    function selectAll() {
        const { order } = dfs(false);
        if (!order.length) return;
        setRange(order[0], order[order.length - 1]);
    }

    function serialize() {
        return {
            anchorId: state.anchorId,
            tailId: state.tailId,
            scrollRule: state.scrollRule,
        };
    }

    function applySerialized(payload) {
        disableWatch();
        state.anchorId = payload?.anchorId ?? null;
        state.tailId = payload?.tailId ?? null;
        if (state.anchorId != null && state.tailId != null) {
            enableWatch();
        }
        state.scrollRule = payload?.scrollRule;
    }

    return {
        ...toRefs(state),
        exists,
        folded,
        toggleFold,
        setRange,
        clearRange,
        setScrollRule,
        onLayerClick,
        onArrowUp,
        onArrowDown,
        selectAll,
        serialize,
        applySerialized,
    };
});

