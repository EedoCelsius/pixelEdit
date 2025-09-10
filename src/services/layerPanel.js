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

    function step(id, order, dir) {
        const idx = order.indexOf(id);
        if (idx === -1) return id;
        const nidx = clamp(idx + dir, 0, order.length - 1);
        return order[nidx];
    }

    function topmost(ids, order) {
        let res = null, best = Infinity;
        for (const id of ids) {
            const idx = order.indexOf(id);
            if (idx !== -1 && idx < best) {
                best = idx;
                res = id;
            }
        }
        return res;
    }

    function bottommost(ids, order) {
        let res = null, best = -1;
        for (const id of ids) {
            const idx = order.indexOf(id);
            if (idx !== -1 && idx > best) {
                best = idx;
                res = id;
            }
        }
        return res;
    }

    function prevSiblingOrParent(id) {
        const info = nodeTree._findNode(id);
        if (!info || !info.parent) return id;
        const siblings = info.parent.children;
        const idx = siblings.findIndex(n => n.id === id);
        const prev = siblings[idx + 1];
        return prev ? prev.id : info.parent.id;
    }

    function nextSiblingOrParentSibling(id) {
        const info = nodeTree._findNode(id);
        if (!info || !info.parent) return id;
        const siblings = info.parent.children;
        const idx = siblings.findIndex(n => n.id === id);
        const next = siblings[idx - 1];
        if (next) return next.id;
        const parentInfo = nodeTree._findNode(info.parent.id);
        if (parentInfo && parentInfo.parent) {
            const pSiblings = parentInfo.parent.children;
            const pIdx = pSiblings.findIndex(n => n.id === parentInfo.node.id);
            const pNext = pSiblings[pIdx - 1];
            if (pNext) return pNext.id;
        }
        return id;
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

    function handleArrow(up, shift, ctrl) {
        if (!nodeTree.exists) return;
        const selection = nodeTree.selectedIds;
        if (!selection.length) return;
        const hasAnchor = state.anchorId != null && state.tailId != null;
        const single = selection.length === 1;
        const dir = up ? -1 : 1;
        const scrollType = up ? 'follow-up' : 'follow-down';

        if (!hasAnchor && single) {
            const id = selection[0];
            if (!ctrl) unfoldTo(id);
            const { order } = dfs(true);
            const orderSet = new Set(order);
            const vis = visibleAncestor(id, orderSet);
            if (vis == null) return;
            const target = step(vis, order, dir);
            setRange(target, target);
            setScrollRule({ type: scrollType, target });
            return;
        }

        if (!hasAnchor && !single) {
            const { order: full } = dfs(false);
            const cand = up ? topmost(selection, full) : bottommost(selection, full);
            if (cand == null) return;
            if (!ctrl) unfoldTo(cand);
            const { order } = dfs(true);
            const vis = visibleAncestor(cand, new Set(order));
            if (vis == null) return;
            setRange(vis, vis);
            setScrollRule({ type: scrollType, target: vis });
            return;
        }

        if (hasAnchor && single) {
            const id = state.tailId;
            if (ctrl && !shift) {
                unfoldTo(id);
                const target = up ? prevSiblingOrParent(id) : nextSiblingOrParentSibling(id);
                setRange(target, target);
                setScrollRule({ type: scrollType, target });
                return;
            }
            if (ctrl && shift) {
                unfoldTo(id);
                const target = up ? prevSiblingOrParent(id) : nextSiblingOrParentSibling(id);
                setRange(state.anchorId, target);
                setScrollRule({ type: scrollType, target });
                return;
            }
            if (shift) {
                unfoldTo(id);
                const { order } = dfs(true);
                const vis = visibleAncestor(id, new Set(order));
                if (vis == null) return;
                const target = step(vis, order, dir);
                setRange(state.anchorId, target);
                setScrollRule({ type: scrollType, target });
                return;
            }
            unfoldTo(id);
            const { order } = dfs(true);
            const vis = visibleAncestor(id, new Set(order));
            if (vis == null) return;
            const target = step(vis, order, dir);
            setRange(target, target);
            setScrollRule({ type: scrollType, target });
            return;
        }

        // hasAnchor && !single
        if (ctrl && !shift) {
            const { order: full } = dfs(false);
            const cand = up ? topmost(selection, full) : bottommost(selection, full);
            if (cand == null) return;
            const { order } = dfs(true);
            const vis = visibleAncestor(cand, new Set(order));
            if (vis == null) return;
            setRange(vis, vis);
            setScrollRule({ type: scrollType, target: vis });
            return;
        }
        if (!ctrl && !shift) {
            const { order: full } = dfs(false);
            const cand = up ? topmost(selection, full) : bottommost(selection, full);
            if (cand == null) return;
            unfoldTo(cand);
            const { order } = dfs(true);
            const vis = visibleAncestor(cand, new Set(order));
            if (vis == null) return;
            setRange(vis, vis);
            setScrollRule({ type: scrollType, target: vis });
            return;
        }
        if (ctrl && shift) {
            unfoldTo(state.tailId);
            const target = up ? prevSiblingOrParent(state.tailId) : nextSiblingOrParentSibling(state.tailId);
            setRange(state.anchorId, target);
            setScrollRule({ type: scrollType, target });
            return;
        }
        // shift only
        unfoldTo(state.tailId);
        const { order } = dfs(true);
        const vis = visibleAncestor(state.tailId, new Set(order));
        if (vis == null) return;
        const target = step(vis, order, dir);
        setRange(state.anchorId, target);
        setScrollRule({ type: scrollType, target });
    }

    function onArrowUp(shift, ctrl) {
        handleArrow(true, shift, ctrl);
    }

    function onArrowDown(shift, ctrl) {
        handleArrow(false, shift, ctrl);
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

