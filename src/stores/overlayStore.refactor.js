import { defineStore } from 'pinia';
import { reactive, readonly } from 'vue';

export const useOverlayStore = defineStore('overlayStore', {
  state: () => ({
    _selected: reactive(new Set()),
    _marquee: reactive(new Set()),
    _helper: reactive(new Set()),
  }),
  getters: {
    selected: (state) => readonly(state._selected),
    marquee: (state) => readonly(state._marquee),
    helper: (state) => readonly(state._helper),
  },
  actions: {
    addSelected(c) {
      this._selected.add(c);
    },
    clearSelected() {
      this._selected.clear();
    },
    addMarquee(c) {
      this._marquee.add(c);
    },
    clearMarquee() {
      this._marquee.clear();
    },
    addHelper(c) {
      this._helper.add(c);
    },
    clearHelper() {
      this._helper.clear();
    },
  },
});

