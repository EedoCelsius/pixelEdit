import { defineStore } from 'pinia';
import { useLayerStore } from './layers';

export const useLayerPanelStore = defineStore('layerPanel', {
    state: () => ({
        _anchorId: null,
        _tailId: null,
        _scrollRule: null
    }),
    getters: {
        anchorId: (state) => state._anchorId,
        tailId: (state) => state._tailId,
        scrollRule: (state) => state._scrollRule,
        exists: (state) => state._anchorId != null && state._tailId != null
    },
    actions: {
        setRange(anchorId = null, tailId = null) {
            this._anchorId = anchorId;
            this._tailId = tailId;
            const layers = useLayerStore();
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
        },
        clearRange() {
            this.setRange(null, null);
        },
        setScrollRule(rule) {
            this._scrollRule = rule;
        },
        serialize() {
            return {
                anchor: this._anchorId,
                tailId: this._tailId,
                scrollRule: this._scrollRule
            };
        },
        applySerialized(payload) {
            this.setRange(payload?.anchor ?? null, payload?.tailId ?? null);
            this._scrollRule = payload?.scrollRule;
        }
    }
});
