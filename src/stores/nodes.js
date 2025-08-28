import { defineStore } from 'pinia';
import { reactive } from 'vue';
import { coordToKey, keyToCoord, pixelsToUnionPath, randColorU32, groupConnectedPixels } from '../utils';
import { useNodeTreeStore } from './nodeTree';

export const useNodeStore = defineStore('nodes', {
    state: () => ({
        _name: {},
        _color: {},
        _visibility: {},
        _locked: {},
        _pixels: {},
        _attributes: {}
    }),
    getters: {
        has: (state) => (id) => state._name[id] != null,
        pathOfLayer: (state) => (id) => {
            const set = state._pixels[id];
            if (!set) return pixelsToUnionPath([]);
            return pixelsToUnionPath([...set].map(keyToCoord));
        },
        disconnectedCountOfLayer: (state) => (id) => {
            const set = state._pixels[id];
            if (!set) return 0;
            return groupConnectedPixels([...set].map(keyToCoord)).length;
        },
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
                case 'pixels': {
                    const set = state._pixels[id];
                    return set ? [...set].map(keyToCoord) : undefined;
                }
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
                ...(state._pixels[id] ? { pixels: [...state._pixels[id]].map(keyToCoord) } : {}),
                attributes: state._attributes[id]?.map(a => ({ ...a })) || []
            });
            return (ids = []) => {
                if (Array.isArray(ids)) return ids.map(propsOf);
                return propsOf(ids);
            };
        },
        compositeColorAt: (state) => (coord) => {
            const key = coordToKey(coord);
            const order = useNodeTreeStore().layerIdsBottomToTop;
            for (let i = order.length - 1; i >= 0; i--) {
                const id = order[i];
                if (!state._visibility[id]) continue;
                const set = state._pixels[id];
                if (set.has(key)) return (state._color[id] >>> 0);
            }
            return 0x00000000 >>> 0;
        },
        topVisibleIdAt: (state) => (coord) => {
            const key = coordToKey(coord);
            const order = useNodeTreeStore().layerIdsBottomToTop;
            for (let i = order.length - 1; i >= 0; i--) {
                const id = order[i];
                if (!state._visibility[id]) continue;
                const set = state._pixels[id];
                if (set.has(key)) return id;
            }
            return null;
        }
    },
    actions: {
        _allocId() {
            let id = Date.now();
            const tree = useNodeTreeStore();
            while (tree.has(id) || this.has(id)) id++;
            return id;
        },
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
        createGroup(groupProperties = {}) {
            const id = this._allocId();
            this._name[id] = groupProperties.name || 'Group';
            this._visibility[id] = groupProperties.visibility ?? true;
            this._locked[id] = groupProperties.locked ?? false;
            this._color[id] = (groupProperties.color ?? randColorU32()) >>> 0;
            this._attributes[id] = reactive([]);
            return id;
        },
        update(id, props) {
            if (this._name[id] == null) return;
            if (props.name !== undefined) this._name[id] = props.name;
            if (props.visibility !== undefined) this._visibility[id] = !!props.visibility;
            if (props.locked !== undefined) this._locked[id] = !!props.locked;
            if (!this._locked[id] && props.color !== undefined) this._color[id] = (props.color >>> 0);
            if (!this._locked[id] && props.pixels !== undefined) {
                this._pixels[id] = reactive(new Set(props.pixels.map(coordToKey)));
            }
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
        addPixelsToLayer(id, pixels) {
            if (this._locked[id]) return;
            const set = this._pixels[id];
            for (const coord of pixels) set.add(coordToKey(coord));
        },
        removePixelsFromLayer(id, pixels) {
            if (this._locked[id]) return;
            const set = this._pixels[id];
            for (const coord of pixels) set.delete(coordToKey(coord));
        },
        togglePixelInLayer(id, coord) {
            if (this._locked[id]) return;
            const set = this._pixels[id];
            const key = coordToKey(coord);
            if (set.has(key)) set.delete(key);
            else set.add(key);
        },
        remove(ids) {
            const tree = useNodeTreeStore();
            const removed = tree.remove(ids);
            for (const id of removed) {
                delete this._name[id];
                delete this._color[id];
                delete this._visibility[id];
                delete this._locked[id];
                delete this._pixels[id];
                delete this._attributes[id];
            }
            return removed;
        },
        translateAllLayers(dx = 0, dy = 0) {
            dx |= 0; dy |= 0;
            if (dx === 0 && dy === 0) return;
            const order = useNodeTreeStore().layerIdsBottomToTop;
            for (const id of order) {
                const set = this._pixels[id];
                const moved = new Set();
                for (const key of set) {
                    const [x, y] = keyToCoord(key);
                    moved.add(coordToKey([x + dx, y + dy]));
                }
                this._pixels[id] = reactive(moved);
            }
        },
        deleteEmptyLayers() {
            const tree = useNodeTreeStore();
            const order = tree.layerIdsBottomToTop;
            const emptyIds = order.filter(id => {
                const set = this._pixels[id];
                return set.size === 0;
            });
            if (emptyIds.length) this.remove(emptyIds);
            return emptyIds;
        },
        serialize() {
            const tree = useNodeTreeStore();
            const allIds = tree.allNodeIds();
            return Object.fromEntries(allIds.map(id => {
                const entry = {
                    name: this._name[id],
                    visibility: !!this._visibility[id],
                    locked: !!this._locked[id],
                    color: (this._color[id] >>> 0),
                    attributes: this._attributes[id]?.map(a => ({ ...a })) || []
                };
                if (this._pixels[id]) entry.pixels = [...this._pixels[id]].map(key => keyToCoord(key));
                return [id, entry];
            }));
        },
        applySerialized(byId = {}) {
            this._name = {};
            this._color = {};
            this._visibility = {};
            this._locked = {};
            this._pixels = {};
            this._attributes = {};
            for (const id of Object.keys(byId)) {
                const info = byId[id];
                const numId = Number(id);
                this._name[numId] = info.name || 'Layer';
                this._visibility[numId] = !!info.visibility;
                this._locked[numId] = !!info.locked;
                this._color[numId] = (info.color ?? randColorU32()) >>> 0;
                if (Array.isArray(info.pixels)) {
                    const keyedPixels = info.pixels.map(coordToKey);
                    this._pixels[numId] = reactive(new Set(keyedPixels));
                }
                const attrs = info.attributes ? info.attributes.map(a => ({ ...a })) : [];
                this._attributes[numId] = reactive(attrs);
            }
        }
    }
});
