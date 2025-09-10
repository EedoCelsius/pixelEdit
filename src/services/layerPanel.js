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

    function moveSibling(id, dir) {
        let info = nodeTree._findNode(id);
        if (!info) return id;
        const siblings = info.parent ? info.parent.children : nodeTree.tree;
        if (dir < 0) {
            if (info.index > 0) return siblings[info.index - 1].id;
            return info.parent ? info.parent.id : info.node.id;
        } else {
            if (info.index < siblings.length - 1) return siblings[info.index + 1].id;
            let pInfo = info.parent ? nodeTree._findNode(info.parent.id) : null;
            while (pInfo) {
                const list = pInfo.parent ? pInfo.parent.children : nodeTree.tree;
                if (pInfo.index < list.length - 1) return list[pInfo.index + 1].id;
                pInfo = pInfo.parent ? nodeTree._findNode(pInfo.parent.id) : null;
            }
            return info.node.id;
        }
    }

    function handleArrow(dir, shift, ctrl) {
        if (!nodeTree.exists) return;
        const selIds = nodeTree.selectedLayerIds;
        if (!selIds.length) return;
        const anchorExists = state.anchorId != null && state.tailId != null;
        const single = selIds.length === 1;

        const followType = dir < 0 ? 'follow-up' : 'follow-down';

        if (!anchorExists && single) { // case 1
            const current = selIds[0];
            if (!ctrl) unfoldTo(current);
            const { order } = dfs(true);
            if (!order.length) return;
            const idx = order.indexOf(current);
            if (idx === -1) return;
            const newId = order[clamp(idx + dir, 0, order.length - 1)];
            setRange(newId, newId);
            setScrollRule({ type: followType, target: newId });
            return;
        }

        if (!anchorExists && selIds.length > 1) { // case 2
            if (ctrl) {
                const { order } = dfs(true);
                const index = new Map(order.map((id, i) => [id, i]));
                const orderSet = new Set(order);
                let target = null, pos = dir < 0 ? Infinity : -1;
                for (const id of selIds) {
                    const vis = visibleAncestor(id, orderSet);
                    if (vis == null) continue;
                    const i = index.get(vis);
                    if ((dir < 0 && i < pos) || (dir > 0 && i > pos)) {
                        pos = i; target = vis;
                    }
                }
                if (target == null) return;
                setRange(target, target);
                setScrollRule({ type: followType, target });
            } else {
                const { order } = dfs(false);
                const selectedSet = new Set(selIds);
                let target = null;
                if (dir < 0) {
                    for (const id of order) { if (selectedSet.has(id)) { target = id; break; } }
                } else {
                    for (let i = order.length - 1; i >= 0; i--) { const id = order[i]; if (selectedSet.has(id)) { target = id; break; } }
                }
                if (target == null) return;
                unfoldTo(target);
                setRange(target, target);
                setScrollRule({ type: followType, target });
            }
            return;
        }

        if (anchorExists && single) { // case 3
            const current = state.tailId;
            if (ctrl && shift) {
                unfoldTo(current);
                const newTail = moveSibling(current, dir);
                setRange(state.anchorId, newTail);
                setScrollRule({ type: followType, target: newTail });
            } else if (ctrl) {
                unfoldTo(current);
                const newId = moveSibling(current, dir);
                setRange(newId, newId);
                setScrollRule({ type: followType, target: newId });
            } else if (shift) {
                unfoldTo(current);
                const { order } = dfs(true);
                const idx = order.indexOf(current);
                if (idx === -1) return;
                const newTail = order[clamp(idx + dir, 0, order.length - 1)];
                setRange(state.anchorId, newTail);
                setScrollRule({ type: followType, target: newTail });
            } else {
                unfoldTo(current);
                const { order } = dfs(true);
                const idx = order.indexOf(current);
                if (idx === -1) return;
                const newId = order[clamp(idx + dir, 0, order.length - 1)];
                setRange(newId, newId);
                setScrollRule({ type: followType, target: newId });
            }
            return;
        }

        if (anchorExists && selIds.length > 1) { // case 4
            if (ctrl && shift) {
                const currentTail = state.tailId;
                unfoldTo(currentTail);
                const newTail = moveSibling(currentTail, dir);
                setRange(state.anchorId, newTail);
                setScrollRule({ type: followType, target: newTail });
            } else if (ctrl) {
                const { order } = dfs(true);
                const index = new Map(order.map((id, i) => [id, i]));
                const orderSet = new Set(order);
                let target = null, pos = dir < 0 ? Infinity : -1;
                for (const id of selIds) {
                    const vis = visibleAncestor(id, orderSet);
                    if (vis == null) continue;
                    const i = index.get(vis);
                    if ((dir < 0 && i < pos) || (dir > 0 && i > pos)) {
                        pos = i; target = vis;
                    }
                }
                if (target == null) return;
                setRange(target, target);
                setScrollRule({ type: followType, target });
            } else if (shift) {
                const currentTail = state.tailId;
                unfoldTo(currentTail);
                const { order } = dfs(true);
                const idx = order.indexOf(currentTail);
                if (idx === -1) return;
                const newTail = order[clamp(idx + dir, 0, order.length - 1)];
                setRange(state.anchorId, newTail);
                setScrollRule({ type: followType, target: newTail });
            } else {
                const { order } = dfs(false);
                const selectedSet = new Set(selIds);
                let target = null;
                if (dir < 0) {
                    for (const id of order) { if (selectedSet.has(id)) { target = id; break; } }
                } else {
                    for (let i = order.length - 1; i >= 0; i--) { const id = order[i]; if (selectedSet.has(id)) { target = id; break; } }
                }
                if (target == null) return;
                unfoldTo(target);
                setRange(target, target);
                setScrollRule({ type: followType, target });
            }
        }
    }

    function onArrowUp(shift, ctrl) {
        handleArrow(-1, shift, ctrl);
    }

    function onArrowDown(shift, ctrl) {
        handleArrow(1, shift, ctrl);
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

