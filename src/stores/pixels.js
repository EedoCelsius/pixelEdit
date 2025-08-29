import { defineStore } from 'pinia';
import { coordToKey, keyToCoord, pixelsToUnionPath, groupConnectedPixels } from '../utils';

export const PIXEL_KINDS = ['bltl', 'brtr', 'tltr', 'blbr', 'tlbl', 'trbr', 'trtl', 'brbl'];
const DEFAULT_KIND = PIXEL_KINDS[0];

function unionSet(state, id) {
    const merged = new Set();
    for (const kind of PIXEL_KINDS) {
        const set = state[kind][id];
        if (!set) continue;
        for (const key of set) merged.add(key);
    }
    return merged;
}

export const usePixelStore = defineStore('pixels', {
    state: () => ({
        'bltl': {},
        'brtr': {},
        'tltr': {},
        'blbr': {},
        'tlbl': {},
        'trbr': {},
        'trtl': {},
        'brbl': {}
    }),
    getters: {
        get: (state) => (id) => {
            return [...unionSet(state, id)].map(keyToCoord);
        },
        pathOfLayer: (state) => (id) => {
            return pixelsToUnionPath([...unionSet(state, id)].map(keyToCoord));
        },
        disconnectedCountOfLayer: (state) => (id) => {
            const coords = [...unionSet(state, id)].map(keyToCoord);
            if (!coords.length) return 0;
            return groupConnectedPixels(coords).length;
        },
        getProperties: (state) => {
            const propsOf = (id) => ({
                id,
                pixels: [...unionSet(state, id)].map(keyToCoord)
            });
            return (ids = []) => {
                if (Array.isArray(ids)) return ids.map(propsOf);
                return propsOf(ids);
            };
        },
        has: (state) => (id, coord) => {
            const key = coordToKey(coord);
            for (const kind of PIXEL_KINDS) {
                const set = state[kind][id];
                if (set && set.has(key)) return true;
            }
            return false;
        }
    },
    actions: {
        set(id, pixels = []) {
            const keyed = pixels.map(coordToKey);
            for (const kind of PIXEL_KINDS) delete this[kind][id];
            this[DEFAULT_KIND][id] = new Set(keyed);
        },
        remove(ids = []) {
            for (const id of ids) {
                for (const kind of PIXEL_KINDS) delete this[kind][id];
            }
        },
        addPixels(id, pixels, kind = DEFAULT_KIND) {
            if (!this[kind][id]) this[kind][id] = new Set();
            for (const coord of pixels) {
                const key = coordToKey(coord);
                for (const kind of PIXEL_KINDS) this[kind][id]?.delete(key);
                this[kind][id].add(key);
            }
        },
        removePixels(id, pixels) {
            const keys = pixels.map(coordToKey);
            for (const kind of PIXEL_KINDS) {
                const set = this[kind][id];
                if (!set) continue;
                for (const key of keys) set.delete(key);
            }
        },
        cycleKind(id, coord) {
            const key = coordToKey(coord);
            const index = PIXEL_KINDS.findIndex(k => this[k][id]?.has(key));
            if (index >= 0) {
                const current = PIXEL_KINDS[index];
                this[current][id].delete(key);
                const next = PIXEL_KINDS[(index + 1) % PIXEL_KINDS.length];
                if (!this[next][id]) this[next][id] = new Set();
                this[next][id].add(key);
            }
            else {
                const target = this[DEFAULT_KIND][id];
                if (target) target.add(key);
            }
        },
        changeKind(id, coord, kind) {
            switch (kind) {
                case 'up': kind = 'bltl'; break;
                case 'right': kind = 'tltr'; break;
                case 'down': kind = 'tlbl'; break;
                case 'left': kind = 'trtl'; break;
            }
            const key = coordToKey(coord);
            const index = PIXEL_KINDS.findIndex(k => this[k][id]?.has(key));
            if (index === -1) return;
            const current = PIXEL_KINDS[index];
            this[current][id].delete(key);
            if (!this[kind][id]) this[kind][id] = new Set();
            this[kind][id].add(key);
        },
        togglePixel(id, coord) {
            const key = coordToKey(coord);
            for (const kind of PIXEL_KINDS) {
                const set = this[kind][id];
                if (set && set.has(key)) {
                    set.delete(key);
                    return;
                }
            }
            const target = this[DEFAULT_KIND][id];
            if (target) target.add(key);
        },
        translateAll(dx = 0, dy = 0) {
            dx |= 0; dy |= 0;
            if (dx === 0 && dy === 0) return;
            for (const kind of PIXEL_KINDS) {
                const ids = Object.keys(this[kind]);
                for (const id of ids) {
                    const set = this[kind][id];
                    const moved = new Set();
                    for (const key of set) {
                        const [x, y] = keyToCoord(key);
                        moved.add(coordToKey([x + dx, y + dy]));
                    }
                    this[kind][id] = moved;
                }
            }
        },
        serialize() {
            const result = {};
            const ids = new Set();
            for (const kind of PIXEL_KINDS) {
                for (const id of Object.keys(this[kind])) ids.add(id);
            }
            for (const id of ids) {
                result[id] = [...unionSet(this, id)].map(keyToCoord);
            }
            return result;
        },
        applySerialized(byId = {}) {
            for (const kind of PIXEL_KINDS) this[kind] = {};
            for (const id of Object.keys(byId)) {
                const keyed = byId[id].map(coordToKey);
                this[DEFAULT_KIND][id] = new Set(keyed);
            }
        }
    }
});

