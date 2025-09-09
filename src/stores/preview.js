import { defineStore } from 'pinia';
import { useNodeStore } from './nodes';
import { usePixelStore } from './pixels';
import { pixelsToUnionPath } from '../utils/pixels.js';

export const usePreviewStore = defineStore('preview', {
    state: () => ({
        nodes: {}, // id -> partial node props
        pixels: {} // id -> delta of pixel changes
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
                    const base = pixelStore.get(id) || [];
                    const set = new Set();
                    for (let i = 0; i < base.length; i++) if (base[i]) set.add(i);
                    if (delta.remove) delta.remove.forEach(p => set.delete(p));
                    if (delta.orientationMap) {
                        for (const arr of Object.values(delta.orientationMap)) {
                            arr.forEach(p => set.add(p));
                        }
                    }
                    if (delta.add) delta.add.forEach(p => set.add(p));
                    return pixelsToUnionPath([...set]);
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
            const entry = {};
            if (add.length) {
                entry.add = [...add];
                if (orientation != null) entry.orientation = orientation;
            }
            if (remove.length) entry.remove = [...remove];
            if (orientationMap && Object.keys(orientationMap).length) entry.orientationMap = { ...orientationMap };
            if (Object.keys(entry).length) this.pixels[id] = entry;
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
                if (delta.remove?.length) pixelStore.remove(numId, delta.remove);
                if (delta.orientationMap) {
                    for (const [ori, arr] of Object.entries(delta.orientationMap)) {
                        pixelStore.add(numId, arr, ori);
                    }
                }
                if (delta.add?.length) pixelStore.add(numId, delta.add, delta.orientation);
            }
            this.clearPreview();
        },
        clearPreview() {
            this.nodes = {};
            this.pixels = {};
        }
    }
});

