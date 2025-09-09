import { defineStore } from 'pinia';
import { coordToIndex, indexToCoord, pixelsToUnionPath, groupConnectedPixels, MAX_DIMENSION } from '../utils/pixels.js';
import { mixHash } from '../utils/hash.js';

export const PIXEL_ORIENTATIONS = ['none', 'horizontal', 'downSlope', 'vertical', 'upSlope'];
export const PIXEL_DEFAULT_ORIENTATIONS = [...PIXEL_ORIENTATIONS, 'checkerboard', 'slopeCheckerboard'];

const ORIENTATION_IDS = Object.fromEntries(PIXEL_ORIENTATIONS.map((o, i) => [o, i + 1]));
const ID_TO_ORIENTATION = Object.fromEntries(PIXEL_ORIENTATIONS.map((o, i) => [i + 1, o]));
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

export const usePixelStore = defineStore('pixels', {
    state: () => ({
        _pixels: {},
        _hash: { layers: {}, all: 0 },
        _defaultOrientation: localStorage.getItem('settings.defaultOrientation') || PIXEL_DEFAULT_ORIENTATIONS[0]
    }),
    getters: {
        defaultOrientation: (s) => s._defaultOrientation,
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
            const v = s._pixels[id].get(pixel);
            return ID_TO_ORIENTATION[v];
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
        add(id, pixels, orientation) {
            const map = this._pixels[id];
            orientation ??= this._defaultOrientation;
            if (orientation === 'checkerboard') {
                for (const pixel of pixels) {
                    const [x, y] = indexToCoord(pixel);
                    const o = (x + y) % 2 === 0 ? 'horizontal' : 'vertical';
                    const newVal = ORIENTATION_IDS[o];
                    const oldVal = map.get(pixel) || 0;
                    map.set(pixel, newVal);
                    updatePixelHash(this, id, pixel, oldVal, newVal);
                }
            } else if (orientation === 'slopeCheckerboard') {
                for (const pixel of pixels) {
                    const [x, y] = indexToCoord(pixel);
                    const o = (x + y) % 2 === 0 ? 'downSlope' : 'upSlope';
                    const newVal = ORIENTATION_IDS[o];
                    const oldVal = map.get(pixel) || 0;
                    map.set(pixel, newVal);
                    updatePixelHash(this, id, pixel, oldVal, newVal);
                }
            } else {
                const idOri = ORIENTATION_IDS[orientation] || ORIENTATION_IDS.none;
                for (const pixel of pixels) {
                    const oldVal = map.get(pixel) || 0;
                    map.set(pixel, idOri);
                    updatePixelHash(this, id, pixel, oldVal, idOri);
                }
            }
        },
        remove(id, pixels) {
            const map = this._pixels[id];
            for (const pixel of pixels) {
                const oldVal = map.get(pixel);
                if (!oldVal) continue;
                map.delete(pixel);
                updatePixelHash(this, id, pixel, oldVal, 0);
            }
        },
        togglePixel(id, pixel) {
            const map = this._pixels[id];
            const oldVal = map.get(pixel);
            if (oldVal) {
                map.delete(pixel);
                updatePixelHash(this, id, pixel, oldVal, 0);
                return;
            }
            let orientation = this._defaultOrientation;
            if (orientation === 'checkerboard') {
                const [x, y] = indexToCoord(pixel);
                orientation = (x + y) % 2 === 0 ? 'horizontal' : 'vertical';
            } else if (ori === 'slopeCheckerboard') {
                const [x, y] = indexToCoord(pixel);
                orientation = (x + y) % 2 === 0 ? 'downSlope' : 'upSlope';
            }
            const newVal = ORIENTATION_IDS[orientation] || ORIENTATION_IDS.none;
            map.set(pixel, newVal);
            updatePixelHash(this, id, pixel, oldVal, newVal);
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
        }
    }
});

