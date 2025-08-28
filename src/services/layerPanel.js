import { defineStore } from 'pinia';
import { reactive, toRefs, watch, computed } from 'vue';
import { useStore } from '../stores';

export const useLayerPanelService = defineStore('layerPanelService', () => {
    const { layers } = useStore();

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
                () => layers.selectedIds,
                () => {
                    clearRange();
                },
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
        const walk = (nodes, anc) => {
            for (let i = nodes.length - 1; i >= 0; i--) {
                const node = nodes[i];
                ancestors.set(node.id, anc.slice());
                order.push(node.id);
                if (node.children && !(skipFolded && folded[node.id])) {
                    walk(node.children, anc.concat(node.id));
                }
            }
        };
        walk(layers.tree, []);
        return { order, ancestors };
    }

    function visibleAncestor(id, orderSet) {
        let info = layers._findNode(id);
        while (info && !orderSet.has(info.node.id)) {
            if (!info.parent) return null;
            info = layers._findNode(info.parent.id);
        }
        return info ? info.node.id : null;
    }

    function setRange(anchorId = null, tailId = null) {
        disableWatch();
        if (anchorId == null || tailId == null) {
            state.anchorId = null;
            state.tailId = null;
            layers.clearSelection();
            return;
        }

        const { order, ancestors } = dfs(false);
        const idxA = order.indexOf(anchorId);
        const idxB = order.indexOf(tailId);
        if (idxA === -1 || idxB === -1) {
            state.anchorId = null;
            state.tailId = null;
            layers.clearSelection();
            return;
        }
        const [start, end] = idxA < idxB ? [idxA, idxB] : [idxB, idxA];
        const slice = order.slice(start, end + 1);
        const ancToRemove = new Set([
            ...(ancestors.get(anchorId) || []),
            ...(ancestors.get(tailId) || []),
        ]);
        const selection = slice.filter(id => !ancToRemove.has(id));
        layers.replaceSelection(selection);
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

    function onLayerClick(id, event) {
        if (event.shiftKey) {
            setRange(state.anchorId ?? id, id);
        } else if (event.ctrlKey || event.metaKey) {
            layers.toggleSelection(id);
        } else {
            setRange(id, id);
        }
        setScrollRule({ type: 'follow', target: id });
    }

    function onArrowUp(shift, ctrl) {
        if (!layers.exists || ctrl) return;
        const { order } = dfs(true);
        if (!order.length) return;
        const orderSet = new Set(order);
        if (shift) {
            if (!layers.selectionExists) return;
            const tailVis = visibleAncestor(state.tailId, orderSet);
            const anchorVis = visibleAncestor(state.anchorId, orderSet);
            if (tailVis == null || anchorVis == null) return;
            const idx = order.indexOf(tailVis);
            const newTail = order[idx - 1] ?? order[0];
            setRange(anchorVis, newTail);
            setScrollRule({ type: 'follow-up', target: newTail });
        } else {
            const anchorVis = visibleAncestor(state.anchorId, orderSet);
            if (anchorVis == null) return;
            const idx = order.indexOf(anchorVis);
            const nextId = order[idx - 1] ?? anchorVis;
            setRange(nextId, nextId);
            setScrollRule({ type: 'follow-up', target: nextId });
        }
    }

    function onArrowDown(shift, ctrl) {
        if (!layers.exists || ctrl) return;
        const { order } = dfs(true);
        if (!order.length) return;
        const orderSet = new Set(order);
        if (shift) {
            if (!layers.selectionExists) return;
            const tailVis = visibleAncestor(state.tailId, orderSet);
            const anchorVis = visibleAncestor(state.anchorId, orderSet);
            if (tailVis == null || anchorVis == null) return;
            const idx = order.indexOf(tailVis);
            const newTail = order[idx + 1] ?? order[order.length - 1];
            setRange(anchorVis, newTail);
            setScrollRule({ type: 'follow-down', target: newTail });
        } else {
            const anchorVis = visibleAncestor(state.anchorId, orderSet);
            if (anchorVis == null) return;
            const idx = order.indexOf(anchorVis);
            const nextId = order[idx + 1] ?? anchorVis;
            setRange(nextId, nextId);
            setScrollRule({ type: 'follow-down', target: nextId });
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
            anchor: state.anchorId,
            tailId: state.tailId,
            scrollRule: state.scrollRule,
            folded: { ...folded },
        };
    }

    function applySerialized(payload) {
        disableWatch();
        state.anchorId = payload?.anchor ?? null;
        state.tailId = payload?.tailId ?? null;
        if (state.anchorId != null && state.tailId != null) {
            enableWatch();
        }
        state.scrollRule = payload?.scrollRule;
        for (const key of Object.keys(folded)) delete folded[key];
        Object.assign(folded, payload?.folded || {});
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

