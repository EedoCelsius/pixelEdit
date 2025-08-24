import { defineStore } from 'pinia';

export const useLayerPanelStore = defineStore('layerPanel', {
    state: () => ({
        _scrollRule: null,
        _anchorId: null,
        _tailId: null,
    }),
    getters: {
        scrollRule: (state) => state._scrollRule,
        anchorId: (state) => state._anchorId,
        tailId: (state) => state._tailId,
    },
    actions: {
        setScrollRule(rule) {
            this._scrollRule = rule;
        },
        setRange(anchorId = null, tailId = null) {
            this._anchorId = anchorId;
            this._tailId = tailId;
        },
        serialize() {
            return {
                scrollRule: this._scrollRule,
                anchorId: this._anchorId,
                tailId: this._tailId,
            };
        },
        applySerialized(payload) {
            this._scrollRule = payload?.scrollRule ?? null;
            this._anchorId = payload?.anchorId ?? null;
            this._tailId = payload?.tailId ?? null;
        },
    },
});

