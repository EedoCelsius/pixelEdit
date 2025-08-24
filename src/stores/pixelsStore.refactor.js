import { defineStore } from 'pinia';
import { reactive, readonly } from 'vue';

export const usePixelsStore = defineStore('pixelsStore', {
  state: () => ({
    _pixelsByLayer: reactive({}),
  }),
  getters: {
    pixelsByLayer: (state) => readonly(state._pixelsByLayer),
  },
  actions: {
    _ensureLayer(id) {
      if (!this._pixelsByLayer[id]) {
        this._pixelsByLayer[id] = reactive(new Set());
      }
      return this._pixelsByLayer[id];
    },
    getPixels(id) {
      return readonly(this._ensureLayer(id));
    },
    addPixel(id, coord) {
      this._ensureLayer(id).add(coord);
    },
    removePixel(id, coord) {
      const set = this._pixelsByLayer[id];
      if (set) set.delete(coord);
    },
    clearLayer(id) {
      const set = this._pixelsByLayer[id];
      if (set) set.clear();
    },
  },
});

