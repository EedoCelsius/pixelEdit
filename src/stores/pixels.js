import { defineStore } from 'pinia';
import { reactive } from 'vue';
import { coordToKey, keyToCoord, pixelsToUnionPath, groupConnectedPixels } from '../utils';

const PIXEL_KINDS = [
    'tltr', 'tlbl', 'trtl', 'trbr',
    'bltl', 'blbr', 'brtr', 'brbl'
];
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
    state: () => (
        PIXEL_KINDS.reduce((acc, k) => {
            acc[k] = {};
            return acc;
        }, {})
    ),
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
            this[DEFAULT_KIND][id] = reactive(new Set(keyed));
        },
        remove(ids = []) {
            for (const id of ids) {
                for (const kind of PIXEL_KINDS) delete this[kind][id];
            }
        },
        addPixels(id, pixels) {
            const set = this[DEFAULT_KIND][id];
            if (!set) return;
            for (const coord of pixels) set.add(coordToKey(coord));
        },
        removePixels(id, pixels) {
            const keys = pixels.map(coordToKey);
            for (const kind of PIXEL_KINDS) {
                const set = this[kind][id];
                if (!set) continue;
                for (const key of keys) set.delete(key);
            }
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
                    this[kind][id] = reactive(moved);
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
                this[DEFAULT_KIND][id] = reactive(new Set(keyed));
            }
        }
    }
});

