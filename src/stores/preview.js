import { defineStore } from 'pinia';
import { useNodeStore } from './nodes';
import { usePixelStore } from './pixels';
import { pixelsToUnionPath } from '../utils/pixels.js';

export const usePreviewStore = defineStore('preview', {
    state: () => ({
        nodes: {}, // id -> partial node props
        pixels: {} // id -> array of pixels overriding base state
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
        pathOfLayer(state) {
            const pixelStore = usePixelStore();
            return (id) => {
                const preview = state.pixels[id];
                if (preview) return pixelsToUnionPath(preview);
                return pixelStore.pathOfLayer(id);
            };
        }
    },
    actions: {
        applyNodePreview(id, props = {}) {
            if (Object.keys(props).length) this.nodes[id] = { ...props };
            else delete this.nodes[id];
        },
        applyPixelPreview(id, { add = [], remove = [] } = {}) {
            if (add.length === 0 && remove.length === 0) {
                delete this.pixels[id];
                return;
            }
            const pixelStore = usePixelStore();
            const base = new Set(pixelStore.get(id));
            add.forEach(p => base.add(p));
            remove.forEach(p => base.delete(p));
            this.pixels[id] = [...base];
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

