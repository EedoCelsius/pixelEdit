import { defineStore } from 'pinia';
import { reactive } from 'vue';
import { coordToKey, keyToCoord, pixelsToUnionPath, groupConnectedPixels } from '../utils';

export const usePixelStore = defineStore('pixels', {
    state: () => ({
        _pixels: {}
    }),
    getters: {
        get: (state) => (id) => {
            const set = state._pixels[id];
            return set ? [...set].map(keyToCoord) : [];
        },
        pathOfLayer: (state) => (id) => {
            const set = state._pixels[id];
            if (!set) return pixelsToUnionPath([]);
            return pixelsToUnionPath([...set].map(keyToCoord));
        },
        disconnectedCountOfLayer: (state) => (id) => {
            const set = state._pixels[id];
            if (!set) return 0;
            return groupConnectedPixels([...set].map(keyToCoord)).length;
        },
        getProperties: (state) => {
            const propsOf = (id) => ({
                id,
                pixels: state._pixels[id] ? [...state._pixels[id]].map(keyToCoord) : []
            });
            return (ids = []) => {
                if (Array.isArray(ids)) return ids.map(propsOf);
                return propsOf(ids);
            };
        }
    },
    actions: {
        set(id, pixels = []) {
            const keyed = pixels.map(coordToKey);
            this._pixels[id] = reactive(new Set(keyed));
        },
        remove(ids = []) {
            for (const id of ids) {
                delete this._pixels[id];
            }
        },
        addPixels(id, pixels) {
            const set = this._pixels[id];
            if (!set) return;
            for (const coord of pixels) set.add(coordToKey(coord));
        },
        removePixels(id, pixels) {
            const set = this._pixels[id];
            if (!set) return;
            for (const coord of pixels) set.delete(coordToKey(coord));
        },
        togglePixel(id, coord) {
            const set = this._pixels[id];
            if (!set) return;
            const key = coordToKey(coord);
            if (set.has(key)) set.delete(key);
            else set.add(key);
        },
        translateAll(dx = 0, dy = 0) {
            dx |= 0; dy |= 0;
            if (dx === 0 && dy === 0) return;
            const ids = Object.keys(this._pixels);
            for (const id of ids) {
                const set = this._pixels[id];
                const moved = new Set();
                for (const key of set) {
                    const [x, y] = keyToCoord(key);
                    moved.add(coordToKey([x + dx, y + dy]));
                }
                this._pixels[id] = reactive(moved);
            }
        },
        serialize() {
            const result = {};
            for (const id of Object.keys(this._pixels)) {
                result[id] = [...this._pixels[id]].map(keyToCoord);
            }
            return result;
        },
        applySerialized(byId = {}) {
            this._pixels = {};
            for (const id of Object.keys(byId)) {
                const keyed = byId[id].map(coordToKey);
                this._pixels[id] = reactive(new Set(keyed));
            }
        }
    }
});

