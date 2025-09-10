import { defineStore } from 'pinia';
import { reactive, ref, toRefs, watch, computed } from 'vue';
import { useStore } from '../stores';
import { clamp } from '../utils';

export const useLayerPanelService = defineStore('layerPanelService', () => {
    const { nodeTree, nodes } = useStore();

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
            if (!info.parent) break;
            info = nodeTree._findNode(info.parent.id);
            folded[info.node.id] = false;
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

    function onArrow(direction, shift, ctrl) {
        if (!nodeTree.exists) return;

        const selected = nodeTree.selectedIds;
        const hasAnchor = state.anchorId != null;
        const single = selected.length === 1;

        const scrollType = direction === 'up' ? 'follow-up' : 'follow-down';

        const adjVisible = (id, unfold) => {
            if (unfold) unfoldTo(id);
            const { order } = dfs(true);
            const orderSet = new Set(order);
            const vis = visibleAncestor(id, orderSet);
            if (vis == null) return null;
            const idx = order.indexOf(vis);
            const nextId = direction === 'up'
                ? order[idx - 1] ?? vis
                : order[idx + 1] ?? vis;
            return nextId;
        };

        const extremeSelected = (ids, unfold) => {
            const { order } = dfs(false);
            const index = new Map(order.map((id, i) => [id, i]));
            let best = ids[0];
            for (const id of ids) {
                if (index.get(id) == null) continue;
                if (direction === 'up') {
                    if (index.get(id) < index.get(best)) best = id;
                } else {
                    if (index.get(id) > index.get(best)) best = id;
                }
            }
            if (unfold) unfoldTo(best);
            return best;
        };

        const extremeVisibleSelected = (ids) => {
            const { order } = dfs(true);
            const index = new Map(order.map((id, i) => [id, i]));
            const orderSet = new Set(order);
            const vis = ids.map(id => visibleAncestor(id, orderSet)).filter(Boolean);
            if (!vis.length) return null;
            let best = vis[0];
            for (const id of vis) {
                if (direction === 'up') {
                    if (index.get(id) < index.get(best)) best = id;
                } else {
                    if (index.get(id) > index.get(best)) best = id;
                }
            }
            return best;
        };

        const siblingNavigate = (id) => {
            const info = nodeTree._findNode(id);
            if (!info) return id;
            const parent = info.parent;
            const siblings = parent ? parent.children : nodeTree.tree;
            const idx = siblings.findIndex(n => n.id === id);
            if (direction === 'up') {
                const sib = siblings[idx + 1];
                if (sib) return sib.id;
                return parent ? parent.id : id;
            } else {
                const sib = siblings[idx - 1];
                if (sib) return sib.id;
                if (!parent) return id;
                const pInfo = nodeTree._findNode(parent.id);
                const pParent = pInfo?.parent;
                const pSiblings = pParent ? pParent.children : nodeTree.tree;
                const pIdx = pSiblings.findIndex(n => n.id === parent.id);
                return pSiblings[pIdx - 1]?.id ?? parent.id;
            }
        };

        // Case distinctions
        if (!hasAnchor) {
            if (single) {
                const id = selected[0];
                if (ctrl) {
                    const nextId = adjVisible(id, false);
                    if (nextId == null) return;
                    setRange(nextId, nextId);
                    setScrollRule({ type: scrollType, target: nextId });
                } else {
                    const nextId = adjVisible(id, true);
                    if (nextId == null) return;
                    setRange(nextId, nextId);
                    setScrollRule({ type: scrollType, target: nextId });
                }
            } else if (selected.length > 1) {
                if (ctrl) {
                    const target = extremeVisibleSelected(selected);
                    if (target == null) return;
                    setRange(target, target);
                    setScrollRule({ type: scrollType, target });
                } else {
                    const target = extremeSelected(selected, true);
                    const { order } = dfs(true);
                    const vis = visibleAncestor(target, new Set(order));
                    if (vis == null) return;
                    setRange(vis, vis);
                    setScrollRule({ type: scrollType, target: vis });
                }
            } else {
                const { order } = dfs(true);
                const target = direction === 'up' ? order[order.length - 1] : order[0];
                setRange(target, target);
                setScrollRule({ type: scrollType, target });
            }
            return;
        }

        // anchor exists
        if (single) {
            if (shift && ctrl) {
                const target = siblingNavigate(state.tailId);
                unfoldTo(target);
                setRange(state.anchorId, target);
                setScrollRule({ type: scrollType, target });
            } else if (shift) {
                const nextId = adjVisible(state.tailId, true);
                if (nextId == null) return;
                setRange(state.anchorId, nextId);
                setScrollRule({ type: scrollType, target: nextId });
            } else if (ctrl) {
                const target = siblingNavigate(state.anchorId);
                unfoldTo(target);
                setRange(target, target);
                setScrollRule({ type: scrollType, target });
            } else {
                const nextId = adjVisible(state.anchorId, true);
                if (nextId == null) return;
                setRange(nextId, nextId);
                setScrollRule({ type: scrollType, target: nextId });
            }
        } else {
            // multi-selection with anchor
            if (shift && ctrl) {
                const target = siblingNavigate(state.tailId);
                unfoldTo(target);
                setRange(state.anchorId, target);
                setScrollRule({ type: scrollType, target });
            } else if (shift) {
                const nextId = adjVisible(state.tailId, true);
                if (nextId == null) return;
                setRange(state.anchorId, nextId);
                setScrollRule({ type: scrollType, target: nextId });
            } else if (ctrl) {
                const target = extremeVisibleSelected(nodeTree.selectedIds);
                if (target == null) return;
                setRange(target, target);
                setScrollRule({ type: scrollType, target });
            } else {
                const target = extremeSelected(nodeTree.selectedIds, true);
                const { order } = dfs(true);
                const vis = visibleAncestor(target, new Set(order));
                if (vis == null) return;
                setRange(vis, vis);
                setScrollRule({ type: scrollType, target: vis });
            }
        }
    }

    function onArrowUp(shift, ctrl) { onArrow('up', shift, ctrl); }

    function onArrowDown(shift, ctrl) { onArrow('down', shift, ctrl); }

    function onEnter(e) {
        const tail = state.tailId;
        if (tail == null) {
            if (nodeTree.selectedIds.length) {
                const id = nodeTree.selectedIds[nodeTree.selectedIds.length - 1];
                unfoldTo(id);
                setRange(id, id);
                setScrollRule({ type: 'follow', target: id });
            }
            return;
        }

        if (nodes.isGroup(tail)) {
            toggleFold(tail);
            return;
        }
        const row = document.querySelector(`.layer[data-id="${tail}"] .nameText`);
        if (!row) {
            unfoldTo(tail);
            setScrollRule({ type: 'follow', target: tail });
            return;
        }
        if (row !== e.target) {
            row.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
            return;
        }

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
        onEnter,
        selectAll,
        serialize,
        applySerialized,
    };
});

