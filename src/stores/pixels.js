import { defineStore } from 'pinia';
import { coordToIndex, indexToCoord, pixelsToUnionPath, groupConnectedPixels } from '../utils';

export const PIXEL_DIRECTIONS = ['none', 'horizontal', 'downSlope', 'vertical', 'upSlope'];
export const PIXEL_DEFAULT_DIRECTIONS = [...PIXEL_DIRECTIONS, 'checkerboard', 'slopeCheckerboard'];

function unionSet(state, id) {
    const merged = new Set();
    for (const direction of PIXEL_DIRECTIONS) {
        const set = state[direction][id];
        if (!set) continue;
        for (const pixel of set) merged.add(pixel);
    }
    return merged;
}

export const usePixelStore = defineStore('pixels', {
    state: () => ({
        'none': {},
        'horizontal': {},
        'downSlope': {},
        'vertical': {},
        'upSlope': {},
        defaultDirection: localStorage.getItem('settings.defaultDirection') || PIXEL_DEFAULT_DIRECTIONS[0]
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
            for (const direction of PIXEL_DIRECTIONS) {
                const set = state[direction][id];
                if (set && set.has(pixel)) return true;
            }
            return false;
        }
    },
    actions: {
        set(id, pixels = []) {
            for (const direction of PIXEL_DIRECTIONS) delete this[direction][id];
            this.addPixels(id, pixels, this.defaultDirection);
        },
        remove(ids = []) {
            for (const id of ids) {
                for (const direction of PIXEL_DIRECTIONS) delete this[direction][id];
            }
        },
        addPixels(id, pixels, direction) {
            direction = direction ?? this.defaultDirection;
            if (direction === 'checkerboard') {
                if (!this['vertical'][id]) this['vertical'][id] = new Set();
                if (!this['horizontal'][id]) this['horizontal'][id] = new Set();
                for (const pixel of pixels) {
                    for (const dir of PIXEL_DIRECTIONS) this[dir][id]?.delete(pixel);
                    const [x, y] = indexToCoord(pixel);
                    const orientation = (x + y) % 2 === 0 ? 'horizontal' : 'vertical';
                    this[orientation][id].add(pixel);
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
                if (!this[direction][id]) this[direction][id] = new Set();
                for (const pixel of pixels) {
                    for (const dir of PIXEL_DIRECTIONS) this[dir][id]?.delete(pixel);
                    this[direction][id].add(pixel);
                }
            }
        },
        removePixels(id, pixels) {
            for (const direction of PIXEL_DIRECTIONS) {
                const set = this[direction][id];
                if (!set) continue;
                for (const pixel of pixels) set.delete(pixel);
            }
        },
        setDirection(id, pixel, direction) {
            const idx = PIXEL_DIRECTIONS.findIndex(k => this[k][id]?.has(pixel));
            if (idx === -1) return;
            const current = PIXEL_DIRECTIONS[idx];
            this[current][id].delete(pixel);
            if (!this[direction][id]) this[direction][id] = new Set();
            this[direction][id].add(pixel);
        },
        togglePixel(id, pixel) {
            for (const direction of PIXEL_DIRECTIONS) {
                const set = this[direction][id];
                if (set && set.has(pixel)) {
                    set.delete(pixel);
                    return;
                }
            }
            if (this.defaultDirection === 'checkerboard') {
                const [x, y] = indexToCoord(pixel);
                const dir = (x + y) % 2 === 0 ? 'horizontal' : 'vertical';
                if (!this[dir][id]) this[dir][id] = new Set();
                this[dir][id].add(pixel);
            }
            else if (this.defaultDirection === 'slopeCheckerboard') {
                const [x, y] = indexToCoord(pixel);
                const dir = (x + y) % 2 === 0 ? 'downSlope' : 'upSlope';
                if (!this[dir][id]) this[dir][id] = new Set();
                this[dir][id].add(pixel);
            }
            else {
                const target = this[this.defaultDirection][id];
                if (target) target.add(pixel);
            }
        },
        translateAll(dx = 0, dy = 0) {
            dx |= 0; dy |= 0;
            if (dx === 0 && dy === 0) return;
            for (const direction of PIXEL_DIRECTIONS) {
                const ids = Object.keys(this[direction]);
                for (const id of ids) {
                    const set = this[direction][id];
                    const moved = new Set();
                    for (const pixel of set) {
                        const [x, y] = indexToCoord(pixel);
                        moved.add(coordToIndex(x + dx, y + dy));
                    }
                    this[direction][id] = moved;
                }
            }
        },
        serialize() {
            const result = {};
            const ids = new Set();
            for (const direction of PIXEL_DIRECTIONS) {
                for (const id of Object.keys(this[direction])) ids.add(id);
            }
            for (const id of ids) {
                result[id] = [...unionSet(this, id)];
            }
            return result;
        },
        applySerialized(byId = {}) {
            for (const direction of PIXEL_DIRECTIONS) this[direction] = {};
            for (const id of Object.keys(byId)) {
                this.addPixels(id, byId[id], this.defaultDirection);
            }
        },
        setDefaultDirection(direction) {
            if (PIXEL_DEFAULT_DIRECTIONS.includes(direction)) {
                this.defaultDirection = direction;
                localStorage.setItem('settings.defaultDirection', direction);
            }
        }
    }
});

