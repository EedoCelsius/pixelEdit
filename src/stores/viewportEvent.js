import { defineStore } from 'pinia';
import { readonly, nextTick } from 'vue';
import { MAX_POINTER_WINDOW } from '@/constants';

export const useViewportEventStore = defineStore('viewportEvent', {
    state: () => ({
        _pointer: {},
        _wheel: null,
        _recent: {
            pointer: { down: [], move: [], up: [] },
        },
        _recentTicks: {
            pointer: { down: -1, move: -1, up: -1 },
        },
        _tick: 0,
        _tickScheduled: false,
    }),
    getters: {
        pointer: (state) => readonly(state._pointer),
        wheel: (state) => readonly(state._wheel),
        recent: (state) => readonly(state._recent),
        pinchIds: (state) => {
            const active = [];
            for (const [id, p] of Object.entries(state._pointer)) {
                if (
                    p.down?.pointerType === 'touch' &&
                    (!p.up || p.down.timeStamp > p.up.timeStamp)
                ) {
                    active.push(Number(id));
                }
            }
            return active.length >= 2 ? active : null;
        },
        isDragging: (state) => (id) => {
            const entry = state._pointer[id];
            return !!entry && !!entry.down && (!entry.up || entry.down.timeStamp > entry.up.timeStamp);
        },
        get: (state) => (type, idOrKey) => {
            switch (type) {
                case 'pointerdown':
                    return state._pointer[idOrKey]?.down;
                case 'pointermove':
                    return state._pointer[idOrKey]?.move;
                case 'pointerup':
                    return state._pointer[idOrKey]?.up;
                case 'wheel':
                    return state._wheel;
                default:
                    return null;
            }
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
        setWheel(event) {
            this._wheel = event;
        },
        _pushRecent(category, type, event) {
            if (this._recentTicks[category][type] !== this._tick) {
                this._recent[category][type] = [];
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
