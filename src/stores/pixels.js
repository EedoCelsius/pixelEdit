import { defineStore } from 'pinia';
import { coordToIndex, indexToCoord, pixelsToUnionPath, groupConnectedPixels } from '../utils';

export const PIXEL_DIRECTIONS = ['none', 'horizontal', 'downSlope', 'vertical', 'upSlope'];
export const PIXEL_DEFAULT_DIRECTIONS = [...PIXEL_DIRECTIONS, 'checkerboard', 'slopeCheckerboard'];

function unionSet(state, id) {
    const merged = new Set();
    for (const direction of PIXEL_DIRECTIONS) {
        const set = state[`_${direction}`][id];
        if (!set) continue;
        for (const pixel of set) merged.add(pixel);
    }
    return merged;
}

export const usePixelStore = defineStore('pixels', {
    state: () => ({
        _none: {},
        _horizontal: {},
        _downSlope: {},
        _vertical: {},
        _upSlope: {},
        _defaultDirection: localStorage.getItem('settings.defaultDirection') || PIXEL_DEFAULT_DIRECTIONS[0]
    }),
    getters: {
        defaultDirection: (state) => state._defaultDirection,
        get: (state) => (id) => {
            return [...unionSet(state, id)];
        },
        getDirectionPixels: (state) => (direction, id) => {
            const set = state[`_${direction}`][id];
            return set ? [...set] : [];
        },
        getDirectional: (state) => (id) => {
            const result = {};
            for (const direction of PIXEL_DIRECTIONS) {
                const set = state[`_${direction}`][id];
                if (set && set.size) result[direction] = [...set];
            }
            return result;
        },
        directionOf: (state) => (id, pixel) => {
            for (const direction of PIXEL_DIRECTIONS) {
                const set = state[`_${direction}`][id];
                if (set && set.has(pixel)) return direction;
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
                const set = state[`_${direction}`][id];
                if (set && set.has(pixel)) return true;
            }
            return false;
        }
    },
    actions: {
        set(id, pixels = [], direction) {
            for (const dir of PIXEL_DIRECTIONS) delete this[`_${dir}`][id];
            if (Array.isArray(pixels)) {
                this.addPixels(id, pixels, direction ?? this._defaultDirection);
            } else {
                for (const dir of PIXEL_DIRECTIONS) {
                    if (pixels[dir]?.length) this.addPixels(id, pixels[dir], dir);
                }
            }
        },
        remove(ids = []) {
            for (const id of ids) {
                for (const direction of PIXEL_DIRECTIONS) delete this[`_${direction}`][id];
            }
        },
        addPixels(id, pixels, direction) {
            direction = direction ?? this._defaultDirection;
            if (direction === 'checkerboard') {
                if (!this._vertical[id]) this._vertical[id] = new Set();
                if (!this._horizontal[id]) this._horizontal[id] = new Set();
                for (const pixel of pixels) {
                    for (const dir of PIXEL_DIRECTIONS) this[`_${dir}`][id]?.delete(pixel);
                    const [x, y] = indexToCoord(pixel);
                    const orientation = (x + y) % 2 === 0 ? 'horizontal' : 'vertical';
                    this[`_${orientation}`][id].add(pixel);
                }
            }
            else if (direction === 'slopeCheckerboard') {
                if (!this['downSlope'][id]) this['downSlope'][id] = new Set();
                if (!this['upSlope'][id]) this['upSlope'][id] = new Set();
                for (const pixel of pixels) {
                    for (const dir of PIXEL_DIRECTIONS) this[dir][id]?.delete(pixel);
                    const [x, y] = indexToCoord(pixel);
                    const orientation = (x + y) % 2 === 0 ? 'downSlope' : 'upSlope';
                    this[orientation][id].add(pixel);
                }
            }
            else {
                if (!this[`_${direction}`][id]) this[`_${direction}`][id] = new Set();
                for (const pixel of pixels) {
                    for (const dir of PIXEL_DIRECTIONS) this[`_${dir}`][id]?.delete(pixel);
                    this[`_${direction}`][id].add(pixel);
                }
            }
        },
        removePixels(id, pixels) {
            for (const direction of PIXEL_DIRECTIONS) {
                const set = this[`_${direction}`][id];
                if (!set) continue;
                for (const pixel of pixels) set.delete(pixel);
            }
        },
        setDirection(id, pixel, direction) {
            const current = this.directionOf(id, pixel);
            if (current === 'none') return;
            this[`_${current}`][id].delete(pixel);
            if (!this[`_${direction}`][id]) this[`_${direction}`][id] = new Set();
            this[`_${direction}`][id].add(pixel);
        },
        togglePixel(id, pixel) {
            for (const direction of PIXEL_DIRECTIONS) {
                const set = this[`_${direction}`][id];
                if (set && set.has(pixel)) {
                    set.delete(pixel);
                    return;
                }
            }
            if (this._defaultDirection === 'checkerboard') {
                const [x, y] = indexToCoord(pixel);
                const dir = (x + y) % 2 === 0 ? 'horizontal' : 'vertical';
                if (!this[`_${dir}`][id]) this[`_${dir}`][id] = new Set();
                this[`_${dir}`][id].add(pixel);
            }
            else if (this.defaultDirection === 'slopeCheckerboard') {
                const [x, y] = indexToCoord(pixel);
                const dir = (x + y) % 2 === 0 ? 'downSlope' : 'upSlope';
                if (!this[dir][id]) this[dir][id] = new Set();
                this[dir][id].add(pixel);
            }
            else {
                const target = this[`_${this._defaultDirection}`][id];
                if (target) target.add(pixel);
            }
        },
        translateAll(dx = 0, dy = 0) {
            dx |= 0; dy |= 0;
            if (dx === 0 && dy === 0) return;
            for (const direction of PIXEL_DIRECTIONS) {
                const ids = Object.keys(this[`_${direction}`]);
                for (const id of ids) {
                    const set = this[`_${direction}`][id];
                    const moved = new Set();
                    for (const pixel of set) {
                        const [x, y] = indexToCoord(pixel);
                        moved.add(coordToIndex(x + dx, y + dy));
                    }
                    this[`_${direction}`][id] = moved;
                }
            }
        },
        serialize() {
            const result = {};
            const ids = new Set();
            for (const direction of PIXEL_DIRECTIONS) {
                for (const id of Object.keys(this[`_${direction}`])) ids.add(id);
            }
            for (const id of ids) {
                result[id] = [...unionSet(this, id)];
            }
            return result;
        },
        applySerialized(byId = {}) {
            for (const direction of PIXEL_DIRECTIONS) this[`_${direction}`] = {};
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

