import { defineStore } from 'pinia';
import { coordToIndex, indexToCoord, pixelsToUnionPath, groupConnectedPixels, MAX_DIMENSION } from '../utils/pixels.js';
import { mixHash } from '../utils/hash.js';

export const PIXEL_ORIENTATIONS = ['none', 'horizontal', 'downSlope', 'vertical', 'upSlope'];
export const PIXEL_DEFAULT_ORIENTATIONS = [...PIXEL_ORIENTATIONS, 'checkerboard', 'slopeCheckerboard'];

const ORIENTATION_IDS = Object.fromEntries(PIXEL_ORIENTATIONS.map((o, i) => [o, i + 1]));
const ID_TO_ORIENTATION = Object.fromEntries(PIXEL_ORIENTATIONS.map((o, i) => [i + 1, o]));
const PIXEL_HASHES = crypto.getRandomValues(new Uint32Array(MAX_DIMENSION * MAX_DIMENSION));

function ensureLayer(store, id) {
    if (!store._pixels[id]) store._pixels[id] = new Uint8Array(MAX_DIMENSION * MAX_DIMENSION);
}

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
                return id.map(i => {
                    ensureLayer(s, i);
                    return s._pixels[i];
                });
            }
            ensureLayer(s, id);
            return s._pixels[id];
        },
        sizeOf: (s) => (id) => {
            ensureLayer(s, id);
            const arr = s._pixels[id];
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
        set(id, pixels = [], orientation) {
            if (pixels instanceof Uint8Array) {
                this._pixels[id] = pixels;
            } else if (Array.isArray(pixels)) {
                ensureLayer(this, id);
                this._pixels[id].fill(0);
                this.addPixels(id, pixels, orientation ?? this._defaultOrientation);
            } else {
                ensureLayer(this, id);
                this._pixels[id].fill(0);
                for (const [ori, arr] of Object.entries(pixels || {})) {
                    this.addPixels(id, arr, ori);
                }
            }
            rehashLayer(this, id);
        },
        remove(ids = []) {
            for (const id of ids) {
                const layerHash = this._hash.layers[id] || 0;
                this._hash.all ^= mixHash(id, layerHash);
                delete this._hash.layers[id];
                delete this._pixels[id];
            }
        },
        addPixels(id, pixels, orientation) {
            ensureLayer(this, id);
            const arr = this._pixels[id];
            orientation = orientation ?? this._defaultOrientation;
            if (orientation === 'checkerboard') {
                for (const pixel of pixels) {
                    const [x, y] = indexToCoord(pixel);
                    const o = (x + y) % 2 === 0 ? 'horizontal' : 'vertical';
                    arr[pixel] = ORIENTATION_IDS[o];
                }
            } else if (orientation === 'slopeCheckerboard') {
                for (const pixel of pixels) {
                    const [x, y] = indexToCoord(pixel);
                    const o = (x + y) % 2 === 0 ? 'downSlope' : 'upSlope';
                    arr[pixel] = ORIENTATION_IDS[o];
                }
            } else {
                const idOri = ORIENTATION_IDS[orientation] || ORIENTATION_IDS.none;
                for (const pixel of pixels) arr[pixel] = idOri;
            }
            rehashLayer(this, id);
        },
        removePixels(id, pixels) {
            ensureLayer(this, id);
            const arr = this._pixels[id];
            for (const pixel of pixels) arr[pixel] = 0;
            rehashLayer(this, id);
        },
        setOrientation(id, pixel, orientation) {
            ensureLayer(this, id);
            this._pixels[id][pixel] = ORIENTATION_IDS[orientation] || 0;
            rehashLayer(this, id);
        },
        togglePixel(id, pixel) {
            ensureLayer(this, id);
            const arr = this._pixels[id];
            if (arr[pixel]) {
                arr[pixel] = 0;
                rehashLayer(this, id);
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
            arr[pixel] = ORIENTATION_IDS[ori] || ORIENTATION_IDS.none;
            rehashLayer(this, id);
        },
        translateAll(dx = 0, dy = 0) {
            dx |= 0; dy |= 0;
            if (dx === 0 && dy === 0) return;
            const keys = Object.keys(this._pixels);
            for (const idStr of keys) {
                const id = Number(idStr);
                const arr = this._pixels[id];
                const moved = new Uint8Array(arr.length);
                for (let i = 0; i < arr.length; i++) {
                    const v = arr[i];
                    if (!v) continue;
                    const [x, y] = indexToCoord(i);
                    const nx = x + dx;
                    const ny = y + dy;
                    const ni = coordToIndex(nx, ny);
                    moved[ni] = v;
                }
                this._pixels[id] = moved;
                rehashLayer(this, id);
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

