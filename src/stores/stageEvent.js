import { defineStore } from 'pinia';

export const useStageEventStore = defineStore('stageEvent', {
  state: () => ({
    pointer: {
      down: null,
      move: null,
      up: [],
    },
    wheel: null,
  }),
  actions: {
    pointerDown(event) {
      this.pointer.down = event;
    },
    pointerMove(event) {
      this.pointer.move = event;
    },
    pointerUp(event) {
      this.pointer.up = [event];
    },
    wheelEvent(event) {
      this.wheel = event;
    },
  },
});
