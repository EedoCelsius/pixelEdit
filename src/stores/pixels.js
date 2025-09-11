import { defineStore } from 'pinia';
import { coordToIndex, indexToCoord, pixelsToUnionPath, groupConnectedPixels, MAX_DIMENSION } from '../utils/pixels.js';
import { mixHash } from '../utils/hash.js';
import { OT, PIXEL_ORIENTATIONS, PIXEL_DEFAULT_ORIENTATIONS, DEFAULT_CHECKERBOARD_ORIENTATIONS } from '../constants/orientation.js';

export { OT, PIXEL_ORIENTATIONS, PIXEL_DEFAULT_ORIENTATIONS, DEFAULT_CHECKERBOARD_ORIENTATIONS };
const PIXEL_HASHES = crypto.getRandomValues(new Uint32Array(MAX_DIMENSION * MAX_DIMENSION));

function hashLayer(map) {
    let h = 0;
    if (map instanceof Map) {
        for (const [i, v] of map) {
            h ^= mixHash(v, PIXEL_HASHES[i]);
        }
    }
    return h;
}

function rehashLayer(store, id) {
    const map = store._pixels[id];
    const oldHash = store._hash.layers[id];
    const newHash = hashLayer(map);
    store._hash.layers[id] = newHash;
    store._hash.all ^= mixHash(id, oldHash) ^ mixHash(id, newHash);
}

function updatePixelHash(store, id, index, oldVal, newVal) {
    const oldHash = store._hash.layers[id];
    const oldMix = oldVal ? mixHash(oldVal, PIXEL_HASHES[index]) : 0;
    const newMix = newVal ? mixHash(newVal, PIXEL_HASHES[index]) : 0;
    const newHash = oldHash ^ oldMix ^ newMix;
    store._hash.layers[id] = newHash;
    store._hash.all ^= mixHash(id, oldHash) ^ mixHash(id, newHash);
}

function resolveOrientation(store, orientation, pixel) {
    if (orientation === 0) return 0;
    if (orientation === OT.DEFAULT) orientation = store._defaultOrientation;
    if (orientation === 'checkerboard') {
        const [o1, o2] = store._checkerboardOrientations;
        const [x, y] = indexToCoord(pixel);
        orientation = (x + y) % 2 === 0 ? o1 : o2;
    }
    return orientation || OT.NONE;
}

function commitPixel(store, id, pixel, orientation, skipExisting = false) {
    const map = store._pixels[id];
    if (skipExisting && map.has(pixel)) return;
    const oldVal = map.get(pixel) || 0;
    if (orientation === 0) {
        if (!oldVal) return;
        map.delete(pixel);
        updatePixelHash(store, id, pixel, oldVal, 0);
    } else {
        map.set(pixel, orientation);
        updatePixelHash(store, id, pixel, oldVal, orientation);
    }
}

export const usePixelStore = defineStore('pixels', {
    state: () => ({
        _pixels: {},
        _hash: { layers: {}, all: 0 },
        _defaultOrientation: (() => {
            const saved = localStorage.getItem('settings.defaultOrientation');
            if (saved === null) return PIXEL_DEFAULT_ORIENTATIONS[0];
            return saved === 'checkerboard' ? saved : Number(saved);
        })(),
        _checkerboardOrientations: (() => {
            const saved = localStorage.getItem('settings.checkerboardOrientations');
            if (!saved) return [...DEFAULT_CHECKERBOARD_ORIENTATIONS];
            const arr = saved.split(',').map(Number);
            return arr.length === 2 && arr.every(o => PIXEL_ORIENTATIONS.includes(o)) ? arr : [...DEFAULT_CHECKERBOARD_ORIENTATIONS];
        })()
    }),
    getters: {
        defaultOrientation: (s) => s._defaultOrientation,
        checkerboardOrientations: (s) => s._checkerboardOrientations,
        get: (s) => (id) => {
            if (Array.isArray(id)) {
                return id.map(i => s._pixels[i]);
            }
            return s._pixels[id];
        },
        sizeOf: (s) => (id) => {
            const map = s._pixels[id];
            return map.size;
        },
        orientationOf: (s) => (id, pixel) => {
            return s._pixels[id].get(pixel);
        },
        pathOf: (s) => (id) => {
            return pixelsToUnionPath(s._pixels[id]);
        },
        disconnectedCountOf: (s) => (id) => {
            const map = s._pixels[id];
            return groupConnectedPixels(map).length;
        },
        has: (s) => (id, pixel) => {
            return s._pixels[id].has(pixel);
        }
    },
    actions: {
        addLayer(ids = []) {
            if (!Array.isArray(ids)) ids = [ids];
            for (const id of ids) {
                this._pixels[id] = new Map();
                this._hash.layers[id] = 0;
                this._hash.all ^= mixHash(id, 0);
            }
        },
        removeLayer(ids = []) {
            if (!Array.isArray(ids)) ids = [ids];
            for (const id of ids) {
                const layerHash = this._hash.layers[id];
                this._hash.all ^= mixHash(id, layerHash);
                delete this._hash.layers[id];
                delete this._pixels[id];
            }
        },
        set(id, pixels) {
            this._pixels[id] = pixels;
            rehashLayer(this, id);
        },
        update(id, orientationMap = {}) {
            for (const [idxStr, oriVal] of Object.entries(orientationMap)) {
                const pixel = Number(idxStr);
                const orientation = resolveOrientation(this, oriVal, pixel);
                commitPixel(this, id, pixel, orientation);
            }
        },
        add(id, pixels, orientation = OT.DEFAULT) {
            for (const pixel of pixels) {
                const value = resolveOrientation(this, orientation, pixel);
                commitPixel(this, id, pixel, value, true);
            }
        },
        override(id, pixels, orientation = OT.DEFAULT) {
            for (const pixel of pixels) {
                const value = resolveOrientation(this, orientation, pixel);
                commitPixel(this, id, pixel, value);
            }
        },
        remove(id, pixels) {
            for (const pixel of pixels) {
                commitPixel(this, id, pixel, 0);
            }
        },
        togglePixel(id, pixel) {
            const orientation = this._pixels[id].has(pixel)
                ? 0
                : resolveOrientation(this, OT.DEFAULT, pixel);
            commitPixel(this, id, pixel, orientation);
        },
        translateAll(dx = 0, dy = 0) {
            dx |= 0; dy |= 0;
            if (dx === 0 && dy === 0) return;
            const keys = Object.keys(this._pixels);
            for (const idStr of keys) {
                const id = Number(idStr);
                const map = this._pixels[id];
                const moved = new Map();
                for (const [i, v] of map) {
                    const [x, y] = indexToCoord(i);
                    const nx = x + dx;
                    const ny = y + dy;
                    const ni = coordToIndex(nx, ny);
                    moved.set(ni, v);
                }
                this._pixels[id] = moved;
                rehashLayer(this, id);
            }
        },
        serialize() {
            const result = {};
            for (const [id, map] of Object.entries(this._pixels)) {
                result[id] = Array.from(map.entries());
            }
            return result;
        },
        applySerialized(byId = {}) {
            this._pixels = {};
            this._hash = { layers: {}, all: 0 };
            for (const [id, data] of Object.entries(byId)) {
                const map = data instanceof Map ? data : new Map(data);
                this._pixels[id] = map;
                rehashLayer(this, Number(id));
            }
        },
        setDefaultOrientation(orientation) {
            if (PIXEL_DEFAULT_ORIENTATIONS.includes(orientation)) {
                this._defaultOrientation = orientation;
                localStorage.setItem('settings.defaultOrientation', orientation);
            }
        },
        setCheckerboardOrientations(o1, o2) {
            if (PIXEL_ORIENTATIONS.includes(o1) && PIXEL_ORIENTATIONS.includes(o2)) {
                this._checkerboardOrientations = [o1, o2];
                localStorage.setItem('settings.checkerboardOrientations', `${o1},${o2}`);
            }
        }
    }
});

