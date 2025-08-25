import { defineStore } from 'pinia';
import { readonly, reactive } from 'vue';
import { coordsToKey, keyToCoords, pixelsToUnionPath, randColorU32, groupConnectedPixels } from '../utils';

export const useLayerStore = defineStore('layers', {
    state: () => ({
        _order: [],
        name: {},
        color: {},
        visible: {},
        locked: {},
        pixels: {},
        _selection: new Set()
    }),
    getters: {
        exists: (state) => state._order.length > 0,
        order: (state) => readonly(state._order),
        has: (state) => (id) => state.name[id] != null,
        count: (state) => state._order.length,
        idsBottomToTop: (state) => readonly(state._order.slice()),
        idsTopToBottom: (state, getters) => readonly(getters.idsBottomToTop.slice().reverse()),
        indexOfLayer: (state) => (id) => state._order.indexOf(id),
        pathOf: (state) => (id) => pixelsToUnionPath(state.pixels[id] || new Set()),
        colorOf: (state) => (id) => (state.color[id] ?? 0) >>> 0,
        nameOf: (state) => (id) => state.name[id],
        visibilityOf: (state) => (id) => !!state.visible[id],
        lockedOf: (state) => (id) => !!state.locked[id],
        pixelCountOf: (state) => (id) => state.pixels[id]?.size ?? 0,
        disconnectedCountOf: (state) => (id) => groupConnectedPixels(state.pixels[id] || new Set()).length,
        selectedIds: (state) => [...state._selection],
        selectionCount: (state) => state._selection.size,
        selectionExists: (state) => state._selection.size > 0,
        isSelected: (state) => (id) => state._selection.has(id),
        compositeColorAt: (state) => (x, y) => {
            const key = coordsToKey(x, y);
            for (let i = state._order.length - 1; i >= 0; i--) {
                const id = state._order[i];
                if (!state.visible[id]) continue;
                const set = state.pixels[id];
                if (set && set.has(key)) return (state.color[id] ?? 0) >>> 0;
            }
            return 0x00000000 >>> 0;
        },
        topVisibleIdAt: (state) => (x, y) => {
            const key = coordsToKey(x, y);
            for (let i = state._order.length - 1; i >= 0; i--) {
                const id = state._order[i];
                if (!state.visible[id]) continue;
                const set = state.pixels[id];
                if (set && set.has(key)) return id;
            }
            return null;
        },
    },
    actions: {
        _allocId() {
            let id = Date.now();
            while (this.has(id)) id++;
            return id;
        },
        /** Create a layer and insert relative to a reference id (above = on top of it). If refId null -> push on top */
        createLayer(layerProperties = {}, above = null) {
            const id = this._allocId();
            this.name[id] = layerProperties.name || 'Layer';
            this.visible[id] = layerProperties.visible ?? true;
            this.locked[id] = layerProperties.locked ?? false;
            this.color[id] = (layerProperties.colorU32 ?? randColorU32()) >>> 0;
            const keyedPixels = layerProperties.pixels ? layerProperties.pixels.map(p => coordsToKey(p[0], p[1])) : [];
            this.pixels[id] = reactive(new Set(keyedPixels));
            if (above === null) {
                this._order.push(id);
            } else {
                const idx = this.indexOfLayer(above);
                (idx < 0) ? this._order.push(id) : this._order.splice(idx + 1, 0, id);
            }
            return id;
        },
        /** Update properties of a layer */
        updateLayer(id, props) {
            if (this.name[id] == null) return;
            if (props.name !== undefined) this.name[id] = props.name;
            if (props.colorU32 !== undefined) this.color[id] = (props.colorU32 >>> 0);
            if (props.visible !== undefined) this.visible[id] = !!props.visible;
            if (props.locked !== undefined) this.locked[id] = !!props.locked;
        },
        toggleVisibility(id) {
            if (this.name[id] == null) return;
            this.visible[id] = !this.visible[id];
        },
        toggleLock(id) {
            if (this.name[id] == null) return;
            this.locked[id] = !this.locked[id];
        },
        addPixels(id, pixels) {
            let set = this.pixels[id];
            if (!set) return;
            for (const [x, y] of pixels) set.add(coordsToKey(x, y));
        },
        removePixels(id, pixels) {
            const set = this.pixels[id];
            if (!set) return;
            for (const [x, y] of pixels) set.delete(coordsToKey(x, y));
        },
        togglePixel(id, x, y) {
            let set = this.pixels[id];
            if (!set) return;
            const key = coordsToKey(x, y);
            if (set.has(key)) set.delete(key);
            else set.add(key);
        },
        snapshotPixels(id) {
            const arr = [];
            const set = this.pixels[id];
            if (!set) return arr;
            for (const key of set) arr.push(keyToCoords(key));
            return arr;
        },
        /** Remove layers by ids */
        deleteLayers(ids) {
            const idSet = new Set(ids);
            this._order = this._order.filter(id => !idSet.has(id));
            for (const id of idSet) {
                delete this.name[id];
                delete this.color[id];
                delete this.visible[id];
                delete this.locked[id];
                delete this.pixels[id];
            }
        },
        /** Reorder selected ids as a block relative to targetId. */
        reorderLayers(ids, targetId, placeBelow = true) {
            const selectionSet = new Set(ids);
            if (!selectionSet.size) return;
            const keptIds = this._order.filter(id => !selectionSet.has(id));
            let targetIndex = keptIds.indexOf(targetId);
            if (targetIndex < 0) targetIndex = keptIds.length;
            if (!placeBelow) targetIndex = targetIndex + 1;
            const selectionInStack = this._order.filter(id => selectionSet.has(id));
            keptIds.splice(targetIndex, 0, ...selectionInStack);
            this._order = keptIds;
        },
        deleteEmptyLayers() {
            const emptyIds = this._order.filter(id => {
                const set = this.pixels[id];
                return !set || set.size === 0;
            });
            if (emptyIds.length) this.deleteLayers(emptyIds);
            return emptyIds;
        },
        replaceSelection(ids = []) {
            this._selection = new Set(ids);
        },
        addToSelection(ids = []) {
            for (const id of ids) this._selection.add(id);
        },
        removeFromSelection(ids = []) {
            for (const id of ids) this._selection.delete(id);
        },
        toggleSelection(id) {
            if (id == null) return;
            if (this._selection.has(id)) this._selection.delete(id);
            else this._selection.add(id);
        },
        clearSelection() {
            this._selection.clear();
        },
        /** Serialization */
        serialize() {
            return {
                order: this._order.slice(),
                byId: Object.fromEntries(this._order.map(id => [id, {
                    name: this.name[id],
                    visible: !!this.visible[id],
                    locked: !!this.locked[id],
                    color: (this.color[id] ?? 0) >>> 0,
                    pixels: [...(this.pixels[id] || [])].map(key => keyToCoords(key))
                }])),
                selection: [...this._selection]
            };
        },
        applySerialized(payload) {
            const order = payload?.order || [];
            const byId = payload?.byId || {};
            // reset
            this._order = [];
            this.name = {};
            this.color = {};
            this.visible = {};
            this.locked = {};
            this.pixels = {};
            // rebuild
            for (const idStr of order) {
                const id = +idStr;
                const info = byId[idStr] || byId[id];
                if (!info) continue;
                this.name[id] = info.name || 'Layer';
                this.visible[id] = !!info.visible;
                this.locked[id] = !!info.locked;
                this.color[id] = (info.color ?? randColorU32()) >>> 0;
                const keyedPixels = info.pixels ? info.pixels.map(p => coordsToKey(p[0], p[1])) : [];
                this.pixels[id] = reactive(new Set(keyedPixels));
                this._order.push(id);
            }
            this._selection = new Set(payload?.selection || []);
        }
    }
});
