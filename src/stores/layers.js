import { defineStore } from 'pinia';
import { readonly, reactive } from 'vue';
import { coordToKey, keyToCoord, pixelsToUnionPath, randColorU32, groupConnectedPixels } from '../utils';

export const useLayerStore = defineStore('layers', {
    state: () => ({
        _order: [],
        _name: {},
        _color: {},
        _visibility: {},
        _locked: {},
        _pixels: {},
        _attributes: {},
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
                case 'visibility':
                    return !!state._visibility[id];
                case 'locked':
                    return !!state._locked[id];
                case 'pixels':
                    return [...state._pixels[id]].map(keyToCoord);
                case 'attributes':
                    return state._attributes[id]?.map(a => ({ ...a })) || [];
                default:
                    return undefined;
            }
        },
        getProperties: (state) => {
            const propsOf = (id) => ({
                id,
                name: state._name[id],
                color: (state._color[id] >>> 0),
                visibility: !!state._visibility[id],
                locked: !!state._locked[id],
                pixels: [...state._pixels[id]].map(keyToCoord),
                attributes: state._attributes[id]?.map(a => ({ ...a })) || []
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
                if (!state._visibility[id]) continue;
                const set = state._pixels[id];
                if (set.has(key)) return (state._color[id] >>> 0);
            }
            return 0x00000000 >>> 0;
        },
        topVisibleIdAt: (state) => (coord) => {
            const key = coordToKey(coord);
            for (let i = state._order.length - 1; i >= 0; i--) {
                const id = state._order[i];
                if (!state._visibility[id]) continue;
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
        /** Create a layer and return its id. Use insertLayers to place it in order. */
        createLayer(layerProperties = {}) {
            const id = this._allocId();
            this._name[id] = layerProperties.name || 'Layer';
            this._visibility[id] = layerProperties.visibility ?? true;
            this._locked[id] = layerProperties.locked ?? false;
            this._color[id] = (layerProperties.color ?? randColorU32()) >>> 0;
            const keyedPixels = layerProperties.pixels ? layerProperties.pixels.map(coordToKey) : [];
            this._pixels[id] = reactive(new Set(keyedPixels));
            const attrs = layerProperties.attributes ? layerProperties.attributes.map(a => ({ ...a })) : [];
            this._attributes[id] = reactive(attrs);
            return id;
        },
        /** Update properties of a layer */
        updateProperties(id, props) {
            if (this._name[id] == null) return;
            if (props.name !== undefined) this._name[id] = props.name;
            if (props.visibility !== undefined) this._visibility[id] = !!props.visibility;
            if (props.locked !== undefined) this._locked[id] = !!props.locked;
            if (!this._locked[id] && props.color !== undefined) this._color[id] = (props.color >>> 0);
            if (!this._locked[id] && props.pixels !== undefined) this._pixels[id] = new Set(props.pixels.map(coordToKey));
            if (props.attributes !== undefined) {
                const attrs = Array.isArray(props.attributes) ? props.attributes.map(a => ({ ...a })) : [];
                this._attributes[id] = reactive(attrs);
            }
        },
        toggleVisibility(id) {
            if (this._name[id] == null) return;
            this._visibility[id] = !this._visibility[id];
        },
        toggleLock(id) {
            if (this._name[id] == null) return;
            this._locked[id] = !this._locked[id];
        },
        setAttribute(id, name, value) {
            if (this._name[id] == null) return;
            if (!this._attributes[id]) this._attributes[id] = reactive([]);
            const attrs = this._attributes[id];
            const found = attrs.find(a => a.name === name);
            if (found) found.value = value;
            else attrs.push({ name, value });
        },
        removeAttribute(id, name) {
            const attrs = this._attributes[id];
            if (!attrs) return;
            const index = attrs.findIndex(a => a.name === name);
            if (index >= 0) attrs.splice(index, 1);
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
                delete this._visibility[id];
                delete this._locked[id];
                delete this._pixels[id];
                delete this._attributes[id];
            }
        },
        /** Insert given ids relative to targetId. Works for existing or new layers. */
        insertLayers(ids, targetId, placeBelow = true) {
            const idSet = new Set(ids);
            const keptIds = this._order.filter(id => !idSet.has(id));
            let targetIndex = keptIds.indexOf(targetId);
            if (targetIndex < 0) targetIndex = keptIds.length;
            if (!placeBelow) targetIndex = targetIndex + 1;
            const inStack = this._order.filter(id => idSet.has(id));
            const notInStack = ids.filter(id => !inStack.includes(id));
            keptIds.splice(targetIndex, 0, ...inStack, ...notInStack);
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
        translateAll(dx = 0, dy = 0) {
            dx |= 0; dy |= 0;
            if (dx === 0 && dy === 0) return;
            for (const id of this._order) {
                const set = this._pixels[id];
                const moved = new Set();
                for (const key of set) {
                    const [x, y] = keyToCoord(key);
                    moved.add(coordToKey([x + dx, y + dy]));
                }
                this._pixels[id] = reactive(moved);
            }
        },
        /** Serialization */
        serialize() {
            return {
                order: this._order.slice(),
                byId: Object.fromEntries(this._order.map(id => [id, {
                    name: this._name[id],
                    visibility: !!this._visibility[id],
                    locked: !!this._locked[id],
                    color: (this._color[id] >>> 0),
                    pixels: [...this._pixels[id]].map(key => keyToCoord(key)),
                    attributes: this._attributes[id]?.map(a => ({ ...a })) || []
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
            this._visibility = {};
            this._locked = {};
            this._pixels = {};
            this._attributes = {};
            // rebuild
            for (const idStr of order) {
                const id = +idStr;
                const info = byId[idStr] || byId[id];
                if (!info) continue;
                this._name[id] = info.name || 'Layer';
                this._visibility[id] = !!info.visibility;
                this._locked[id] = !!info.locked;
                this._color[id] = (info.color ?? randColorU32()) >>> 0;
                const keyedPixels = info.pixels ? info.pixels.map(coordToKey) : [];
                this._pixels[id] = reactive(new Set(keyedPixels));
                const attrs = info.attributes ? info.attributes.map(a => ({ ...a })) : [];
                this._attributes[id] = reactive(attrs);
                this._order.push(id);
            }
            this._selection = new Set(payload?.selection || []);
        }
    }
});
