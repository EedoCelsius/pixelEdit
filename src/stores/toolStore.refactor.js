import { defineStore } from 'pinia';

export const useToolStore = defineStore('toolStore', {
  state: () => ({
    _active: 'draw',
    _shape: 'stroke',
    _ctrlHeld: false,
    _shiftHeld: false,
    _prepared: null,
  }),
  getters: {
    active: (state) => state._active,
    shape: (state) => state._shape,
    ctrlHeld: (state) => state._ctrlHeld,
    shiftHeld: (state) => state._shiftHeld,
    prepared: (state) => state._prepared,
  },
  actions: {
    setActive(v) {
      this._active = v;
    },
    setShape(v) {
      this._shape = v;
    },
    setCtrlHeld(v) {
      this._ctrlHeld = v;
    },
    setShiftHeld(v) {
      this._shiftHeld = v;
    },
    setPrepared(v) {
      this._prepared = v;
    },
  },
});

