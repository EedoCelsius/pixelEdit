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
        _type: {},
        _children: {},
        _parent: {},
        _collapsed: {},
        _selection: new Set()
    }),
    getters: {
        exists: (state) => state._order.length > 0,
        order: (state) => readonly(state._order),
        has: (state) => (id) => state._name[id] != null || state._type[id] === 'group',
        count: (state) => state._order.length,
        idsBottomToTop: (state) => {
            const out = [];
            const traverse = ids => {
                for (const id of ids) {
                    if (state._type[id] === 'group') traverse(state._children[id] || []);
                    else out.push(id);
                }
            };
            traverse(state._order);
            return readonly(out);
        },
        idsTopToBottom() {
            return readonly([...this.idsBottomToTop].reverse());
        },
        indexOfLayer: (state) => (id) => {
            const parent = state._parent[id];
            const arr = parent == null ? state._order : (state._children[parent] || []);
            return arr.indexOf(id);
        },
        pathOf: (state) => (id) => pixelsToUnionPath([...state._pixels[id]].map(keyToCoord)),
        disconnectedCountOf: (state) => (id) => groupConnectedPixels([...state._pixels[id]].map(keyToCoord)).length,
        tree: (state) => {
            const build = ids => ids.map(id => ({ id, type: state._type[id] || 'layer', children: build(state._children[id] || []) }));
            return readonly(build(state._order));
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
                case 'pixels':
                    return [...state._pixels[id]].map(keyToCoord);
                case 'type':
                    return state._type[id] || 'layer';
                case 'children':
                    return (state._children[id] || []).slice();
                case 'collapsed':
                    return !!state._collapsed[id];
                case 'parent':
                    return state._parent[id] ?? null;
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
                type: state._type[id] || 'layer',
                collapsed: !!state._collapsed[id],
                children: (state._children[id] || []).slice(),
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
        /** Create a layer or group and insert relative to a reference id (above = on top of it). If refId null -> push on top */
        createLayer(layerProperties = {}, above = null, parent = null) {
            const id = this._allocId();
            const type = layerProperties.type === 'group' ? 'group' : 'layer';
            this._type[id] = type;
            this._name[id] = layerProperties.name || (type === 'group' ? 'Group' : 'Layer');
            this._visibility[id] = layerProperties.visibility ?? true;
            this._locked[id] = layerProperties.locked ?? false;
            this._color[id] = (layerProperties.color ?? randColorU32()) >>> 0;
            const keyedPixels = layerProperties.pixels ? layerProperties.pixels.map(coordToKey) : [];
            this._pixels[id] = reactive(new Set(keyedPixels));
            if (type === 'group') {
                this._children[id] = [];
                this._collapsed[id] = false;
            }
            this._parent[id] = parent ?? null;
            const siblings = parent == null ? this._order : (this._children[parent] ||= []);
            if (above === null) {
                siblings.push(id);
            } else {
                const arr = siblings;
                const idx = arr.indexOf(above);
                (idx < 0) ? arr.push(id) : arr.splice(idx + 1, 0, id);
            }
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
        },
        toggleVisibility(id) {
            if (!this.has(id)) return;
            const value = !this._visibility[id];
            const toggle = (tid) => {
                this._visibility[tid] = value;
                if (this._type[tid] === 'group')
                    for (const cid of this._children[tid] || []) toggle(cid);
            };
            toggle(id);
        },
        toggleLock(id) {
            if (!this.has(id)) return;
            const value = !this._locked[id];
            const toggle = (tid) => {
                this._locked[tid] = value;
                if (this._type[tid] === 'group')
                    for (const cid of this._children[tid] || []) toggle(cid);
            };
            toggle(id);
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
        /** Remove layers or groups by ids */
        deleteLayers(ids) {
            const removeRec = (id) => {
                if (this._type[id] === 'group') {
                    for (const cid of this._children[id] || []) removeRec(cid);
                    delete this._children[id];
                    delete this._collapsed[id];
                }
                delete this._name[id];
                delete this._color[id];
                delete this._visibility[id];
                delete this._locked[id];
                delete this._pixels[id];
                delete this._type[id];
                const parent = this._parent[id];
                if (parent == null) {
                    this._order = this._order.filter(v => v !== id);
                } else {
                    this._children[parent] = (this._children[parent] || []).filter(v => v !== id);
                }
                delete this._parent[id];
                this._selection.delete(id);
            };
            for (const id of ids) removeRec(id);
        },
        /** Reorder selected ids as a block relative to targetId within same parent. */
        reorderLayers(ids, targetId, placeBelow = true) {
            const selectionSet = new Set(ids);
            if (!selectionSet.size) return;
            const parent = targetId == null ? null : this._parent[targetId] ?? null;
            if ([...selectionSet].some(id => this._parent[id] ?? null !== parent)) return;
            const siblings = parent == null ? this._order : (this._children[parent] || []);
            const keptIds = siblings.filter(id => !selectionSet.has(id));
            let targetIndex = keptIds.indexOf(targetId);
            if (targetIndex < 0) targetIndex = keptIds.length;
            if (!placeBelow) targetIndex = targetIndex + 1;
            const selectionInStack = siblings.filter(id => selectionSet.has(id));
            keptIds.splice(targetIndex, 0, ...selectionInStack);
            if (parent == null) this._order = keptIds; else this._children[parent] = keptIds;
        },
        addToGroup(childId, groupId) {
            if (this._type[groupId] !== 'group') return;
            const oldParent = this._parent[childId];
            const oldSiblings = oldParent == null ? this._order : (this._children[oldParent] || []);
            const idx = oldSiblings.indexOf(childId);
            if (idx >= 0) oldSiblings.splice(idx, 1);
            (this._children[groupId] ||= []).push(childId);
            this._parent[childId] = groupId;
        },
        toggleCollapsed(id) {
            if (this._type[id] !== 'group') return;
            this._collapsed[id] = !this._collapsed[id];
        },
        deleteEmptyLayers() {
            const emptyIds = this.idsBottomToTop.filter(id => {
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
            const collect = (ids) => ids.map(id => ({
                id,
                type: this._type[id] || 'layer',
                name: this._name[id],
                visibility: !!this._visibility[id],
                locked: !!this._locked[id],
                color: (this._color[id] >>> 0),
                pixels: [...this._pixels[id]].map(key => keyToCoord(key)),
                collapsed: !!this._collapsed[id],
                children: collect(this._children[id] || [])
            }));
            return {
                tree: collect(this._order),
                selection: [...this._selection]
            };
        },
        applySerialized(payload) {
            const build = (nodes, parent = null) => {
                for (const node of nodes) {
                    const id = +node.id;
                    this._type[id] = node.type || 'layer';
                    this._name[id] = node.name || (node.type === 'group' ? 'Group' : 'Layer');
                    this._visibility[id] = !!node.visibility;
                    this._locked[id] = !!node.locked;
                    this._color[id] = (node.color ?? randColorU32()) >>> 0;
                    const keyedPixels = node.pixels ? node.pixels.map(coordToKey) : [];
                    this._pixels[id] = reactive(new Set(keyedPixels));
                    this._collapsed[id] = !!node.collapsed;
                    this._parent[id] = parent;
                    if (node.type === 'group') {
                        this._children[id] = [];
                        build(node.children || [], id);
                    }
                    const arr = parent == null ? this._order : this._children[parent];
                    arr.push(id);
                }
            };
            // reset
            this._order = [];
            this._name = {};
            this._color = {};
            this._visibility = {};
            this._locked = {};
            this._pixels = {};
            this._type = {};
            this._children = {};
            this._parent = {};
            this._collapsed = {};
            build(payload?.tree || []);
            this._selection = new Set(payload?.selection || []);
        }
    }
});
