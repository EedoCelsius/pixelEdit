import { defineStore } from 'pinia';
import { readonly, nextTick } from 'vue';

export const useKeyboardEventStore = defineStore('keyboardEvent', {
    state: () => ({
        _keyboard: {},
        _recent: {
            down: [],
            up: [],
        },
        _recentTicks: {
            down: -1,
            up: -1,
        },
        _tick: 0,
        _tickScheduled: false,
    }),
    getters: {
        keyboard: (state) => readonly(state._keyboard),
        recent: (state) => readonly(state._recent),
        isPressed: (state) => (key) => {
            const entry = state._keyboard[key];
            return !!entry && !!entry.down && (!entry.up || entry.down.timeStamp > entry.up.timeStamp);
        },
        get: (state) => (type, key) => {
            switch (type) {
                case 'keydown':
                    return state._keyboard[key]?.down;
                case 'keyup':
                    return state._keyboard[key]?.up;
                default:
                    return null;
            }
        },
    },
    actions: {
        setKeyDown(event) {
            const target = event.target;
            const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
            if (typing) return;
            if (this._keyboard[event.key]) this._keyboard[event.key].down = event;
            else this._keyboard[event.key] = { down: event, up: null };
            this._pushRecent('down', event);
        },
        setKeyUp(event) {
            const target = event.target;
            const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
            if (typing) return;
            if (this._keyboard[event.key]) this._keyboard[event.key].up = event;
            else this._keyboard[event.key] = { down: null, up: event };
            this._pushRecent('up', event);
        },
        _pushRecent(type, event) {
            if (this._recentTicks[type] !== this._tick) {
                this._recent[type] = [];
                this._recentTicks[type] = this._tick;
            }
            this._recent[type].push(event);
            if (!this._tickScheduled) {
                this._tickScheduled = true;
                nextTick(() => {
                    this._tick++;
                    this._tickScheduled = false;
                });
            }
        },
        listen() {
            window.addEventListener('keydown', this.setKeyDown);
            window.addEventListener('keyup', this.setKeyUp);
        },
        unlisten() {
            window.removeEventListener('keydown', this.setKeyDown);
            window.removeEventListener('keyup', this.setKeyUp);
        },
    },
});
