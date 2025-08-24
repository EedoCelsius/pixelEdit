import { defineStore } from 'pinia';
import { readonly } from 'vue';

export const usePixelsStore = defineStore('pixelsStore', {
  state: () => ({
    pixelsByLayer: {},
  }),
  getters: {
    pixelsByLayer: (state) => readonly(state.pixelsByLayer),
  },
  actions: {
    _ensureLayer(id) {
      const map = this.$state.pixelsByLayer;
      if (!map[id]) {
        map[id] = new Set();
      }
      return map[id];
    },
    getPixels(id) {
      return readonly(this._ensureLayer(id));
    },
    addPixel(id, coord) {
      this._ensureLayer(id).add(coord);
    },
    removePixel(id, coord) {
      const set = this.$state.pixelsByLayer[id];
      if (set) set.delete(coord);
    },
    clearLayer(id) {
      const set = this.$state.pixelsByLayer[id];
      if (set) set.clear();
    },
  },
});

