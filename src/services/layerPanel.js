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

    function visibleAncestor(id, orderSet) {
        let info = nodeTree._findNode(id);
        while (info && !orderSet.has(info.node.id)) {
            if (!info.parent) return null;
            info = nodeTree._findNode(info.parent.id);
        }
        return info ? info.node.id : null;
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

    function unfoldAncestors(id) {
        let info = nodeTree._findNode(id);
        while (info?.parent) {
            folded[info.parent.id] = false;
            info = nodeTree._findNode(info.parent.id);
        }
    }

    function moveByVisible(id, dir) {
        const { order } = dfs(true);
        if (!order.length) return id;
        const orderSet = new Set(order);
        let target = orderSet.has(id) ? id : visibleAncestor(id, orderSet);
        if (target == null) return id;
        const idx = order.indexOf(target);
        const nextIdx = dir === 'up' ? idx - 1 : idx + 1;
        return order[nextIdx] ?? target;
    }

    function moveSibling(id, dir) {
        let info = nodeTree._findNode(id);
        if (!info) return id;
        const siblings = info.parent ? info.parent.children : nodeTree.tree;
        const idx = siblings.findIndex(n => n.id === id);
        if (dir === 'up') {
            if (idx < siblings.length - 1) {
                return siblings[idx + 1].id;
            } else {
                return info.parent ? info.parent.id : id;
            }
        } else {
            if (idx > 0) {
                return siblings[idx - 1].id;
            } else {
                let parentInfo = info.parent ? nodeTree._findNode(info.parent.id) : null;
                while (parentInfo) {
                    const arr = parentInfo.parent ? parentInfo.parent.children : nodeTree.tree;
                    const pIdx = arr.findIndex(n => n.id === parentInfo.node.id);
                    if (pIdx > 0) return arr[pIdx - 1].id;
                    parentInfo = parentInfo.parent ? nodeTree._findNode(parentInfo.parent.id) : null;
                }
                return id;
            }
        }
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

        const followType = dir === 'up' ? 'follow-up' : 'follow-down';
        const selected = nodeTree.selectedIds;
        const hasAnchor = state.anchorId != null && state.tailId != null;

        if (!hasAnchor) {
            if (selected.length === 1) {
                const cur = selected[0];
                if (!ctrl) unfoldAncestors(cur);
                const target = moveByVisible(cur, dir);
                setRange(target, target);
                setScrollRule({ type: followType, target });
            } else if (selected.length > 1) {
                if (ctrl) {
                    const { order } = dfs(true);
                    const selSet = new Set(selected);
                    const visible = order.filter(id => selSet.has(id));
                    if (!visible.length) return;
                    const target = dir === 'up' ? visible[0] : visible[visible.length - 1];
                    setRange(target, target);
                    setScrollRule({ type: followType, target });
                } else {
                    const { order } = dfs(false);
                    const selSet = new Set(selected);
                    const ordered = order.filter(id => selSet.has(id));
                    if (!ordered.length) return;
                    const target = dir === 'up' ? ordered[0] : ordered[ordered.length - 1];
                    unfoldAncestors(target);
                    setRange(target, target);
                    setScrollRule({ type: followType, target });
                }
            }
            return;
        }

        const anchor = state.anchorId;
        const tail = state.tailId;
        const single = anchor === tail;

        if (single) {
            if (ctrl && !shift) {
                unfoldAncestors(tail);
                const target = moveSibling(tail, dir);
                setRange(target, target);
                setScrollRule({ type: followType, target });
            } else if (ctrl && shift) {
                unfoldAncestors(tail);
                const newTail = moveSibling(tail, dir);
                setRange(anchor, newTail);
                setScrollRule({ type: followType, target: newTail });
            } else if (!ctrl && shift) {
                unfoldAncestors(tail);
                const newTail = moveByVisible(tail, dir);
                setRange(anchor, newTail);
                setScrollRule({ type: followType, target: newTail });
            } else {
                unfoldAncestors(tail);
                const target = moveByVisible(tail, dir);
                setRange(target, target);
                setScrollRule({ type: followType, target });
            }
            return;
        }

        if (ctrl && shift) {
            unfoldAncestors(tail);
            const newTail = moveSibling(tail, dir);
            setRange(anchor, newTail);
            setScrollRule({ type: followType, target: newTail });
        } else if (ctrl && !shift) {
            const { order } = dfs(true);
            const idxA = order.indexOf(anchor);
            const idxT = order.indexOf(tail);
            if (idxA === -1 || idxT === -1) return;
            const start = Math.min(idxA, idxT);
            const end = Math.max(idxA, idxT);
            const target = dir === 'up' ? order[start] : order[end];
            setRange(target, target);
            setScrollRule({ type: followType, target });
        } else if (!ctrl && shift) {
            unfoldAncestors(tail);
            const newTail = moveByVisible(tail, dir);
            setRange(anchor, newTail);
            setScrollRule({ type: followType, target: newTail });
        } else {
            const { order } = dfs(false);
            const idxA = order.indexOf(anchor);
            const idxT = order.indexOf(tail);
            if (idxA === -1 || idxT === -1) return;
            const start = Math.min(idxA, idxT);
            const end = Math.max(idxA, idxT);
            const target = dir === 'up' ? order[start] : order[end];
            unfoldAncestors(target);
            setRange(target, target);
            setScrollRule({ type: followType, target });
        }
    }

    function onArrowUp(shift, ctrl) {
        handleArrow('up', shift, ctrl);
    }

    function onArrowDown(shift, ctrl) {
        handleArrow('down', shift, ctrl);
    }

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

