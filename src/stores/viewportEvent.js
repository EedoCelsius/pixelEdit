import { defineStore } from 'pinia';
import { readonly, nextTick } from 'vue';
import { MAX_POINTER_WINDOW } from '@/constants';

export const useViewportEventStore = defineStore('viewportEvent', {
    state: () => ({
        _pointer: {},
        _keyboard: {},
        _wheel: null,
        _recent: {
            pointer: { down: [], move: [], up: [] },
            keyboard: { down: [], up: [] },
        },
        _recentTicks: {
            pointer: { down: 0, move: 0, up: 0 },
            keyboard: { down: 0, up: 0 },
        },
        _tick: 0,
        _tickScheduled: false,
    }),
    getters: {
        pointer: (state) => readonly(state._pointer),
        keyboard: (state) => readonly(state._keyboard),
        wheel: (state) => readonly(state._wheel),
        recent: (state) => readonly(state._recent),
        isPressed: (state) => (key) => {
            const entry = state._keyboard[key];
            return !!entry && !!entry.down && (!entry.up || entry.down.timeStamp > entry.up.timeStamp);
        },
        isDragging: (state) => (id) => {
            const entry = state._pointer[id];
            return !!entry && !!entry.down && (!entry.up || entry.down.timeStamp > entry.up.timeStamp);
        },
    },
    actions: {
        setPointerDown(event) {
            if (this._pointer[event.pointerId])
                this._pointer[event.pointerId].down = event;
            else {
                this._pointer[event.pointerId] = { down: event, move: null, up: null };
                this.pruneOldPointers();
            }
            this._pushRecent('pointer', 'down', event);
        },
        setPointerMove(event) {
            if (this._pointer[event.pointerId])
                this._pointer[event.pointerId].move = event;
            else {
                this._pointer[event.pointerId] = { down: null, move: event, up: null };
                this.pruneOldPointers();
            }
            this._pushRecent('pointer', 'move', event);
        },
        setPointerUp(event) {
            if (this._pointer[event.pointerId])
                this._pointer[event.pointerId].up = event;
            else {
                this._pointer[event.pointerId] = { down: null, move: null, up: event };
                this.pruneOldPointers();
            }
            this._pushRecent('pointer', 'up', event);
        },
        setKeyDown(event) {
            if (this._keyboard[event.key]) this._keyboard[event.key].down = event;
            else this._keyboard[event.key] = { down: event, up: null };
            this._pushRecent('keyboard', 'down', event);
        },
        setKeyUp(event) {
            if (this._keyboard[event.key]) this._keyboard[event.key].up = event;
            else this._keyboard[event.key] = { down: null, up: event };
            this._pushRecent('keyboard', 'up', event);
        },
        setWheel(event) {
            this._wheel = event;
        },
        getEvent(type, idOrKey) {
            switch (type) {
                case 'pointerdown':
                    return this._pointer[idOrKey]?.down;
                case 'pointermove':
                    return this._pointer[idOrKey]?.move;
                case 'pointerup':
                    return this._pointer[idOrKey]?.up;
                case 'keydown':
                    return this._keyboard[idOrKey]?.down;
                case 'keyup':
                    return this._keyboard[idOrKey]?.up;
                case 'wheel':
                    return this._wheel;
                default:
                    return null;
            }
        },
        _pushRecent(category, type, event) {
            if (this._recentTicks[category][type] !== this._tick) {
                this._recent[category][type].length = 0;
                this._recentTicks[category][type] = this._tick;
            }
            this._recent[category][type].push(event);
            if (!this._tickScheduled) {
                this._tickScheduled = true;
                nextTick(() => {
                    this._tick++;
                    this._tickScheduled = false;
                });
            }
        },
        pruneOldPointers() {
            const entries = Object.entries(this._pointer);
            if (entries.length <= MAX_POINTER_WINDOW) return;
            const getLatest = (p) => Math.max(p.down?.timeStamp || 0, p.move?.timeStamp || 0, p.up?.timeStamp || 0);
            entries.sort(([, a], [, b]) => getLatest(b) - getLatest(a));
            for (let i = MAX_POINTER_WINDOW; i < entries.length; i++) {
                delete this._pointer[entries[i][0]];
            }
        },
    },
});
