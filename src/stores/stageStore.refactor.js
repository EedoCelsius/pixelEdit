import { defineStore } from 'pinia';
import { readonly } from 'vue';

export const useStageStore = defineStore('stageStore', {
  state: () => ({
    _scale: 1,
    _minScale: 1,
    _containScale: 1,
    _offset: { x: 0, y: 0 },
    _stage: null,
    _container: null,
  }),
  getters: {
    scale: (state) => state._scale,
    minScale: (state) => state._minScale,
    containScale: (state) => state._containScale,
    offset: (state) => readonly(state._offset),
    stage: (state) => state._stage,
    container: (state) => state._container,
  },
  actions: {
    setScale(v) {
      this._scale = v;
    },
    setMinScale(v) {
      this._minScale = v;
    },
    setContainScale(v) {
      this._containScale = v;
    },
    setOffset(x, y) {
      this._offset.x = x;
      this._offset.y = y;
    },
    setStage(el) {
      this._stage = el;
    },
    setContainer(el) {
      this._container = el;
    },
  },
});

