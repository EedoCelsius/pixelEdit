import { defineStore } from 'pinia';
import { reactive, toRefs, watch, computed } from 'vue';
import { useLayerStore } from '../stores/layers';
import { useQueryService } from './query';

export const useLayerPanelService = defineStore('layerPanelService', () => {
    const layers = useLayerStore();
    const query = useQueryService();

    const state = reactive({
        anchorId: null,
        tailId: null,
        scrollRule: null
    });

    const exists = computed(() => state.anchorId != null && state.tailId != null);

    let internal = false;
    function markInternal(fn) {
        internal = true;
        try {
            fn();
        } finally {
            internal = false;
        }
    }

    watch(
        () => layers.selectedIds,
        () => {
            if (internal) return;
            clearRange();
        },
        { flush: 'sync' }
    );

    function setRange(anchorId = null, tailId = null) {
        markInternal(() => {
            state.anchorId = anchorId;
            state.tailId = tailId;
            if (anchorId == null || tailId == null) {
                layers.clearSelection();
                return;
            }
            const order = layers.order;
            const start = order.indexOf(anchorId);
            const end = order.indexOf(tailId);
            if (start < 0 || end < 0) {
                layers.clearSelection();
                return;
            }
            const [min, max] = start < end ? [start, end] : [end, start];
            layers.replaceSelection(order.slice(min, max + 1));
        });
    }

    function clearRange() {
        markInternal(() => {
            state.anchorId = null;
            state.tailId = null;
        });
    }

    function setScrollRule(rule) {
        state.scrollRule = rule;
    }

    function onLayerClick(id, event) {
        if (event.shiftKey) {
            setRange(state.anchorId ?? id, id);
        } else if (event.ctrlKey || event.metaKey) {
            markInternal(() => layers.toggleSelection(id));
            clearRange();
        } else {
            setRange(id, id);
        }
        setScrollRule({ type: 'follow', target: id });
    }

    function onArrowUp(shift, ctrl) {
        if (!layers.exists || ctrl) return;
        if (shift) {
            if (!layers.selectionExists) return;
            const newTail = query.aboveId(state.tailId) ?? query.uppermostId;
            setRange(state.anchorId, newTail);
            setScrollRule({ type: 'follow-up', target: newTail });
        } else {
            const nextId = query.aboveId(state.anchorId) ?? state.anchorId;
            setRange(nextId, nextId);
            setScrollRule({ type: 'follow-up', target: nextId });
        }
    }

    function onArrowDown(shift, ctrl) {
        if (!layers.exists || ctrl) return;
        if (shift) {
            if (!layers.selectionExists) return;
            const newTail = query.belowId(state.tailId) ?? query.lowermostId;
            setRange(state.anchorId, newTail);
            setScrollRule({ type: 'follow-down', target: newTail });
        } else {
            const nextId = query.belowId(state.anchorId) ?? state.anchorId;
            setRange(nextId, nextId);
            setScrollRule({ type: 'follow-down', target: nextId });
        }
    }

    function selectAll() {
        markInternal(() => {
            const anchor = query.uppermostId;
            const tail = query.lowermostId;
            layers.replaceSelection(layers.order);
            state.anchorId = anchor;
            state.tailId = tail;
        });
    }

    function clearSelection() {
        markInternal(() => layers.clearSelection());
        clearRange();
    }

    function serialize() {
        return {
            anchor: state.anchorId,
            tailId: state.tailId,
            scrollRule: state.scrollRule
        };
    }

    function applySerialized(payload) {
        markInternal(() => {
            state.anchorId = payload?.anchor ?? null;
            state.tailId = payload?.tailId ?? null;
        });
        state.scrollRule = payload?.scrollRule;
    }

    return {
        ...toRefs(state),
        exists,
        setRange,
        clearRange,
        setScrollRule,
        onLayerClick,
        onArrowUp,
        onArrowDown,
        selectAll,
        clearSelection,
        serialize,
        applySerialized
    };
});

