import { defineStore } from 'pinia';
import { watch } from 'vue';
import { useOverlayService } from '../services/overlay.js';
import { useNodeStore } from './nodes';
import { usePixelStore, OT, PIXEL_ORIENTATIONS } from './pixels';
import { useNodeTreeStore } from './nodeTree.js';
import { pixelsToUnionPath, orientationPatternUrl } from '../utils/pixels.js';

export const usePreviewStore = defineStore('preview', {
    state: () => ({
        properties: {}, // id -> partial node props
        pixels: {}, // id -> { pixel: orientation }
        orientationLayers: []
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
        },
        initOrientationRenderer() {
            if (this._orientationOverlays) return;
            const overlayService = useOverlayService();
            const pixelStore = usePixelStore();
            const nodeTree = useNodeTreeStore();
            this._orientationOverlays = PIXEL_ORIENTATIONS.map(o => {
                const id = overlayService.createOverlay();
                overlayService.setStyles(id, {
                    FILL_COLOR: orientationPatternUrl(o),
                    STROKE_COLOR: 'none',
                    STROKE_WIDTH_SCALE: 0,
                    FILL_RULE: 'evenodd'
                });
                return id;
            });
            const getOrientationPixels = (id, orientation) => {
                const pixels = [];
                const map = pixelStore.get(id);
                for (const [idx, o] of map) if (o === orientation) pixels.push(idx);
                const delta = this.pixels[id];
                if (delta) {
                    const set = new Set(pixels);
                    for (const [pStr, o] of Object.entries(delta)) {
                        const p = Number(pStr);
                        if (o === orientation) set.add(p); else set.delete(p);
                    }
                    return [...set];
                }
                return pixels;
            };
            const render = () => {
                const overlays = this._orientationOverlays;
                overlays.forEach(id => overlayService.clear(id));

                const seen = new Set();
                const layers = nodeTree.layerIdsTopToBottom
                    .filter(id => this.orientationLayers.includes(id) && this.nodeVisibility(id));

                for (const id of layers) {
                    PIXEL_ORIENTATIONS.forEach((orientation, idx) => {
                        let pixels = getOrientationPixels(id, orientation)
                            .filter(p => !seen.has(p));
                        if (pixels.length) {
                            overlayService.addPixels(overlays[idx], pixels);
                            pixels.forEach(p => seen.add(p));
                        }
                    });
                }
            };
            watch(() => this.pixels, render, { deep: true });
            watch(() => this.orientationLayers.slice(), render);
            render();
        },
        setOrientationLayers(ids = []) {
            this.orientationLayers = Array.isArray(ids) ? ids : [ids];
        },
        clearOrientationLayers() {
            this.orientationLayers = [];
            if (this._orientationOverlays) {
                const overlayService = useOverlayService();
                this._orientationOverlays.forEach(id => overlayService.clear(id));
            }
        }
    }
});

