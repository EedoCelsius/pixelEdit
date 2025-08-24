import { defineStore } from 'pinia';

export const useStageEventStore = defineStore('stageEvent', {
    state: () => ({
        pointer: {
            down: [],
            move: null,
            up: null,
        },
        wheel: null,
    }),
    getters: {
        lastPointerDown: (state) => state.pointer.down[state.pointer.down.length - 1],
    },
    actions: {
        addPointerDown(event) {
            this.pointer.down.push(event);
        },
        setPointerMove(event) {
            this.pointer.move = event;
        },
        setPointerUp(event) {
            this.pointer.up = event;
            this.pointer.down = this.pointer.down.filter(e => e.pointerId !== event.pointerId);
        },
        setWheel(event) {
            this.wheel = event;
        },
    },
});
