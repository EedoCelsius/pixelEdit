import { defineStore } from 'pinia';
import { reactive, ref, toRefs, watch, computed } from 'vue';
import { useStore } from '../stores';
import { clamp } from '../utils';

export const useLayerPanelService = defineStore('layerPanelService', () => {
    const { nodeTree } = useStore();

    const state = reactive({
        anchorId: null,
        tailId: null,
        scrollRule: null,
    });

    const folded = reactive({});
    const container = ref(null);

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
        state.scrollRule = rule;
    }

    function setContainer(el) {
        container.value = el;
    }

    function unfoldTo(id) {
        let info = nodeTree._findNode(id);
        while (info) {
            folded[info.node.id] = false;
            if (!info.parent) break;
            info = nodeTree._findNode(info.parent.id);
        }
    }

    function ensureBlockVisibility({ type, target }) {
        const el = container.value;
        if (!el || target == null) return;
        let row = el.querySelector(`.layer[data-id="${target}"]`);
        if (!row) {
            let info = nodeTree._findNode(target);
            while (info && !row) {
                if (!info.parent) break;
                info = nodeTree._findNode(info.parent.id);
                if (info) row = el.querySelector(`.layer[data-id="${info.node.id}"]`);
            }
            if (!row) return;
        }

        const containerRect = el.getBoundingClientRect(),
            rowRect = row.getBoundingClientRect();
        const viewTop = el.scrollTop,
            viewBottom = viewTop + el.clientHeight;
        const elTop = rowRect.top - containerRect.top + el.scrollTop,
            elBottom = elTop + rowRect.height;

        let scrollToPosition;
        if (viewTop < elBottom && elTop < viewBottom) {
            const half = el.scrollTop + el.clientHeight * 0.5;
            if (type === 'follow-up') {
                if (half < elTop)
                    scrollToPosition = el.scrollTop;
                else
                    scrollToPosition = elTop - el.clientHeight * 0.5;
            } else if (type === 'follow-down') {
                if (elBottom < half)
                    scrollToPosition = el.scrollTop;
                else
                    scrollToPosition = elBottom - el.clientHeight * 0.5;
            } else {
                if (elTop < viewTop)
                    scrollToPosition = elTop;
                else if (elBottom > viewBottom)
                    scrollToPosition = elBottom - el.clientHeight;
                else
                    scrollToPosition = el.scrollTop;
            }
        } else {
            if (type === 'follow-up')
                scrollToPosition = elTop - el.clientHeight * 0.5;
            else if (type === 'follow-down')
                scrollToPosition = elBottom - el.clientHeight * 0.5;
            else {
                if (elBottom <= viewTop)
                    scrollToPosition = elBottom - el.clientHeight * 0.5;
                else if (elTop >= viewBottom)
                    scrollToPosition = elTop - el.clientHeight * 0.5;
            }
        }

        const max = Math.max(0, el.scrollHeight - el.clientHeight);
        el.scrollTo({ top: clamp(scrollToPosition, 0, max), behavior: 'smooth' });
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

    function findTop(ids, order, orderSet = null) {
        const index = new Map(order.map((id, idx) => [id, idx]));
        let best = null, bestIdx = Infinity;
        for (const id of ids) {
            const vis = orderSet ? visibleAncestor(id, orderSet) : id;
            if (vis == null) continue;
            const idx = index.get(vis);
            if (idx != null && idx < bestIdx) { bestIdx = idx; best = vis; }
        }
        return best;
    }

    function findBottom(ids, order, orderSet = null) {
        const index = new Map(order.map((id, idx) => [id, idx]));
        let best = null, bestIdx = -1;
        for (const id of ids) {
            const vis = orderSet ? visibleAncestor(id, orderSet) : id;
            if (vis == null) continue;
            const idx = index.get(vis);
            if (idx != null && idx > bestIdx) { bestIdx = idx; best = vis; }
            
        }
        return best;
    }

    function moveSibling(id, dir) {
        const info = nodeTree._findNode(id);
        if (!info) return id;
        const parent = info.parent;
        const siblings = parent ? parent.children : nodeTree.tree;
        if (dir === 'up') {
            if (info.index > 0) return siblings[info.index - 1].id;
            return parent ? parent.id : siblings[info.index].id;
        } else {
            if (info.index < siblings.length - 1) return siblings[info.index + 1].id;
            if (!parent) return siblings[info.index].id;
            const pInfo = nodeTree._findNode(parent.id);
            const pSiblings = pInfo.parent ? pInfo.parent.children : nodeTree.tree;
            const pIdx = pInfo.index;
            return pSiblings[pIdx + 1]?.id ?? parent.id;
        }
    }

    function handleArrow(direction, shift, ctrl) {
        if (!nodeTree.exists) return;
        const offset = direction === 'up' ? -1 : 1;
        const follow = direction === 'up' ? 'follow-up' : 'follow-down';
        const selected = nodeTree.selectedNodeIds;
        const hasAnchor = state.anchorId != null && state.tailId != null;
        const isMulti = selected.length > 1;

        if (!hasAnchor) {
            if (!isMulti) {
                const cur = selected[0];
                if (!cur) return;
                if (!ctrl) unfoldTo(cur);
                const { order } = dfs(true);
                if (!order.length) return;
                const orderSet = new Set(order);
                const vis = visibleAncestor(cur, orderSet);
                const idx = order.indexOf(vis);
                const target = order[idx + offset] ?? order[idx];
                setRange(target, target);
                setScrollRule({ type: follow, target });
            } else {
                if (ctrl) {
                    const { order } = dfs(true);
                    if (!order.length) return;
                    const orderSet = new Set(order);
                    const id = direction === 'up'
                        ? findTop(selected, order, orderSet)
                        : findBottom(selected, order, orderSet);
                    if (id != null) {
                        setRange(id, id);
                        setScrollRule({ type: follow, target: id });
                    }
                } else {
                    const { order: fullOrder } = dfs(false);
                    const unfoldTarget = direction === 'up'
                        ? findTop(selected, fullOrder)
                        : findBottom(selected, fullOrder);
                    if (unfoldTarget != null) unfoldTo(unfoldTarget);
                    const { order } = dfs(true);
                    if (!order.length) return;
                    const orderSet = new Set(order);
                    const id = direction === 'up'
                        ? findTop(selected, order, orderSet)
                        : findBottom(selected, order, orderSet);
                    if (id != null) {
                        setRange(id, id);
                        setScrollRule({ type: follow, target: id });
                    }
                }
            }
            return;
        }

        const anchor = state.anchorId;
        const tail = state.tailId;
        const singleRange = anchor === tail && selected.length === 1;

        if (singleRange) {
            if (ctrl && shift) {
                unfoldTo(tail);
                const newTail = moveSibling(tail, direction);
                const { order } = dfs(true);
                const orderSet = new Set(order);
                const aVis = visibleAncestor(anchor, orderSet);
                const tVis = visibleAncestor(newTail, orderSet);
                if (aVis != null && tVis != null) {
                    setRange(aVis, tVis);
                    setScrollRule({ type: follow, target: tVis });
                }
            } else if (ctrl) {
                unfoldTo(anchor);
                const newId = moveSibling(anchor, direction);
                const { order } = dfs(true);
                const orderSet = new Set(order);
                const vis = visibleAncestor(newId, orderSet);
                if (vis != null) {
                    setRange(vis, vis);
                    setScrollRule({ type: follow, target: vis });
                }
            } else if (shift) {
                unfoldTo(tail);
                const { order } = dfs(true);
                const orderSet = new Set(order);
                const aVis = visibleAncestor(anchor, orderSet);
                const tVis = visibleAncestor(tail, orderSet);
                if (aVis == null || tVis == null) return;
                const idx = order.indexOf(tVis);
                const newTail = order[idx + offset] ?? order[idx];
                setRange(aVis, newTail);
                setScrollRule({ type: follow, target: newTail });
            } else {
                unfoldTo(anchor);
                const { order } = dfs(true);
                if (!order.length) return;
                const orderSet = new Set(order);
                const vis = visibleAncestor(anchor, orderSet);
                if (vis == null) return;
                const idx = order.indexOf(vis);
                const target = order[idx + offset] ?? order[idx];
                setRange(target, target);
                setScrollRule({ type: follow, target });
            }
        } else {
            if (ctrl && shift) {
                unfoldTo(tail);
                const newTail = moveSibling(tail, direction);
                const { order } = dfs(true);
                const orderSet = new Set(order);
                const aVis = visibleAncestor(anchor, orderSet);
                const tVis = visibleAncestor(newTail, orderSet);
                if (aVis != null && tVis != null) {
                    setRange(aVis, tVis);
                    setScrollRule({ type: follow, target: tVis });
                }
            } else if (ctrl) {
                const { order } = dfs(true);
                if (!order.length) return;
                const orderSet = new Set(order);
                const id = direction === 'up'
                    ? findTop(selected, order, orderSet)
                    : findBottom(selected, order, orderSet);
                if (id != null) {
                    setRange(id, id);
                    setScrollRule({ type: follow, target: id });
                }
            } else if (shift) {
                unfoldTo(tail);
                const { order } = dfs(true);
                const orderSet = new Set(order);
                const aVis = visibleAncestor(anchor, orderSet);
                const tVis = visibleAncestor(tail, orderSet);
                if (aVis == null || tVis == null) return;
                const idx = order.indexOf(tVis);
                const newTail = order[idx + offset] ?? order[idx];
                setRange(aVis, newTail);
                setScrollRule({ type: follow, target: newTail });
            } else {
                const { order: fullOrder } = dfs(false);
                const unfoldTarget = direction === 'up'
                    ? findTop(selected, fullOrder)
                    : findBottom(selected, fullOrder);
                if (unfoldTarget != null) unfoldTo(unfoldTarget);
                const { order } = dfs(true);
                if (!order.length) return;
                const orderSet = new Set(order);
                const id = direction === 'up'
                    ? findTop(selected, order, orderSet)
                    : findBottom(selected, order, orderSet);
                if (id != null) {
                    setRange(id, id);
                    setScrollRule({ type: follow, target: id });
                }
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
        setContainer,
        unfoldTo,
        ensureBlockVisibility,
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

