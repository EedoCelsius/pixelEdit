import { defineStore } from 'pinia';

export const useStageEventStore = defineStore('stageEvent', {
    state: () => ({
        pointer: {
            down: [],
            move: null,
            up: null,
            start: null,
        },
        wheel: null,
        ctrlHeld: false,
        shiftHeld: false,
    }),
    getters: {
        lastPointerDown: (state) => state.pointer.down[state.pointer.down.length - 1],
    },
    actions: {
        addPointerDown(event) {
            this.pointer.down.push(event);
            this.pointer.start = { x: event.clientX, y: event.clientY };
        },
        setPointerMove(event) {
            this.pointer.move = event;
        },
        setPointerUp(event) {
            this.pointer.up = event;
            this.pointer.down = this.pointer.down.filter(e => e.pointerId !== event.pointerId);
            this.pointer.start = null;
        },
        setWheel(event) {
            this.wheel = event;
        },
        setCtrlHeld(isHeld) {
            this.ctrlHeld = !!isHeld;
        },
        setShiftHeld(isHeld) {
            this.shiftHeld = !!isHeld;
        },
    },
});
