import { defineStore } from 'pinia';
import { coordToIndex, indexToCoord, pixelsToUnionPath, groupConnectedPixels } from '../utils';

export const PIXEL_KINDS = ['bltl', 'brtr', 'tltr', 'blbr', 'tlbl', 'trbr', 'trtl', 'brbl'];
const DEFAULT_KIND = PIXEL_KINDS[0];

function unionSet(state, id) {
    const merged = new Set();
    for (const kind of PIXEL_KINDS) {
        const set = state[kind][id];
        if (!set) continue;
        for (const pixel of set) merged.add(pixel);
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
            return [...unionSet(state, id)];
        },
        pathOfLayer: (state) => (id) => {
            return pixelsToUnionPath([...unionSet(state, id)]);
        },
        disconnectedCountOfLayer: (state) => (id) => {
            const pixels = [...unionSet(state, id)];
            if (!pixels.length) return 0;
            return groupConnectedPixels(pixels).length;
        },
        getProperties: (state) => {
            const propsOf = (id) => ({
                id,
                pixels: [...unionSet(state, id)]
            });
            return (ids = []) => {
                if (Array.isArray(ids)) return ids.map(propsOf);
                return propsOf(ids);
            };
        },
        has: (state) => (id, pixel) => {
            for (const kind of PIXEL_KINDS) {
                const set = state[kind][id];
                if (set && set.has(pixel)) return true;
            }
            return false;
        }
    },
    actions: {
        set(id, pixels = []) {
            for (const kind of PIXEL_KINDS) delete this[kind][id];
            this[DEFAULT_KIND][id] = new Set(pixels);
        },
        remove(ids = []) {
            for (const id of ids) {
                for (const kind of PIXEL_KINDS) delete this[kind][id];
            }
        },
        addPixels(id, pixels, kind = DEFAULT_KIND) {
            if (!this[kind][id]) this[kind][id] = new Set();
            for (const pixel of pixels) {
                for (const kind of PIXEL_KINDS) this[kind][id]?.delete(pixel);
                this[kind][id].add(pixel);
            }
        },
        removePixels(id, pixels) {
            for (const kind of PIXEL_KINDS) {
                const set = this[kind][id];
                if (!set) continue;
                for (const pixel of pixels) set.delete(pixel);
            }
        },
        cycleKind(id, pixel) {
            const idx = PIXEL_KINDS.findIndex(k => this[k][id]?.has(pixel));
            if (idx >= 0) {
                const current = PIXEL_KINDS[idx];
                this[current][id].delete(pixel);
                const next = PIXEL_KINDS[(idx + 1) % PIXEL_KINDS.length];
                if (!this[next][id]) this[next][id] = new Set();
                this[next][id].add(pixel);
            }
            else {
                const target = this[DEFAULT_KIND][id];
                if (target) target.add(pixel);
            }
        },
        changeKind(id, pixel, kind) {
            switch (kind) {
                case 'up': kind = 'bltl'; break;
                case 'right': kind = 'tltr'; break;
                case 'down': kind = 'tlbl'; break;
                case 'left': kind = 'trtl'; break;
            }
            const idx = PIXEL_KINDS.findIndex(k => this[k][id]?.has(pixel));
            if (idx === -1) return;
            const current = PIXEL_KINDS[idx];
            this[current][id].delete(pixel);
            if (!this[kind][id]) this[kind][id] = new Set();
            this[kind][id].add(pixel);
        },
        togglePixel(id, pixel) {
            for (const kind of PIXEL_KINDS) {
                const set = this[kind][id];
                if (set && set.has(pixel)) {
                    set.delete(pixel);
                    return;
                }
            }
            const target = this[DEFAULT_KIND][id];
            if (target) target.add(pixel);
        },
        translateAll(dx = 0, dy = 0) {
            dx |= 0; dy |= 0;
            if (dx === 0 && dy === 0) return;
            for (const kind of PIXEL_KINDS) {
                const ids = Object.keys(this[kind]);
                for (const id of ids) {
                    const set = this[kind][id];
                    const moved = new Set();
                    for (const pixel of set) {
                        const [x, y] = indexToCoord(pixel);
                        moved.add(coordToIndex(x + dx, y + dy));
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
                result[id] = [...unionSet(this, id)];
            }
            return result;
        },
        applySerialized(byId = {}) {
            for (const kind of PIXEL_KINDS) this[kind] = {};
            for (const id of Object.keys(byId)) {
                this[DEFAULT_KIND][id] = new Set(byId[id]);
            }
        }
    }
});

