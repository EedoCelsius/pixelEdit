import { defineStore } from 'pinia';
import { readonly } from 'vue';

export const usePixelsStore = defineStore('pixelsStore', {
  state: () => ({
    _pixelsByLayer: {},
  }),
  getters: {
    pixelsByLayer: (state) => readonly(state._pixelsByLayer),
  },
  actions: {
    _ensureLayer(id) {
      const map = this.$state._pixelsByLayer;
      if (!map[id]) {
        map[id] = new Set();
      }
      return map[id];
    },
    getPixels(id) {
      this._ensureLayer(id);
      return readonly(this.pixelsByLayer[id]);
    },
    addPixel(id, coord) {
      this._ensureLayer(id).add(coord);
    },
    removePixel(id, coord) {
      const set = this.$state._pixelsByLayer[id];
      if (set) set.delete(coord);
    },
    clearLayer(id) {
      const set = this.$state._pixelsByLayer[id];
      if (set) set.clear();
    },
  },
});

