import { defineStore } from 'pinia';
import { readonly, reactive } from 'vue';
import { coordToKey, keyToCoord, pixelsToUnionPath, randColorU32, groupConnectedPixels } from '../utils';

export const useLayerStore = defineStore('layers', {
    state: () => ({
        _order: [],
        _name: {},
        _color: {},
        _visible: {},
        _locked: {},
        _pixels: {},
        _selection: new Set()
    }),
    getters: {
        exists: (state) => state._order.length > 0,
        order: (state) => readonly(state._order),
        has: (state) => (id) => state._name[id] != null,
        count: (state) => state._order.length,
        idsBottomToTop: (state) => readonly(state._order),
        idsTopToBottom: (state) => readonly([...state._order].reverse()),
        indexOfLayer: (state) => (id) => state._order.indexOf(id),
        pathOf: (state) => (id) => pixelsToUnionPath([...state._pixels[id]].map(keyToCoord)),
        disconnectedCountOf: (state) => (id) => groupConnectedPixels([...state._pixels[id]].map(keyToCoord)).length,
        getProperty: (state) => (id, prop) => {
            switch (prop) {
                case 'name':
                    return state._name[id];
                case 'color':
                    return (state._color[id] >>> 0);
                case 'visible':
                    return !!state._visible[id];
                case 'locked':
                    return !!state._locked[id];
                case 'pixels':
                    return [...state._pixels[id]].map(keyToCoord);
                default:
                    return undefined;
            }
        },
        getProperties: (state) => {
            const propsOf = (id) => ({
                id,
                name: state._name[id],
                color: (state._color[id] >>> 0),
                visible: !!state._visible[id],
                locked: !!state._locked[id],
                pixels: [...state._pixels[id]].map(keyToCoord)
            });
            return (ids = []) => {
                if (Array.isArray(ids)) return ids.map(propsOf);
                return propsOf(ids);
            };
        },
        selectedIds: (state) => [...state._selection],
        selectionCount: (state) => state._selection.size,
        selectionExists: (state) => state._selection.size > 0,
        isSelected: (state) => (id) => state._selection.has(id),
        compositeColorAt: (state) => (coord) => {
            const key = coordToKey(coord);
            for (let i = state._order.length - 1; i >= 0; i--) {
                const id = state._order[i];
                if (!state._visible[id]) continue;
                const set = state._pixels[id];
                if (set.has(key)) return (state._color[id] >>> 0);
            }
            return 0x00000000 >>> 0;
        },
        topVisibleIdAt: (state) => (coord) => {
            const key = coordToKey(coord);
            for (let i = state._order.length - 1; i >= 0; i--) {
                const id = state._order[i];
                if (!state._visible[id]) continue;
                const set = state._pixels[id];
                if (set.has(key)) return id;
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
            this._name[id] = layerProperties.name || 'Layer';
            this._visible[id] = layerProperties.visible ?? true;
            this._locked[id] = layerProperties.locked ?? false;
            this._color[id] = (layerProperties.color ?? randColorU32()) >>> 0;
            const keyedPixels = layerProperties.pixels ? layerProperties.pixels.map(coordToKey) : [];
            this._pixels[id] = reactive(new Set(keyedPixels));
            if (above === null) {
                this._order.push(id);
            } else {
                const idx = this.indexOfLayer(above);
                (idx < 0) ? this._order.push(id) : this._order.splice(idx + 1, 0, id);
            }
            return id;
        },
        /** Update properties of a layer */
        updateProperties(id, props) {
            if (this._name[id] == null) return;
            const keys = Object.keys(props || {});
            if (this._locked[id] && !(keys.length === 1 && keys[0] === 'locked')) return;
            if (props.name !== undefined) this._name[id] = props.name;
            if (props.color !== undefined) this._color[id] = (props.color >>> 0);
            if (props.visible !== undefined) this._visible[id] = !!props.visible;
            if (props.locked !== undefined) this._locked[id] = !!props.locked;
            if (props.pixels !== undefined) {
                const keyedPixels = props.pixels.map(coordToKey);
                this._pixels[id] = reactive(new Set(keyedPixels));
            }
        },
        toggleVisibility(id) {
            if (this._name[id] == null) return;
            this._visible[id] = !this._visible[id];
        },
        toggleLock(id) {
            if (this._name[id] == null) return;
            this._locked[id] = !this._locked[id];
        },
        addPixels(id, pixels) {
            if (this._locked[id]) return;
            const set = this._pixels[id];
            for (const coord of pixels) set.add(coordToKey(coord));
        },
        removePixels(id, pixels) {
            if (this._locked[id]) return;
            const set = this._pixels[id];
            for (const coord of pixels) set.delete(coordToKey(coord));
        },
        togglePixel(id, coord) {
            if (this._locked[id]) return;
            const set = this._pixels[id];
            const key = coordToKey(coord);
            if (set.has(key)) set.delete(key);
            else set.add(key);
        },
        /** Remove layers by ids */
        deleteLayers(ids) {
            const idSet = new Set(ids);
            this._order = this._order.filter(id => !idSet.has(id));
            for (const id of idSet) {
                delete this._name[id];
                delete this._color[id];
                delete this._visible[id];
                delete this._locked[id];
                delete this._pixels[id];
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
                const set = this._pixels[id];
                return set.size === 0;
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
                    name: this._name[id],
                    visible: !!this._visible[id],
                    locked: !!this._locked[id],
                    color: (this._color[id] >>> 0),
                    pixels: [...this._pixels[id]].map(key => keyToCoord(key))
                }])),
                selection: [...this._selection]
            };
        },
        applySerialized(payload) {
            const order = payload?.order || [];
            const byId = payload?.byId || {};
            // reset
            this._order = [];
            this._name = {};
            this._color = {};
            this._visible = {};
            this._locked = {};
            this._pixels = {};
            // rebuild
            for (const idStr of order) {
                const id = +idStr;
                const info = byId[idStr] || byId[id];
                if (!info) continue;
                this._name[id] = info.name || 'Layer';
                this._visible[id] = !!info.visible;
                this._locked[id] = !!info.locked;
                this._color[id] = (info.color ?? randColorU32()) >>> 0;
                const keyedPixels = info.pixels ? info.pixels.map(coordToKey) : [];
                this._pixels[id] = reactive(new Set(keyedPixels));
                this._order.push(id);
            }
            this._selection = new Set(payload?.selection || []);
        }
    }
});
