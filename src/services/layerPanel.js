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

    function onArrow(direction, shift, ctrl) {
        if (!nodeTree.exists) return;
        const anchorExists = state.anchorId != null && state.tailId != null;
        const selection = nodeTree.selectedIds;
        const selCount = selection.length;
        if (selCount === 0) return;

        function scroll(target) {
            setScrollRule({ type: direction === 'up' ? 'follow-up' : 'follow-down', target });
        }

        function getTopBottom(order, ids) {
            const index = new Map(order.map((id, idx) => [id, idx]));
            let topId = null, bottomId = null;
            let topIdx = Infinity, bottomIdx = -1;
            for (const id of ids) {
                const idx = index.get(id);
                if (idx == null) continue;
                if (idx < topIdx) { topIdx = idx; topId = id; }
                if (idx > bottomIdx) { bottomIdx = idx; bottomId = id; }
            }
            return { topId, bottomId };
        }

        function movePrevNext(baseId, unfold = false) {
            if (baseId == null) return;
            if (unfold) unfoldTo(baseId);
            const { order } = dfs(true);
            if (!order.length) return;
            const orderSet = new Set(order);
            const vis = visibleAncestor(baseId, orderSet);
            if (vis == null) return;
            const idx = order.indexOf(vis);
            const target = direction === 'up'
                ? (order[idx - 1] ?? order[0])
                : (order[idx + 1] ?? order[order.length - 1]);
            setRange(target, target);
            scroll(target);
        }

        function rangePrevNext(anchorId, tailId, unfold = false) {
            if (anchorId == null || tailId == null) return;
            if (unfold) unfoldTo(tailId);
            const { order } = dfs(true);
            if (!order.length) return;
            const orderSet = new Set(order);
            const anchorVis = visibleAncestor(anchorId, orderSet);
            const tailVis = visibleAncestor(tailId, orderSet);
            if (anchorVis == null || tailVis == null) return;
            const idx = order.indexOf(tailVis);
            const target = direction === 'up'
                ? (order[idx - 1] ?? order[0])
                : (order[idx + 1] ?? order[order.length - 1]);
            setRange(anchorVis, target);
            scroll(target);
        }

        function extremeSelect(unfold) {
            if (unfold) {
                const { order: allOrder } = dfs(false);
                const { topId, bottomId } = getTopBottom(allOrder, selection);
                const tgt = direction === 'up' ? topId : bottomId;
                if (tgt != null) unfoldTo(tgt);
            }
            const { order } = dfs(true);
            if (!order.length) return;
            const orderSet = new Set(order);
            const vis = [];
            for (const id of selection) {
                const v = visibleAncestor(id, orderSet);
                if (v != null) vis.push(v);
            }
            const { topId, bottomId } = getTopBottom(order, vis);
            const target = direction === 'up' ? topId : bottomId;
            if (target != null) {
                setRange(target, target);
                scroll(target);
            }
        }

        function siblingMove(anchorFixed) {
            let baseId = state.tailId;
            unfoldTo(baseId);
            if (anchorFixed) unfoldTo(state.anchorId);
            let targetId = baseId;
            const info = nodeTree._findNode(baseId);
            if (info && info.parent) {
                const siblings = info.parent.children;
                if (direction === 'up') {
                    if (info.index < siblings.length - 1) {
                        targetId = siblings[info.index + 1].id;
                    } else {
                        targetId = info.parent.id;
                    }
                } else {
                    if (info.index > 0) {
                        targetId = siblings[info.index - 1].id;
                    } else {
                        const pInfo = nodeTree._findNode(info.parent.id);
                        if (pInfo && pInfo.parent) {
                            const pSiblings = pInfo.parent.children;
                            targetId = pSiblings[pInfo.index - 1]?.id ?? pInfo.parent.id;
                        } else {
                            targetId = info.parent.id;
                        }
                    }
                }
            }
            unfoldTo(targetId);
            const { order } = dfs(true);
            if (!order.length) return;
            const orderSet = new Set(order);
            const tailVis = visibleAncestor(targetId, orderSet);
            if (tailVis == null) return;
            if (anchorFixed) {
                const anchorVis = visibleAncestor(state.anchorId, orderSet);
                if (anchorVis == null) return;
                setRange(anchorVis, tailVis);
            } else {
                setRange(tailVis, tailVis);
            }
            scroll(tailVis);
        }

        if (!anchorExists) {
            if (selCount === 1) {
                movePrevNext(selection[0], !ctrl);
            } else {
                extremeSelect(!ctrl);
            }
        } else {
            if (selCount === 1) {
                if (ctrl && shift) siblingMove(true);
                else if (ctrl) siblingMove(false);
                else if (shift) rangePrevNext(state.anchorId, state.tailId, true);
                else movePrevNext(state.anchorId, true);
            } else {
                if (ctrl && shift) siblingMove(true);
                else if (ctrl) extremeSelect(false);
                else if (shift) rangePrevNext(state.anchorId, state.tailId, true);
                else extremeSelect(true);
            }
        }
    }

    function onArrowUp(shift, ctrl) {
        onArrow('up', shift, ctrl);
    }

    function onArrowDown(shift, ctrl) {
        onArrow('down', shift, ctrl);
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

