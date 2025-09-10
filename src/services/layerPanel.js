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
        const info = nodeTree._findNode(id);
        if (!info) return id;
        const list = info.parent ? info.parent.children : nodeTree.tree;
        if (dir === 'up') {
            if (info.index > 0) return list[info.index - 1].id;
            return info.parent ? info.parent.id : list[0].id;
        } else {
            if (info.index < list.length - 1) return list[info.index + 1].id;
            if (info.parent) {
                const pInfo = nodeTree._findNode(info.parent.id);
                const pList = pInfo.parent ? pInfo.parent.children : nodeTree.tree;
                if (pInfo.index < pList.length - 1) return pList[pInfo.index + 1].id;
            }
            return info.node.id;
        }
    }

    function onArrow(dir, shift, ctrl) {
        if (!nodeTree.exists) return;
        const selection = nodeTree.orderedSelection;
        if (!selection.length) return;
        const hasAnchor = state.anchorId != null && state.tailId != null;
        const single = selection.length === 1;
        const isUp = dir === 'up';
        const scrollType = isUp ? 'follow-up' : 'follow-down';

        if (!hasAnchor) {
            if (single) {
                if (!ctrl) unfoldTo(selection[0]);
            } else if (!ctrl) {
                const target = isUp ? selection[0] : selection[selection.length - 1];
                unfoldTo(target);
            }
        } else {
            if (single) {
                unfoldTo(selection[0]);
            } else if (shift) {
                unfoldTo(state.tailId);
            } else if (!ctrl) {
                const target = isUp ? selection[0] : selection[selection.length - 1];
                unfoldTo(target);
            }
        }

        const { order } = dfs(true);
        if (!order.length) return;
        const orderSet = new Set(order);
        const getVis = id => visibleAncestor(id, orderSet);
        const anchorVis = hasAnchor ? getVis(state.anchorId) : null;
        const tailVis = hasAnchor ? getVis(state.tailId) : null;

        if (!hasAnchor) {
            if (single) {
                const cur = getVis(selection[0]);
                if (cur == null) return;
                const idx = order.indexOf(cur);
                const nextId = isUp ? (order[idx - 1] ?? order[0]) : (order[idx + 1] ?? order[order.length - 1]);
                setRange(nextId, nextId);
                setScrollRule({ type: scrollType, target: nextId });
            } else {
                const target = isUp ? selection[0] : selection[selection.length - 1];
                const nextId = getVis(target);
                if (nextId == null) return;
                setRange(nextId, nextId);
                setScrollRule({ type: scrollType, target: nextId });
            }
        } else if (single) {
            if (ctrl && shift) {
                const nextTail = moveSibling(state.tailId, dir);
                setRange(anchorVis ?? nextTail, nextTail);
                setScrollRule({ type: scrollType, target: nextTail });
            } else if (ctrl) {
                const nextId = moveSibling(selection[0], dir);
                setRange(nextId, nextId);
                setScrollRule({ type: scrollType, target: nextId });
            } else if (shift) {
                if (tailVis == null || anchorVis == null) return;
                const idx = order.indexOf(tailVis);
                const newTail = isUp ? (order[idx - 1] ?? order[0]) : (order[idx + 1] ?? order[order.length - 1]);
                setRange(anchorVis, newTail);
                setScrollRule({ type: scrollType, target: newTail });
            } else {
                const cur = getVis(selection[0]);
                if (cur == null) return;
                const idx = order.indexOf(cur);
                const nextId = isUp ? (order[idx - 1] ?? order[0]) : (order[idx + 1] ?? order[order.length - 1]);
                setRange(nextId, nextId);
                setScrollRule({ type: scrollType, target: nextId });
            }
        } else {
            if (ctrl && shift) {
                const nextTail = moveSibling(state.tailId, dir);
                setRange(anchorVis ?? nextTail, nextTail);
                setScrollRule({ type: scrollType, target: nextTail });
            } else if (ctrl) {
                const target = isUp ? selection[0] : selection[selection.length - 1];
                const nextId = getVis(target);
                if (nextId == null) return;
                setRange(nextId, nextId);
                setScrollRule({ type: scrollType, target: nextId });
            } else if (shift) {
                if (tailVis == null || anchorVis == null) return;
                const idx = order.indexOf(tailVis);
                const newTail = isUp ? (order[idx - 1] ?? order[0]) : (order[idx + 1] ?? order[order.length - 1]);
                setRange(anchorVis, newTail);
                setScrollRule({ type: scrollType, target: newTail });
            } else {
                const target = isUp ? selection[0] : selection[selection.length - 1];
                const nextId = getVis(target);
                if (nextId == null) return;
                setRange(nextId, nextId);
                setScrollRule({ type: scrollType, target: nextId });
            }
        }
    }

    function onArrowUp(shift, ctrl) { onArrow('up', shift, ctrl); }

    function onArrowDown(shift, ctrl) { onArrow('down', shift, ctrl); }

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

