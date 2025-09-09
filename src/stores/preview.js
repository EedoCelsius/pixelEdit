import { defineStore } from 'pinia';
import { useNodeStore } from './nodes';
import { usePixelStore, PIXEL_ORIENTATIONS } from './pixels';
import { pixelsToUnionPath, indexToCoord } from '../utils/pixels.js';

export const usePreviewStore = defineStore('preview', {
    state: () => ({
        nodes: {}, // id -> partial node props
        pixels: {} // id -> orientation map overriding base state
    }),
    getters: {
        nodeColor(state) {
            const nodes = useNodeStore();
            return (id) => state.nodes[id]?.color ?? nodes.color(id);
        },
        nodeVisibility(state) {
            const nodes = useNodeStore();
            return (id) => state.nodes[id]?.visibility ?? nodes.visibility(id);
        },
        pathOf(state) {
            const pixelStore = usePixelStore();
            return (id) => {
                const preview = state.pixels[id];
                if (preview) {
                    const all = Object.values(preview).flat();
                    return pixelsToUnionPath(all);
                }
                return pixelStore.pathOf(id);
            };
        }
    },
    actions: {
        applyNodePreview(id, props = {}) {
            if (Object.keys(props).length) this.nodes[id] = { ...props };
            else delete this.nodes[id];
        },
        applyPixelPreview(id, { add = [], remove = [], orientation, orientationMap } = {}) {
            if (!orientationMap && add.length === 0 && remove.length === 0) {
                delete this.pixels[id];
                return;
            }
            const pixelStore = usePixelStore();
            const base = pixelStore.get(id);
            const map = Object.fromEntries(PIXEL_ORIENTATIONS.map(o => [o, new Set()]));
            for (let i = 0; i < base.length; i++) {
                const v = base[i];
                if (!v) continue;
                const o = PIXEL_ORIENTATIONS[v - 1];
                map[o].add(i);
            }
            if (orientationMap) {
                for (const [ori, pixels] of Object.entries(orientationMap)) {
                    for (const p of pixels) {
                        for (const o of PIXEL_ORIENTATIONS) map[o].delete(p);
                        map[ori].add(p);
                    }
                }
            }
            if (remove.length) {
                remove.forEach(p => {
                    for (const o of PIXEL_ORIENTATIONS) map[o].delete(p);
                });
            }
            if (add.length) {
                const defaultOrientation = orientation ?? pixelStore.defaultOrientation;
                add.forEach(p => {
                    for (const o of PIXEL_ORIENTATIONS) map[o].delete(p);
                    if (defaultOrientation === 'checkerboard') {
                        const [x, y] = indexToCoord(p);
                        const o = (x + y) % 2 === 0 ? 'horizontal' : 'vertical';
                        map[o].add(p);
                    } else if (defaultOrientation === 'slopeCheckerboard') {
                        const [x, y] = indexToCoord(p);
                        const o = (x + y) % 2 === 0 ? 'downSlope' : 'upSlope';
                        map[o].add(p);
                    } else {
                        map[defaultOrientation].add(p);
                    }
                });
            }
            const result = {};
            for (const o of PIXEL_ORIENTATIONS) {
                if (map[o].size) result[o] = [...map[o]];
            }
            if (Object.keys(result).length) this.pixels[id] = result;
            else delete this.pixels[id];
        },
        commitPreview() {
            const nodeStore = useNodeStore();
            for (const [id, props] of Object.entries(this.nodes)) {
                nodeStore.update(Number(id), props);
            }
            const pixelStore = usePixelStore();
            for (const [id, pixels] of Object.entries(this.pixels)) {
                pixelStore.set(Number(id), pixels);
            }
            this.clearPreview();
        },
        clearPreview() {
            this.nodes = {};
            this.pixels = {};
        }
    }
});

