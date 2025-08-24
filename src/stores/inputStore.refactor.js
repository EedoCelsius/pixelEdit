import { defineStore } from 'pinia';

export const useInputStore = defineStore('inputStore', {
  state: () => ({
    _src: '',
    _buffer: null,
  }),
  getters: {
    src: (state) => state._src,
    buffer: (state) => state._buffer,
  },
  actions: {
    setSrc(s) {
      this._src = s;
    },
    setBuffer(b) {
      this._buffer = b;
    },
    clear() {
      this._src = '';
      this._buffer = null;
    },
  },
});

