import { defineStore } from 'pinia';
import { useNodeStore } from './nodes';
import { usePixelStore, OT } from './pixels';
import { pixelsToUnionPath } from '../utils/pixels.js';

export const usePreviewStore = defineStore('preview', {
    state: () => ({
        properties: {}, // id -> partial node props
        pixels: {} // id -> { pixel: orientation }
    }),
    getters: {
        nodeColor(state) {
            const nodes = useNodeStore();
            return (id) => state.properties[id]?.color ?? nodes.color(id);
        },
        nodeVisibility(state) {
            const nodes = useNodeStore();
            return (id) => state.properties[id]?.visibility ?? nodes.visibility(id);
        },
        pathOf(state) {
            const pixelStore = usePixelStore();
            return (id) => {
                const delta = state.pixels[id];
                if (delta) {
                    const base = pixelStore.get(id) || new Map();
                    const set = new Set(base.keys());
                    for (const [p, o] of Object.entries(delta)) {
                        const idx = Number(p);
                        if (o) set.add(idx); else set.delete(idx);
                    }
                    return pixelsToUnionPath(set);
                }
                return pixelStore.pathOf(id);
            };
        }
    },
    actions: {
        setProperties(id, props = {}) {
            const prev = this.properties[id] || {};
            const merged = { ...prev, ...props };
            if (Object.keys(merged).length) this.properties[id] = merged;
            else delete this.properties[id];
        },
        addPixels(id, pixels = [], orientation = OT.DEFAULT) {
            if (!pixels.length) return;
            const entry = this.pixels[id] || {};
            for (const p of pixels) entry[p] = orientation;
            this.pixels[id] = entry;
        },
        removePixels(id, pixels = []) {
            if (!pixels.length) return;
            const entry = this.pixels[id] || {};
            for (const p of pixels) entry[p] = 0;
            this.pixels[id] = entry;
        },
        updatePixels(id, update = {}) {
            if (!Object.keys(update).length) return;
            const entry = this.pixels[id] || {};
            Object.assign(entry, update);
            this.pixels[id] = entry;
        },
        commitPreview() {
            const nodeStore = useNodeStore();
            for (const [id, props] of Object.entries(this.properties)) {
                nodeStore.update(Number(id), props);
            }
            const pixelStore = usePixelStore();
            for (const [id, delta] of Object.entries(this.pixels)) {
                const numId = Number(id);
                pixelStore.update(numId, delta);
            }
            this.clear();
        },
        clear(id) {
            if (!id) {
                this.properties = {};
                this.pixels = {};
            } else {
                delete this.properties[id];
                delete this.pixels[id];
            }
        },
        clearProperty(id, property) {
            if (!id) {
                this.properties = {};
                return;
            }
            if (!property) {
                delete this.properties[id];
                return;
            }
            const entry = this.properties[id];
            if (entry) {
                delete entry[property];
                if (!Object.keys(entry).length) delete this.properties[id];
            }
        },
        clearPixel(id, pixel) {
            if (!id) {
                this.pixels = {};
                return;
            }
            if (!pixel) {
                delete this.pixels[id];
                return;
            }
            const entry = this.pixels[id];
            if (entry) {
                delete entry[pixel];
                if (!Object.keys(entry).length) delete this.pixels[id];
            }
        }
    }
});

