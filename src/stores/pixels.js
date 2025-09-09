import { defineStore } from 'pinia';
import { coordToIndex, indexToCoord, pixelsToUnionPath, groupConnectedPixels, MAX_DIMENSION } from '../utils/pixels.js';
import { mixHash } from '../utils/hash.js';

export const PIXEL_ORIENTATIONS = ['none', 'horizontal', 'downSlope', 'vertical', 'upSlope'];
export const PIXEL_DEFAULT_ORIENTATIONS = [...PIXEL_ORIENTATIONS, 'checkerboard', 'slopeCheckerboard'];

const ORIENTATION_IDS = Object.fromEntries(PIXEL_ORIENTATIONS.map((d, i) => [d, i + 1]));
const PIXEL_HASHES = crypto.getRandomValues(new Uint32Array(MAX_DIMENSION * MAX_DIMENSION));

function forEachOrientation(cb) {
    for (const orientation of PIXEL_ORIENTATIONS) cb(orientation);
}

function ensureLayer(store, id) {
    if (store._none[id]) return;
    forEachOrientation(orientation => { store[`_${orientation}`][id] = new Set(); });
}

function unionSet(state, id) {
    const merged = new Set();
    forEachOrientation(orientation => {
        for (const pixel of state[`_${orientation}`][id]) merged.add(pixel);
    });
    return merged;
}

function clearPixelAcross(store, id, pixel) {
    forEachOrientation(orientation => store[`_${orientation}`][id].delete(pixel));
}

function hashOrientationPixels(store, id, orientation) {
    let h = 0;
    for (const p of store[`_${orientation}`][id]) h ^= PIXEL_HASHES[p];
    return h;
}

function rehashLayer(store, id) {
    const oldLayerHash = store._hash.layers[id] || 0;
    let layerHash = 0;
    for (const dir of PIXEL_ORIENTATIONS) {
        const dirHash = hashOrientationPixels(store, id, dir);
        store._hash[dir][id] = dirHash;
        layerHash ^= mixHash(ORIENTATION_IDS[dir], dirHash);
    }
    store._hash.layers[id] = layerHash;
    store._hash.all ^= mixHash(id, oldLayerHash) ^ mixHash(id, layerHash);
}

export const usePixelStore = defineStore('pixels', {
    state: () => ({
        _none: {},
        _horizontal: {},
        _downSlope: {},
        _vertical: {},
        _upSlope: {},
        _defaultOrientation: localStorage.getItem('settings.defaultOrientation') || PIXEL_DEFAULT_ORIENTATIONS[0],
        _hash: { none: {}, horizontal: {}, downSlope: {}, vertical: {}, upSlope: {}, layers: {}, all: 0 }
    }),
    getters: {
        defaultOrientation: (state) => state._defaultOrientation,
        get: (state) => (id) => {
            return [...unionSet(state, id)];
        },
        getOrientationPixels: (state) => (orientation, id) => {
            return [...state[`_${orientation}`][id]];
        },
        getOrientationMap: (state) => (id) => {
            const result = {};
            forEachOrientation(orientation => {
                const set = state[`_${orientation}`][id];
                if (set.size) result[orientation] = [...set];
            });
            return result;
        },
        orientationOf: (state) => (id, pixel) => {
            for (const orientation of PIXEL_ORIENTATIONS) {
                if (state[`_${orientation}`][id].has(pixel)) return orientation;
            }
            return 'none';
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
            for (const orientation of PIXEL_ORIENTATIONS) {
                if (state[`_${orientation}`][id].has(pixel)) return true;
            }
            return false;
        }
    },
    actions: {
        set(id, pixels = [], orientation) {
            ensureLayer(this, id);
            forEachOrientation(dir => this[`_${dir}`][id].clear());
            if (Array.isArray(pixels)) {
                this.addPixels(id, pixels, orientation ?? this._defaultOrientation);
            } else {
                forEachOrientation(dir => {
                    if (pixels[dir]?.length) this.addPixels(id, pixels[dir], dir);
                });
            }
            rehashLayer(this, id);
        },
        remove(ids = []) {
            for (const id of ids) {
                const layerHash = this._hash.layers[id] || 0;
                this._hash.all ^= mixHash(id, layerHash);
                delete this._hash.layers[id];
                forEachOrientation(orientation => {
                    delete this[`_${orientation}`][id];
                    delete this._hash[orientation][id];
                });
            }
        },
        addPixels(id, pixels, orientation) {
            ensureLayer(this, id);
            orientation = orientation ?? this._defaultOrientation;
            if (orientation === 'checkerboard') {
                for (const pixel of pixels) {
                    clearPixelAcross(this, id, pixel);
                    const [x, y] = indexToCoord(pixel);
                    const orientation = (x + y) % 2 === 0 ? 'horizontal' : 'vertical';
                    this[`_${orientation}`][id].add(pixel);
                }
            }
            else if (orientation === 'slopeCheckerboard') {
                for (const pixel of pixels) {
                    clearPixelAcross(this, id, pixel);
                    const [x, y] = indexToCoord(pixel);
                    const orientation = (x + y) % 2 === 0 ? 'downSlope' : 'upSlope';
                    this[`_${orientation}`][id].add(pixel);
                }
            }
            else {
                for (const pixel of pixels) {
                    clearPixelAcross(this, id, pixel);
                    this[`_${orientation}`][id].add(pixel);
                }
            }
            rehashLayer(this, id);
        },
        removePixels(id, pixels) {
            ensureLayer(this, id);
            forEachOrientation(orientation => {
                const set = this[`_${orientation}`][id];
                for (const pixel of pixels) set.delete(pixel);
            });
            rehashLayer(this, id);
        },
        setOrientation(id, pixel, orientation) {
            ensureLayer(this, id);
            const current = this.orientationOf(id, pixel);
            if (current === 'none') return;
            this[`_${current}`][id].delete(pixel);
            this[`_${orientation}`][id].add(pixel);
            rehashLayer(this, id);
        },
        togglePixel(id, pixel) {
            ensureLayer(this, id);
            for (const orientation of PIXEL_ORIENTATIONS) {
                const set = this[`_${orientation}`][id];
                if (set.has(pixel)) {
                    set.delete(pixel);
                    rehashLayer(this, id);
                    return;
                }
            }
            if (this._defaultOrientation === 'checkerboard') {
                const [x, y] = indexToCoord(pixel);
                const dir = (x + y) % 2 === 0 ? 'horizontal' : 'vertical';
                this[`_${dir}`][id].add(pixel);
            }
            else if (this.defaultOrientation === 'slopeCheckerboard') {
                const [x, y] = indexToCoord(pixel);
                const dir = (x + y) % 2 === 0 ? 'downSlope' : 'upSlope';
                this[`_${dir}`][id].add(pixel);
            }
            else {
                this[`_${this._defaultOrientation}`][id].add(pixel);
            }
            rehashLayer(this, id);
        },
        translateAll(dx = 0, dy = 0) {
            dx |= 0; dy |= 0;
            if (dx === 0 && dy === 0) return;
            const touched = new Set();
            forEachOrientation(orientation => {
                const ids = Object.keys(this[`_${orientation}`]);
                for (const id of ids) {
                    const set = this[`_${orientation}`][id];
                    const moved = new Set();
                    for (const pixel of set) {
                        const [x, y] = indexToCoord(pixel);
                        moved.add(coordToIndex(x + dx, y + dy));
                    }
                    this[`_${orientation}`][id] = moved;
                    touched.add(id);
                }
            });
            for (const id of touched) rehashLayer(this, id);
        },
        serialize() {
            const result = {};
            const ids = new Set();
            forEachOrientation(orientation => {
                for (const id of Object.keys(this[`_${orientation}`])) ids.add(id);
            });
            for (const id of ids) {
                result[id] = [...unionSet(this, id)];
            }
            return result;
        },
        applySerialized(byId = {}) {
            forEachOrientation(orientation => { this[`_${orientation}`] = {}; });
            this._hash = { none: {}, horizontal: {}, downSlope: {}, vertical: {}, upSlope: {}, layers: {}, all: 0 };
            for (const id of Object.keys(byId)) {
                this.addPixels(id, byId[id], this._defaultOrientation);
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

