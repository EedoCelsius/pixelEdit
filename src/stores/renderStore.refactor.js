import { defineStore } from 'pinia';

export const useRenderStore = defineStore('renderStore', {
  state: () => ({
    _display: 'result',
  }),
  getters: {
    display: (state) => state._display,
  },
  actions: {
    setDisplay(mode) {
      this._display = mode;
    },
  },
});

