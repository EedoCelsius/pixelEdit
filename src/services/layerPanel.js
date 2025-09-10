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

    function visibleSelection(order, orderSet) {
        const resultSet = new Set();
        for (const id of nodeTree.selectedNodeIds) {
            const vis = visibleAncestor(id, orderSet);
            if (vis != null) resultSet.add(vis);
        }
        const result = [];
        for (const id of order) if (resultSet.has(id)) result.push(id);
        return result;
    }

    function moveInOrder(id, dir, order) {
        const idx = order.indexOf(id);
        if (idx === -1) return dir < 0 ? order[0] : order[order.length - 1];
        return dir < 0 ? (order[idx - 1] ?? order[0]) : (order[idx + 1] ?? order[order.length - 1]);
    }

    function moveSibling(id, dir) {
        const info = nodeTree._findNode(id);
        if (!info || !info.parent) return null;
        const siblings = info.parent.children;
        if (dir < 0) {
            if (info.index < siblings.length - 1) return siblings[info.index + 1].id;
            return info.parent.id;
        } else {
            if (info.index > 0) return siblings[info.index - 1].id;
            const parentInfo = nodeTree._findNode(info.parent.id);
            if (!parentInfo) return null;
            const parentSiblings = parentInfo.parent ? parentInfo.parent.children : nodeTree.tree;
            return parentInfo.index > 0 ? parentSiblings[parentInfo.index - 1].id : null;
        }
    }

    function arrowSelect(dir, shift, ctrl) {
        if (!nodeTree.exists) return;
        const scrollType = dir < 0 ? 'follow-up' : 'follow-down';
        const hasAnchor = state.anchorId != null && state.tailId != null;
        const selectionCount = nodeTree.selectedNodeCount;
        if (selectionCount === 0) return;

        if (!hasAnchor) {
            if (selectionCount === 1) {
                const id = nodeTree.selectedNodeIds[0];
                if (!ctrl) unfoldTo(id);
                const { order } = dfs(true);
                if (!order.length) return;
                const orderSet = new Set(order);
                const vis = visibleAncestor(id, orderSet);
                if (vis == null) return;
                const newId = moveInOrder(vis, dir, order);
                setRange(newId, newId);
                setScrollRule({ type: scrollType, target: newId });
            } else {
                if (ctrl) {
                    const { order } = dfs(true);
                    if (!order.length) return;
                    const orderSet = new Set(order);
                    const visible = visibleSelection(order, orderSet);
                    if (!visible.length) return;
                    const newId = dir < 0 ? visible[0] : visible[visible.length - 1];
                    setRange(newId, newId);
                    setScrollRule({ type: scrollType, target: newId });
                } else {
                    const { order } = dfs(false);
                    const selectedSet = new Set(nodeTree.selectedNodeIds);
                    const selectedOrder = order.filter(id => selectedSet.has(id));
                    if (!selectedOrder.length) return;
                    unfoldTo(dir < 0 ? selectedOrder[0] : selectedOrder[selectedOrder.length - 1]);
                    const { order: visOrder } = dfs(true);
                    const visSet = new Set(visOrder);
                    const visible = visibleSelection(visOrder, visSet);
                    if (!visible.length) return;
                    const newId = dir < 0 ? visible[0] : visible[visible.length - 1];
                    setRange(newId, newId);
                    setScrollRule({ type: scrollType, target: newId });
                }
            }
        } else {
            if (selectionCount === 1) {
                const current = state.tailId;
                if (ctrl && shift) {
                    unfoldTo(current);
                    const newTail = moveSibling(current, dir);
                    if (newTail == null) return;
                    setRange(state.anchorId, newTail);
                    setScrollRule({ type: scrollType, target: newTail });
                } else if (ctrl) {
                    unfoldTo(current);
                    const newId = moveSibling(current, dir);
                    if (newId == null) return;
                    setRange(newId, newId);
                    setScrollRule({ type: scrollType, target: newId });
                } else if (shift) {
                    unfoldTo(current);
                    const { order } = dfs(true);
                    if (!order.length) return;
                    const newTail = moveInOrder(current, dir, order);
                    setRange(state.anchorId, newTail);
                    setScrollRule({ type: scrollType, target: newTail });
                } else {
                    unfoldTo(current);
                    const { order } = dfs(true);
                    if (!order.length) return;
                    const newId = moveInOrder(current, dir, order);
                    setRange(newId, newId);
                    setScrollRule({ type: scrollType, target: newId });
                }
            } else {
                if (ctrl && shift) {
                    const tail = state.tailId;
                    unfoldTo(tail);
                    const newTail = moveSibling(tail, dir);
                    if (newTail == null) return;
                    setRange(state.anchorId, newTail);
                    setScrollRule({ type: scrollType, target: newTail });
                } else if (shift) {
                    const tail = state.tailId;
                    unfoldTo(tail);
                    const { order } = dfs(true);
                    if (!order.length) return;
                    const newTail = moveInOrder(tail, dir, order);
                    setRange(state.anchorId, newTail);
                    setScrollRule({ type: scrollType, target: newTail });
                } else if (ctrl) {
                    const { order } = dfs(true);
                    if (!order.length) return;
                    const orderSet = new Set(order);
                    const visible = visibleSelection(order, orderSet);
                    if (!visible.length) return;
                    const newId = dir < 0 ? visible[0] : visible[visible.length - 1];
                    setRange(newId, newId);
                    setScrollRule({ type: scrollType, target: newId });
                } else {
                    const { order } = dfs(false);
                    const selectedSet = new Set(nodeTree.selectedNodeIds);
                    const selectedOrder = order.filter(id => selectedSet.has(id));
                    if (!selectedOrder.length) return;
                    unfoldTo(dir < 0 ? selectedOrder[0] : selectedOrder[selectedOrder.length - 1]);
                    const { order: visOrder } = dfs(true);
                    const visSet = new Set(visOrder);
                    const visible = visibleSelection(visOrder, visSet);
                    if (!visible.length) return;
                    const newId = dir < 0 ? visible[0] : visible[visible.length - 1];
                    setRange(newId, newId);
                    setScrollRule({ type: scrollType, target: newId });
                }
            }
        }
    }

    function onArrowUp(shift, ctrl) {
        arrowSelect(-1, shift, ctrl);
    }

    function onArrowDown(shift, ctrl) {
        arrowSelect(1, shift, ctrl);
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

