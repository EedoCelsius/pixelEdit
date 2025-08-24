import { defineStore } from 'pinia';
import { reactive, computed, readonly } from 'vue';

export const useLayersStore = defineStore('layersStore', {
  state: () => ({
    _order: reactive([]),
    _layersById: reactive({}),
    _selected: reactive(new Set()),
    _nextId: 1,
  }),
  getters: {
    layers(state) {
      return state._order.map((id) => ({ id, ...state._layersById[id] }));
    },
    selectedIds(state) {
      return Array.from(state._selected);
    },
  },
  actions: {
    addLayer(layer) {
      const id = this._nextId++;
      this._layersById[id] = {
        name: layer?.name ?? `Layer ${id}`,
        color: layer?.color ?? '#000000',
        visible: layer?.visible ?? true,
        locked: layer?.locked ?? false,
      };
      this._order.push(id);
      return id;
    },
    removeLayer(id) {
      const idx = this._order.indexOf(id);
      if (idx !== -1) this._order.splice(idx, 1);
      delete this._layersById[id];
      this._selected.delete(id);
    },
    selectLayer(id) {
      this._selected.add(id);
    },
    clearSelection() {
      this._selected.clear();
    },
  },
});

