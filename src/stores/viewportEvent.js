import { defineStore } from 'pinia';
import { MAX_POINTER_WINDOW } from '@/constants';

export const useViewportEventStore = defineStore('viewportEvent', {
    state: () => ({
        pointer: { recent: null },
        wheel: null,
        keyboard: { recent: null },
    }),
    actions: {
        pruneOldPointers() {
            const entries = Object.entries(this.pointer).filter(([id]) => id !== 'recent');
            if (entries.length <= MAX_POINTER_WINDOW) return;
            const getLatest = (p) => Math.max(p.down?.timeStamp || 0, p.move?.timeStamp || 0, p.up?.timeStamp || 0);
            entries.sort(([, a], [, b]) => getLatest(b) - getLatest(a));
            for (let i = MAX_POINTER_WINDOW; i < entries.length; i++) {
                delete this.pointer[entries[i][0]];
            }
        },
        addPointerDown(event) {
            const isNew = !this.pointer[event.pointerId];
            this.pointer[event.pointerId] = { down: event, move: null, up: null };
            this.pointer.recent = event.pointerId;
            if (isNew) this.pruneOldPointers();
        },
        setPointerMove(event) {
            const isNew = !this.pointer[event.pointerId];
            if (this.pointer[event.pointerId]) this.pointer[event.pointerId].move = event;
            else this.pointer[event.pointerId] = { down: null, move: event, up: null };
            this.pointer.recent = event.pointerId;
            if (isNew) this.pruneOldPointers();
        },
        setPointerUp(event) {
            const isNew = !this.pointer[event.pointerId];
            if (this.pointer[event.pointerId]) this.pointer[event.pointerId].up = event;
            else this.pointer[event.pointerId] = { down: null, move: null, up: event };
            this.pointer.recent = event.pointerId;
            if (isNew) this.pruneOldPointers();
        },
        setWheel(event) {
            this.wheel = event;
        },
        setKeyDown(event) {
            if (!event) return;
            const key = event.key;
            this.keyboard[key] = { down: event };
            this.keyboard.recent = key;
        },
        setKeyUp(event) {
            if (!event) return;
            const key = event.key;
            this.keyboard[key] = { ...(this.keyboard[key] || {}), up: event };
            this.keyboard.recent = key;
        },
    },
});
