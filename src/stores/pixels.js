import { defineStore } from 'pinia';
import { coordToIndex, indexToCoord, pixelsToUnionPath, groupConnectedPixels, MAX_DIMENSION } from '../utils/pixels.js';
import { mixHash } from '../utils/hash.js';

export const PIXEL_DIRECTIONS = ['none', 'horizontal', 'downSlope', 'vertical', 'upSlope'];
export const PIXEL_DEFAULT_DIRECTIONS = [...PIXEL_DIRECTIONS, 'checkerboard', 'slopeCheckerboard'];

const DIRECTION_IDS = Object.fromEntries(PIXEL_DIRECTIONS.map((d, i) => [d, i + 1]));
const PIXEL_HASHES = crypto.getRandomValues(new Uint32Array(MAX_DIMENSION * MAX_DIMENSION));

function forEachDirection(cb) {
    for (const direction of PIXEL_DIRECTIONS) cb(direction);
}

function ensureLayer(store, id) {
    if (store._none[id]) return;
    forEachDirection(direction => { store[`_${direction}`][id] = new Set(); });
}

function unionSet(state, id) {
    const merged = new Set();
    forEachDirection(direction => {
        for (const pixel of state[`_${direction}`][id]) merged.add(pixel);
    });
    return merged;
}

function clearPixelAcross(store, id, pixel) {
    forEachDirection(direction => store[`_${direction}`][id].delete(pixel));
}

function hashDirectionPixels(store, id, direction) {
    let h = 0;
    for (const p of store[`_${direction}`][id]) h ^= PIXEL_HASHES[p];
    return h;
}

function rehashLayer(store, id) {
    const oldLayerHash = store._hash.layers[id] || 0;
    let layerHash = 0;
    for (const dir of PIXEL_DIRECTIONS) {
        const dirHash = hashDirectionPixels(store, id, dir);
        store._hash[dir][id] = dirHash;
        layerHash ^= mixHash(DIRECTION_IDS[dir], dirHash);
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
        _defaultDirection: localStorage.getItem('settings.defaultDirection') || PIXEL_DEFAULT_DIRECTIONS[0],
        _hash: { none: {}, horizontal: {}, downSlope: {}, vertical: {}, upSlope: {}, layers: {}, all: 0 }
    }),
    getters: {
        defaultDirection: (state) => state._defaultDirection,
        get: (state) => (id) => {
            return [...unionSet(state, id)];
        },
        getDirectionPixels: (state) => (direction, id) => {
            return [...state[`_${direction}`][id]];
        },
        getDirectional: (state) => (id) => {
            const result = {};
            forEachDirection(direction => {
                const set = state[`_${direction}`][id];
                if (set.size) result[direction] = [...set];
            });
            return result;
        },
        directionOf: (state) => (id, pixel) => {
            for (const direction of PIXEL_DIRECTIONS) {
                if (state[`_${direction}`][id].has(pixel)) return direction;
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
            for (const direction of PIXEL_DIRECTIONS) {
                if (state[`_${direction}`][id].has(pixel)) return true;
            }
            return false;
        }
    },
    actions: {
        set(id, pixels = [], direction) {
            ensureLayer(this, id);
            forEachDirection(dir => this[`_${dir}`][id].clear());
            if (Array.isArray(pixels)) {
                this.addPixels(id, pixels, direction ?? this._defaultDirection);
            } else {
                forEachDirection(dir => {
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
                forEachDirection(direction => {
                    delete this[`_${direction}`][id];
                    delete this._hash[direction][id];
                });
            }
        },
        addPixels(id, pixels, direction) {
            ensureLayer(this, id);
            direction = direction ?? this._defaultDirection;
            if (direction === 'checkerboard') {
                for (const pixel of pixels) {
                    clearPixelAcross(this, id, pixel);
                    const [x, y] = indexToCoord(pixel);
                    const orientation = (x + y) % 2 === 0 ? 'horizontal' : 'vertical';
                    this[`_${orientation}`][id].add(pixel);
                }
            }
            else if (direction === 'slopeCheckerboard') {
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
                    this[`_${direction}`][id].add(pixel);
                }
            }
            rehashLayer(this, id);
        },
        removePixels(id, pixels) {
            ensureLayer(this, id);
            forEachDirection(direction => {
                const set = this[`_${direction}`][id];
                for (const pixel of pixels) set.delete(pixel);
            });
            rehashLayer(this, id);
        },
        setDirection(id, pixel, direction) {
            ensureLayer(this, id);
            const current = this.directionOf(id, pixel);
            if (current === 'none') return;
            this[`_${current}`][id].delete(pixel);
            this[`_${direction}`][id].add(pixel);
            rehashLayer(this, id);
        },
        togglePixel(id, pixel) {
            ensureLayer(this, id);
            for (const direction of PIXEL_DIRECTIONS) {
                const set = this[`_${direction}`][id];
                if (set.has(pixel)) {
                    set.delete(pixel);
                    rehashLayer(this, id);
                    return;
                }
            }
            if (this._defaultDirection === 'checkerboard') {
                const [x, y] = indexToCoord(pixel);
                const dir = (x + y) % 2 === 0 ? 'horizontal' : 'vertical';
                this[`_${dir}`][id].add(pixel);
            }
            else if (this.defaultDirection === 'slopeCheckerboard') {
                const [x, y] = indexToCoord(pixel);
                const dir = (x + y) % 2 === 0 ? 'downSlope' : 'upSlope';
                this[`_${dir}`][id].add(pixel);
            }
            else {
                this[`_${this._defaultDirection}`][id].add(pixel);
            }
            rehashLayer(this, id);
        },
        translateAll(dx = 0, dy = 0) {
            dx |= 0; dy |= 0;
            if (dx === 0 && dy === 0) return;
            const touched = new Set();
            forEachDirection(direction => {
                const ids = Object.keys(this[`_${direction}`]);
                for (const id of ids) {
                    const set = this[`_${direction}`][id];
                    const moved = new Set();
                    for (const pixel of set) {
                        const [x, y] = indexToCoord(pixel);
                        moved.add(coordToIndex(x + dx, y + dy));
                    }
                    this[`_${direction}`][id] = moved;
                    touched.add(id);
                }
            });
            for (const id of touched) rehashLayer(this, id);
        },
        serialize() {
            const result = {};
            const ids = new Set();
            forEachDirection(direction => {
                for (const id of Object.keys(this[`_${direction}`])) ids.add(id);
            });
            for (const id of ids) {
                result[id] = [...unionSet(this, id)];
            }
            return result;
        },
        applySerialized(byId = {}) {
            forEachDirection(direction => { this[`_${direction}`] = {}; });
            this._hash = { none: {}, horizontal: {}, downSlope: {}, vertical: {}, upSlope: {}, layers: {}, all: 0 };
            for (const id of Object.keys(byId)) {
                this.addPixels(id, byId[id], this._defaultDirection);
            }
        },
        setDefaultDirection(direction) {
            if (PIXEL_DEFAULT_DIRECTIONS.includes(direction)) {
                this._defaultDirection = direction;
                localStorage.setItem('settings.defaultDirection', direction);
            }
        }
    }
});

