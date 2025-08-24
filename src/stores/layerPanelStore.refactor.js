import { defineStore } from 'pinia';

export const useLayerPanelStore = defineStore('layerPanelStore', {
  state: () => ({
    _scrollRule: null,
    _anchor: null,
    _tail: null,
  }),
  getters: {
    scrollRule: (state) => state._scrollRule,
    anchor: (state) => state._anchor,
    tail: (state) => state._tail,
  },
  actions: {
    setScrollRule(rule) {
      this._scrollRule = rule;
    },
    setAnchor(id) {
      this._anchor = id;
    },
    setTail(id) {
      this._tail = id;
    },
    clearRange() {
      this._anchor = null;
      this._tail = null;
    },
  },
});

