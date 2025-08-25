import { defineStore } from 'pinia';

const pointerIds = [];

export const useViewportEventStore = defineStore('viewportEvent', {
    state: () => ({
        pointer: { recent: null },
        wheel: null,
        keyboard: { recent: null },
    }),
    actions: {
        addPointerDown(event) {
            this.pointer[event.pointerId] = { down: event, move: null, up: null };
            this.pointer.recent = event.pointerId;
            pointerIds.push(event.pointerId);
            if (pointerIds.length > 10) {
                const removeId = pointerIds.shift();
                delete this.pointer[removeId];
            }
        },
        setPointerMove(event) {
            const p = this.pointer[event.pointerId];
            if (p) p.move = event;
            else this.pointer[event.pointerId] = { down: null, move: event, up: null };
            this.pointer.recent = event.pointerId;
        },
        setPointerUp(event) {
            const p = this.pointer[event.pointerId];
            if (p) p.up = event;
            else this.pointer[event.pointerId] = { down: null, move: null, up: event };
            this.pointer.recent = event.pointerId;
        },
        setWheel(event) {
            this.wheel = event;
        },
        setKey(event) {
            if (!event) return;
            const key =
                event.key === 'Shift'
                    ? 'shift'
                    : event.key === 'Control' || event.key === 'Meta'
                        ? 'ctrl'
                        : event.key;
            if (event.type === 'keydown') {
                this.keyboard[key] = { down: event };
            } else if (event.type === 'keyup') {
                this.keyboard[key] = { ...(this.keyboard[key] || {}), up: event };
            }
            this.keyboard.recent = key;
        },
    },
});
