import { defineStore } from 'pinia';
import { useNodeStore } from './nodes';
import { usePixelStore } from './pixels';
import { pixelsToUnionPath } from '../utils/pixels.js';

export const usePreviewStore = defineStore('preview', {
    state: () => ({
        nodes: {}, // id -> partial node props
        pixels: {} // id -> { add?, remove?, update? }
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
                const delta = state.pixels[id];
                if (delta) {
                    const base = pixelStore.get(id) || new Map();
                    const set = new Set(base.keys());
                    if (delta.add) delta.add.pixels.forEach(p => set.add(p));
                    if (delta.remove) delta.remove.forEach(p => set.delete(p));
                    if (delta.update) {
                        for (const [p, o] of Object.entries(delta.update)) {
                            const idx = Number(p);
                            if (o) set.add(idx); else set.delete(idx);
                        }
                    }
                    return pixelsToUnionPath(set);
                }
                return pixelStore.pathOf(id);
            };
        }
    },
    actions: {
        applyProperty(id, props = {}) {
            if (Object.keys(props).length) this.nodes[id] = { ...props };
            else delete this.nodes[id];
        },
        applyPixelAdd(id, pixels = [], orientation) {
            const entry = this.pixels[id] || {};
            entry.add = { pixels: [...pixels], orientation };
            if (entry.remove || entry.update || entry.add.pixels.length) this.pixels[id] = entry;
            else delete this.pixels[id];
        },
        applyPixelRemove(id, pixels = []) {
            const entry = this.pixels[id] || {};
            entry.remove = [...pixels];
            if (entry.add || entry.update || entry.remove.length) this.pixels[id] = entry;
            else delete this.pixels[id];
        },
        applyPixelUpdate(id, update = {}) {
            const entry = this.pixels[id] || {};
            entry.update = { ...update };
            if (entry.add || entry.remove || Object.keys(entry.update).length) this.pixels[id] = entry;
            else delete this.pixels[id];
        },
        commitPreview() {
            const nodeStore = useNodeStore();
            for (const [id, props] of Object.entries(this.nodes)) {
                nodeStore.update(Number(id), props);
            }
            const pixelStore = usePixelStore();
            for (const [id, delta] of Object.entries(this.pixels)) {
                const numId = Number(id);
                if (delta.add) pixelStore.add(numId, delta.add.pixels, delta.add.orientation);
                if (delta.remove) pixelStore.remove(numId, delta.remove);
                if (delta.update) pixelStore.update(numId, delta.update);
            }
            this.clearPreview();
        },
        clearPreview() {
            this.nodes = {};
            this.pixels = {};
        }
    }
});

