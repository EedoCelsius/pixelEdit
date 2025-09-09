import { defineStore } from 'pinia';
import { useNodeStore } from './nodes';
import { usePixelStore } from './pixels';

// pending edits are staged until the next microtask so that if commitPreview()
// is called within the same tick, the preview state is never touched
let pendingNodeEdits = {};
let pendingPixelEdits = {};
let flushPromise = null;

function scheduleFlush(store) {
    if (flushPromise) return;
    flushPromise = Promise.resolve().then(() => {
        flushPromise = null;
        for (const [idStr, props] of Object.entries(pendingNodeEdits)) {
            const id = Number(idStr);
            if (!store.nodeEdits[id]) store.nodeEdits[id] = {};
            Object.assign(store.nodeEdits[id], props);
        }
        for (const [idStr, diff] of Object.entries(pendingPixelEdits)) {
            const id = Number(idStr);
            if (!store.pixelEdits[id]) store.pixelEdits[id] = { add: new Set(), remove: new Set() };
            const entry = store.pixelEdits[id];
            diff.add.forEach(p => {
                entry.add.add(p);
                entry.remove.delete(p);
            });
            diff.remove.forEach(p => {
                entry.remove.add(p);
                entry.add.delete(p);
            });
        }
        pendingNodeEdits = {};
        pendingPixelEdits = {};
    });
}

export const usePreviewStore = defineStore('preview', {
    state: () => ({
        nodeEdits: {}, // { id: {prop:value} }
        pixelEdits: {} // { id: { add:Set, remove:Set } }
    }),
    actions: {
        applyNodePreview(id, props = {}) {
            const prev = pendingNodeEdits[id] || {};
            pendingNodeEdits[id] = { ...prev, ...props };
            scheduleFlush(this);
        },
        applyPixelPreview(id, { add = [], remove = [] } = {}) {
            if (!pendingPixelEdits[id]) pendingPixelEdits[id] = { add: new Set(), remove: new Set() };
            const entry = pendingPixelEdits[id];
            add.forEach(p => {
                entry.add.add(p);
                entry.remove.delete(p);
            });
            remove.forEach(p => {
                entry.remove.add(p);
                entry.add.delete(p);
            });
            scheduleFlush(this);
        },
        commitPreview() {
            const nodeStore = useNodeStore();
            const pixelStore = usePixelStore();

            if (flushPromise) {
                // commit pending edits directly without touching reactive preview state
                for (const [idStr, props] of Object.entries(pendingNodeEdits)) {
                    nodeStore.update(Number(idStr), props);
                }
                for (const [idStr, diff] of Object.entries(pendingPixelEdits)) {
                    const id = Number(idStr);
                    const base = new Set(pixelStore.get(id));
                    diff.add.forEach(p => base.add(p));
                    diff.remove.forEach(p => base.delete(p));
                    pixelStore.set(id, [...base]);
                }
                pendingNodeEdits = {};
                pendingPixelEdits = {};
                flushPromise = null;
            }

            for (const [idStr, props] of Object.entries(this.nodeEdits)) {
                nodeStore.update(Number(idStr), props);
            }
            for (const [idStr, diff] of Object.entries(this.pixelEdits)) {
                const id = Number(idStr);
                const base = new Set(pixelStore.get(id));
                diff.add.forEach(p => base.add(p));
                diff.remove.forEach(p => base.delete(p));
                pixelStore.set(id, [...base]);
            }

            this.clearPreview();
        },
        clearPreview() {
            this.nodeEdits = {};
            this.pixelEdits = {};
            pendingNodeEdits = {};
            pendingPixelEdits = {};
            flushPromise = null;
        }
    }
});
