import { defineStore } from 'pinia';
import { coordToIndex, indexToCoord, pixelsToUnionPath, groupConnectedPixels, MAX_DIMENSION } from '../utils/pixels.js';
import { mixHash } from '../utils/hash.js';

export const PIXEL_ORIENTATIONS = ['none', 'horizontal', 'downSlope', 'vertical', 'upSlope'];
export const PIXEL_DEFAULT_ORIENTATIONS = [...PIXEL_ORIENTATIONS, 'checkerboard', 'slopeCheckerboard'];

const ORIENTATION_IDS = Object.fromEntries(PIXEL_ORIENTATIONS.map((o, i) => [o, i + 1]));
const ID_TO_ORIENTATION = Object.fromEntries(PIXEL_ORIENTATIONS.map((o, i) => [i + 1, o]));
const PIXEL_HASHES = crypto.getRandomValues(new Uint32Array(MAX_DIMENSION * MAX_DIMENSION));

function hashLayer(arr) {
    let h = 0;
    for (let i = 0; i < arr.length; i++) {
        const v = arr[i];
        if (v) h ^= mixHash(v, PIXEL_HASHES[i]);
    }
    return h;
}

function rehashLayer(store, id) {
    const arr = store._pixels[id] || new Uint8Array(MAX_DIMENSION * MAX_DIMENSION);
    const oldHash = store._hash.layers[id] || 0;
    const layerHash = hashLayer(arr);
    store._hash.layers[id] = layerHash;
    store._hash.all ^= mixHash(id, oldHash) ^ mixHash(id, layerHash);
}

function initLayerHash(store, id) {
    if (store._hash.layers[id] === undefined) {
        store._hash.layers[id] = 0;
        store._hash.all ^= mixHash(id, 0);
    }
}

function updatePixelHash(store, id, index, oldVal, newVal) {
    initLayerHash(store, id);
    const oldLayerHash = store._hash.layers[id];
    const oldMix = oldVal ? mixHash(oldVal, PIXEL_HASHES[index]) : 0;
    const newMix = newVal ? mixHash(newVal, PIXEL_HASHES[index]) : 0;
    const newLayerHash = oldLayerHash ^ oldMix ^ newMix;
    store._hash.layers[id] = newLayerHash;
    store._hash.all ^= mixHash(id, oldLayerHash) ^ mixHash(id, newLayerHash);
}

export const usePixelStore = defineStore('pixels', {
    state: () => ({
        _pixels: {},
        _defaultOrientation: localStorage.getItem('settings.defaultOrientation') || PIXEL_DEFAULT_ORIENTATIONS[0],
        _hash: { layers: {}, all: 0 }
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
            const arr = s._pixels[id];
            if (!arr) return 0;
            let c = 0;
            for (let i = 0; i < arr.length; i++) if (arr[i]) c++;
            return c;
        },
        orientationOf: (s) => (id, pixel) => {
            const v = s._pixels[id]?.[pixel] || 0;
            return ID_TO_ORIENTATION[v];
        },
        pathOf: (s) => (id) => {
            return pixelsToUnionPath(s._pixels[id]);
        },
        disconnectedCountOf: (s) => (id) => {
            const arr = s._pixels[id];
            if (!arr) return 0;
            return groupConnectedPixels(arr).length;
        },
        has: (s) => (id, pixel) => {
            return (s._pixels[id]?.[pixel] || 0) > 0;
        }
    },
    actions: {
        addLayer(ids = []) {
            if (!Array.isArray(ids)) ids = [ids];
            for (const id of ids) {
                if (id == null || this._pixels[id]) continue;
                this._pixels[id] = new Uint8Array(MAX_DIMENSION * MAX_DIMENSION);
                initLayerHash(this, id);
            }
        },
        set(id, pixels, orientation) {
            if (!this._pixels[id]) return;
            if (pixels instanceof Uint8Array) {
                this._pixels[id] = pixels;
                rehashLayer(this, id);
                return;
            }
            const arr = this._pixels[id];
            if (pixels == null) {
                arr.fill(0);
                rehashLayer(this, id);
                return;
            }
            arr.fill(0);
            const oldHash = this._hash.layers[id] || 0;
            this._hash.all ^= mixHash(id, oldHash) ^ mixHash(id, 0);
            this._hash.layers[id] = 0;
            const entries = Array.isArray(pixels) ? [[orientation, pixels]] : Object.entries(pixels);
            for (const [ori, arrPixels] of entries) {
                this.add(id, arrPixels, ori);
            }
        },
        removeLayer(ids = []) {
            if (!Array.isArray(ids)) ids = [ids];
            for (const id of ids) {
                const layerHash = this._hash.layers[id] || 0;
                this._hash.all ^= mixHash(id, layerHash);
                delete this._hash.layers[id];
                delete this._pixels[id];
            }
        },
        add(id, pixels, orientation) {
            const arr = this._pixels[id];
            if (!arr) return;
            initLayerHash(this, id);
            orientation = orientation ?? this._defaultOrientation;
            if (orientation === 'checkerboard') {
                for (const pixel of pixels) {
                    const [x, y] = indexToCoord(pixel);
                    const o = (x + y) % 2 === 0 ? 'horizontal' : 'vertical';
                    const newVal = ORIENTATION_IDS[o];
                    const oldVal = arr[pixel];
                    arr[pixel] = newVal;
                    updatePixelHash(this, id, pixel, oldVal, newVal);
                }
            } else if (orientation === 'slopeCheckerboard') {
                for (const pixel of pixels) {
                    const [x, y] = indexToCoord(pixel);
                    const o = (x + y) % 2 === 0 ? 'downSlope' : 'upSlope';
                    const newVal = ORIENTATION_IDS[o];
                    const oldVal = arr[pixel];
                    arr[pixel] = newVal;
                    updatePixelHash(this, id, pixel, oldVal, newVal);
                }
            } else {
                const idOri = ORIENTATION_IDS[orientation] || ORIENTATION_IDS.none;
                for (const pixel of pixels) {
                    const oldVal = arr[pixel];
                    arr[pixel] = idOri;
                    updatePixelHash(this, id, pixel, oldVal, idOri);
                }
            }
        },
        remove(id, pixels) {
            const arr = this._pixels[id];
            if (!arr) return;
            initLayerHash(this, id);
            for (const pixel of pixels) {
                const oldVal = arr[pixel];
                if (!oldVal) continue;
                arr[pixel] = 0;
                updatePixelHash(this, id, pixel, oldVal, 0);
            }
        },
        togglePixel(id, pixel) {
            const arr = this._pixels[id];
            if (!arr) return;
            initLayerHash(this, id);
            const oldVal = arr[pixel];
            if (oldVal) {
                arr[pixel] = 0;
                updatePixelHash(this, id, pixel, oldVal, 0);
                return;
            }
            let ori = this._defaultOrientation;
            if (ori === 'checkerboard') {
                const [x, y] = indexToCoord(pixel);
                ori = (x + y) % 2 === 0 ? 'horizontal' : 'vertical';
            } else if (ori === 'slopeCheckerboard') {
                const [x, y] = indexToCoord(pixel);
                ori = (x + y) % 2 === 0 ? 'downSlope' : 'upSlope';
            }
            const newVal = ORIENTATION_IDS[ori] || ORIENTATION_IDS.none;
            arr[pixel] = newVal;
            updatePixelHash(this, id, pixel, oldVal, newVal);
        },
        translateAll(dx = 0, dy = 0) {
            dx |= 0; dy |= 0;
            if (dx === 0 && dy === 0) return;
            const keys = Object.keys(this._pixels);
            for (const idStr of keys) {
                const id = Number(idStr);
                initLayerHash(this, id);
                const arr = this._pixels[id];
                const moved = new Uint8Array(arr.length);
                let layerHash = 0;
                for (let i = 0; i < arr.length; i++) {
                    const v = arr[i];
                    if (!v) continue;
                    const [x, y] = indexToCoord(i);
                    const nx = x + dx;
                    const ny = y + dy;
                    const ni = coordToIndex(nx, ny);
                    moved[ni] = v;
                    layerHash ^= mixHash(v, PIXEL_HASHES[ni]);
                }
                const oldHash = this._hash.layers[id] || 0;
                this._hash.layers[id] = layerHash;
                this._hash.all ^= mixHash(id, oldHash) ^ mixHash(id, layerHash);
                this._pixels[id] = moved;
            }
        },
        serialize() {
            const result = {};
            for (const [id, arr] of Object.entries(this._pixels)) {
                result[id] = Array.from(arr);
            }
            return result;
        },
        applySerialized(byId = {}) {
            this._pixels = {};
            this._hash = { layers: {}, all: 0 };
            for (const [id, data] of Object.entries(byId)) {
                const arr = data instanceof Uint8Array ? data : Uint8Array.from(data);
                this._pixels[id] = arr;
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

