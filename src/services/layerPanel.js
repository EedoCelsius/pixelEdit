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

    function setRange(anchorId = null, tailId = null) {
        disableWatch();
        if (anchorId == null || tailId == null) {
            state.anchorId = null;
            state.tailId = null;
            layers.clearSelection();
            return;
        }
        const order = layers.order;
        const start = order.indexOf(anchorId);
        const end = order.indexOf(tailId);
        if (start < 0 || end < 0) {
            state.anchorId = null;
            state.tailId = null;
            layers.clearSelection();
            return;
        }
        const [min, max] = start < end ? [start, end] : [end, start];
        layers.replaceSelection(order.slice(min, max + 1));
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
        setRange(query.uppermostId, query.lowermostId);
    }

    function serialize() {
        return {
            anchor: state.anchorId,
            tailId: state.tailId,
            scrollRule: state.scrollRule
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
        serialize,
        applySerialized
    };
});

