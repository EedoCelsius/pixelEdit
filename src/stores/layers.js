import { defineStore } from 'pinia';
import { readonly, reactive } from 'vue';
import { coordToKey, keyToCoord, pixelsToUnionPath, randColorU32, groupConnectedPixels } from '../utils';

function flatten(order, children) {
    const result = [];
    const traverse = (arr) => {
        for (const id of arr) {
            if (id < 0) traverse(children[id] || []);
            else result.push(id);
        }
    };
    traverse(order);
    return result;
}

function isVisible(state, id) {
    if (!state._visibility[id]) return false;
    let gid = state._parent[id];
    while (gid != null) {
        if (!state._groupVisibility[gid]) return false;
        gid = state._parent[gid];
    }
    return true;
}

export const useLayerStore = defineStore('layers', {
    state: () => ({
        _order: [], // root stacking order (bottom -> top)
        _children: {}, // groupId -> child ids
        _groupName: {},
        _groupVisibility: {},
        _groupLocked: {},
        _groupExpanded: {},
        _parent: {}, // nodeId -> parent group id or null
        _name: {},
        _color: {},
        _visibility: {},
        _locked: {},
        _pixels: {},
        _selection: new Set()
    }),
    getters: {
        exists: (state) => state._order.length > 0,
        order: (state) => readonly(flatten(state._order, state._children)),
        has: (state) => (id) => state._name[id] != null,
        count: (state) => flatten(state._order, state._children).length,
        idsBottomToTop: (state) => readonly(flatten(state._order, state._children)),
        idsTopToBottom: (state) => readonly([...flatten(state._order, state._children)].reverse()),
        indexOfLayer: (state) => (id) => flatten(state._order, state._children).indexOf(id),
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
            const order = flatten(state._order, state._children);
            for (let i = order.length - 1; i >= 0; i--) {
                const id = order[i];
                if (!isVisible(state, id)) continue;
                const set = state._pixels[id];
                if (set.has(key)) return (state._color[id] >>> 0);
            }
            return 0x00000000 >>> 0;
        },
        topVisibleIdAt: (state) => (coord) => {
            const key = coordToKey(coord);
            const order = flatten(state._order, state._children);
            for (let i = order.length - 1; i >= 0; i--) {
                const id = order[i];
                if (!isVisible(state, id)) continue;
                const set = state._pixels[id];
                if (set.has(key)) return id;
            }
            return null;
        },
        tree: (state) => {
            const build = (list) => list.map(id => {
                if (id < 0) {
                    return {
                        id,
                        type: 'group',
                        name: state._groupName[id],
                        visibility: !!state._groupVisibility[id],
                        locked: !!state._groupLocked[id],
                        expanded: !!state._groupExpanded[id],
                        children: build(state._children[id] || [])
                    };
                }
                return {
                    id,
                    type: 'layer',
                    name: state._name[id],
                    color: (state._color[id] >>> 0),
                    visibility: !!state._visibility[id],
                    locked: !!state._locked[id],
                    pixels: [...state._pixels[id]].map(keyToCoord)
                };
            });
            return readonly(build(state._order));
        }
    },
    actions: {
        _isParentLocked(id) {
            let gid = this._parent[id];
            while (gid != null) {
                if (this._groupLocked[gid]) return true;
                gid = this._parent[gid];
            }
            return false;
        },
        _allocId() {
            let id = Date.now();
            while (this._name[id] != null || this._groupName[id] != null) id++;
            return id;
        },
        _allocGroupId() {
            let id = -1;
            while (this._groupName[id] != null || this._name[id] != null) id--;
            return id;
        },
        /** Create a layer and insert relative to a reference id (above = on top of it). If refId null -> push on top */
        createLayer(layerProperties = {}, above = null, parent = null) {
            const id = this._allocId();
            this._name[id] = layerProperties.name || 'Layer';
            this._visibility[id] = layerProperties.visibility ?? true;
            this._locked[id] = layerProperties.locked ?? false;
            this._color[id] = (layerProperties.color ?? randColorU32()) >>> 0;
            const keyedPixels = layerProperties.pixels ? layerProperties.pixels.map(coordToKey) : [];
            this._pixels[id] = reactive(new Set(keyedPixels));
            const parentList = parent == null ? this._order : (this._children[parent] ||= []);
            if (above == null) parentList.push(id);
            else {
                const arr = parentList;
                const idx = arr.indexOf(above);
                (idx < 0) ? arr.push(id) : arr.splice(idx + 1, 0, id);
            }
            this._parent[id] = parent;
            return id;
        },
        createGroup(name = 'Group', above = null, parent = null) {
            const id = this._allocGroupId();
            this._groupName[id] = name;
            this._groupVisibility[id] = true;
            this._groupLocked[id] = false;
            this._groupExpanded[id] = true;
            this._children[id] = [];
            const parentList = parent == null ? this._order : (this._children[parent] ||= []);
            if (above == null) parentList.push(id);
            else {
                const arr = parentList;
                const idx = arr.indexOf(above);
                (idx < 0) ? arr.push(id) : arr.splice(idx + 1, 0, id);
            }
            this._parent[id] = parent;
            return id;
        },
        /** Update properties of a layer */
        updateProperties(id, props) {
            if (this._name[id] == null) return;
            if (this._isParentLocked(id)) return;
            if (props.name !== undefined) this._name[id] = props.name;
            if (props.visibility !== undefined) this._visibility[id] = !!props.visibility;
            if (props.locked !== undefined) this._locked[id] = !!props.locked;
            if (!this._locked[id] && props.color !== undefined) this._color[id] = (props.color >>> 0);
            if (!this._locked[id] && props.pixels !== undefined) this._pixels[id] = new Set(props.pixels.map(coordToKey));
        },
        toggleVisibility(id) {
            if (this._name[id] == null) return;
            if (this._isParentLocked(id)) return;
            this._visibility[id] = !this._visibility[id];
        },
        toggleLock(id) {
            if (this._name[id] == null) return;
            if (this._isParentLocked(id)) return;
            this._locked[id] = !this._locked[id];
        },
        toggleGroupVisibility(id) {
            if (this._groupName[id] == null) return;
            this._groupVisibility[id] = !this._groupVisibility[id];
        },
        toggleGroupLock(id) {
            if (this._groupName[id] == null) return;
            this._groupLocked[id] = !this._groupLocked[id];
        },
        toggleGroupExpanded(id) {
            if (this._groupName[id] == null) return;
            this._groupExpanded[id] = !this._groupExpanded[id];
        },
        addPixels(id, pixels) {
            if (this._locked[id] || this._isParentLocked(id)) return;
            const set = this._pixels[id];
            for (const coord of pixels) set.add(coordToKey(coord));
        },
        removePixels(id, pixels) {
            if (this._locked[id] || this._isParentLocked(id)) return;
            const set = this._pixels[id];
            for (const coord of pixels) set.delete(coordToKey(coord));
        },
        togglePixel(id, coord) {
            if (this._locked[id] || this._isParentLocked(id)) return;
            const set = this._pixels[id];
            const key = coordToKey(coord);
            if (set.has(key)) set.delete(key);
            else set.add(key);
        },
        /** Remove layers by ids */
        deleteLayers(ids) {
            const idSet = new Set(ids);
            const removeFrom = (list) => {
                for (let i = list.length - 1; i >= 0; i--) {
                    const id = list[i];
                    if (idSet.has(id)) list.splice(i, 1);
                    else if (id < 0) removeFrom(this._children[id]);
                }
            };
            removeFrom(this._order);
            for (const id of idSet) {
                delete this._name[id];
                delete this._color[id];
                delete this._visibility[id];
                delete this._locked[id];
                delete this._pixels[id];
                delete this._parent[id];
            }
        },
        /** Reorder selected ids (layers or groups) relative to targetId. */
        reorderNodes(ids, targetId, placeBelow = true) {
            const selectionSet = new Set(ids);
            if (!selectionSet.size) return;
            // collect selection in tree order
            const ordered = [];
            const collect = (list) => {
                for (const id of list) {
                    if (selectionSet.has(id)) ordered.push(id);
                    else if (id < 0) collect(this._children[id]);
                }
            };
            collect(this._order);
            const parent = this._parent[targetId] ?? null;
            const targetList = parent == null ? this._order : this._children[parent];
            // remove ids from their current parent lists
            for (const id of ordered) {
                const p = this._parent[id] ?? null;
                const arr = p == null ? this._order : this._children[p];
                const idx = arr.indexOf(id);
                if (idx >= 0) arr.splice(idx, 1);
            }
            let targetIndex = targetList.indexOf(targetId);
            if (targetIndex < 0) targetIndex = targetList.length;
            if (!placeBelow) targetIndex = targetIndex + 1;
            targetList.splice(targetIndex, 0, ...ordered);
            for (const id of ordered) this._parent[id] = parent;
        },
        deleteEmptyLayers() {
            const emptyIds = flatten(this._order, this._children).filter(id => {
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
            const build = (list) => list.map(id => {
                if (id < 0) {
                    return {
                        id,
                        type: 'group',
                        name: this._groupName[id],
                        visibility: !!this._groupVisibility[id],
                        locked: !!this._groupLocked[id],
                        expanded: !!this._groupExpanded[id],
                        children: build(this._children[id] || [])
                    };
                }
                return id;
            });
            const byId = Object.fromEntries(flatten(this._order, this._children).map(id => [id, {
                name: this._name[id],
                visibility: !!this._visibility[id],
                locked: !!this._locked[id],
                color: (this._color[id] >>> 0),
                pixels: [...this._pixels[id]].map(key => keyToCoord(key))
            }]));
            return {
                tree: build(this._order),
                byId,
                selection: [...this._selection]
            };
        },
        applySerialized(payload) {
            const tree = payload?.tree || [];
            const byId = payload?.byId || {};
            // reset
            this._order = [];
            this._children = {};
            this._groupName = {};
            this._groupVisibility = {};
            this._groupLocked = {};
            this._groupExpanded = {};
            this._parent = {};
            this._name = {};
            this._color = {};
            this._visibility = {};
            this._locked = {};
            this._pixels = {};
            const rebuild = (list, parent = null) => {
                for (const node of list) {
                    if (typeof node === 'object') {
                        const id = node.id;
                        this._groupName[id] = node.name || 'Group';
                        this._groupVisibility[id] = !!node.visibility;
                        this._groupLocked[id] = !!node.locked;
                        this._groupExpanded[id] = !!node.expanded;
                        this._children[id] = [];
                        const arr = parent == null ? this._order : (this._children[parent] ||= []);
                        arr.push(id);
                        this._parent[id] = parent;
                        rebuild(node.children || [], id);
                    } else {
                        const id = +node;
                        const info = byId[node] || byId[id];
                        if (!info) continue;
                        this._name[id] = info.name || 'Layer';
                        this._visibility[id] = !!info.visibility;
                        this._locked[id] = !!info.locked;
                        this._color[id] = (info.color ?? randColorU32()) >>> 0;
                        const keyedPixels = info.pixels ? info.pixels.map(coordToKey) : [];
                        this._pixels[id] = reactive(new Set(keyedPixels));
                        const arr = parent == null ? this._order : (this._children[parent] ||= []);
                        arr.push(id);
                        this._parent[id] = parent;
                    }
                }
            };
            rebuild(tree, null);
            this._selection = new Set(payload?.selection || []);
        }
    }
});
