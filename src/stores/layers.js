import { defineStore } from 'pinia';
import { readonly, reactive } from 'vue';
import { coordToKey, keyToCoord, pixelsToUnionPath, randColorU32, groupConnectedPixels } from '../utils';

/**
 * Helper: flatten tree nodes to layer id list.
 */
function flatten(nodes, result = []) {
    for (const node of nodes) {
        if (node.children) flatten(node.children, result);
        else result.push(node.id);
    }
    return result;
}

/** Build reactive tree from serialized plain object */
function buildTree(nodes) {
    return nodes.map(n => n.children
        ? { id: n.id, children: reactive(buildTree(n.children)) }
        : { id: n.id });
}

/** Deep clone tree for serialization */
function cloneTree(nodes) {
    return nodes.map(n => n.children
        ? { id: n.id, children: cloneTree(n.children) }
        : { id: n.id });
}

/** Locate node with id and its parent */
function findNode(nodes, id, parent = null) {
    for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        if (node.id === id) return { node, parent, index: i };
        if (node.children) {
            const res = findNode(node.children, id, node);
            if (res) return res;
        }
    }
    return null;
}

/** Collect all layer ids within a node (recursively) */
function collectLayerIds(node, result = []) {
    if (!node) return result;
    if (node.children) {
        for (const child of node.children) collectLayerIds(child, result);
    } else {
        // Support both array and Set results
        if (Array.isArray(result)) result.push(node.id);
        else result.add(node.id);
    }
    return result;
}

/**
 * Flatten selection that may contain groups into a list of layer ids
 */
function flattenSelection(tree, selection) {
    const result = new Set();
    for (const id of selection) {
        const info = findNode(tree, id);
        if (info) collectLayerIds(info.node, result);
    }
    return [...result];
}

export const useLayerStore = defineStore('layers', {
    state: () => ({
        _tree: reactive([]),
        _name: {},
        _color: {},
        _visibility: {},
        _locked: {},
        _pixels: {},
        _attributes: {},
        _selection: new Set(),
        _isGroup: {}
    }),
    getters: {
        exists: (state) => flatten(state._tree).length > 0,
        order: (state) => readonly(flatten(state._tree)),
        tree: (state) => readonly(state._tree),
        has: (state) => (id) => state._name[id] != null,
        count: (state) => flatten(state._tree).length,
        idsBottomToTop: (state) => readonly(flatten(state._tree)),
        idsTopToBottom: (state) => readonly([...flatten(state._tree)].reverse()),
        indexOfLayer: (state) => (id) => flatten(state._tree).indexOf(id),
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
        selectedIds: (state) => flattenSelection(state._tree, state._selection),
        selectedNodeIds: (state) => {
            const set = state._selection;
            const result = [];
            const walk = (nodes) => {
                for (const n of nodes) {
                    if (set.has(n.id)) result.push(n.id);
                    if (n.children) walk(n.children);
                }
            };
            walk(state._tree);
            return result;
        },
        selectionCount: (state) => flattenSelection(state._tree, state._selection).length,
        selectionExists: (state) => flattenSelection(state._tree, state._selection).length > 0,
        isSelected: (state) => (id) => {
            if (state._selection.has(id)) return true;
            const info = findNode(state._tree, id);
            let parent = info?.parent;
            while (parent) {
                if (state._selection.has(parent.id)) return true;
                parent = findNode(state._tree, parent.id)?.parent;
            }
            return false;
        },
        compositeColorAt: (state) => (coord) => {
            const key = coordToKey(coord);
            const order = flatten(state._tree);
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
            const order = flatten(state._tree);
            for (let i = order.length - 1; i >= 0; i--) {
                const id = order[i];
                if (!state._visibility[id]) continue;
                const set = state._pixels[id];
                if (set.has(key)) return id;
            }
            return null;
        },
    },
    actions: {
        _findNode(id) {
            return findNode(this._tree, id);
        },
        _removeFromTree(id) {
            const info = findNode(this._tree, id);
            if (!info) return null;
            const parentArr = info.parent ? info.parent.children : this._tree;
            return parentArr.splice(info.index, 1)[0];
        },
        _allocId() {
            let id = Date.now();
            while (this.has(id)) id++;
            return id;
        },
        /** Create a layer and return its id. Use insert to place it in order. */
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
            this._isGroup[id] = false;
            return id;
        },
        /** Create an empty group and return its id. Use insert/putIn to place it. */
        createGroup(groupProperties = {}) {
            const id = this._allocId();
            this._name[id] = groupProperties.name || 'Group';
            this._visibility[id] = groupProperties.visibility ?? true;
            this._locked[id] = groupProperties.locked ?? false;
            this._color[id] = (groupProperties.color ?? randColorU32()) >>> 0;
            this._pixels[id] = reactive(new Set());
            this._attributes[id] = reactive([]);
            this._isGroup[id] = true;
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
        /** Remove layers or groups by ids */
        deleteLayers(ids) {
            const removed = [];
            for (const id of ids) {
                const node = this._removeFromTree(id);
                if (node) collectLayerIds(node, removed);
            }
            const idSet = new Set(removed);
            for (const id of idSet) {
                delete this._name[id];
                delete this._color[id];
                delete this._visibility[id];
                delete this._locked[id];
                delete this._pixels[id];
                delete this._attributes[id];
                delete this._isGroup[id];
            }
        },
        /**
         * Insert given ids relative to targetId within the same group.
         * ids can include layers or groups. Existing nodes are moved.
         */
        insert(ids, targetId, placeBelow = true) {
            const nodes = ids.map(id => this._removeFromTree(id) || (this._isGroup[id] ? { id, children: reactive([]) } : { id }));
            const targetInfo = targetId != null ? this._findNode(targetId) : null;
            let parentArr = this._tree;
            let index = parentArr.length;
            if (targetInfo) {
                parentArr = targetInfo.parent ? targetInfo.parent.children : this._tree;
                index = targetInfo.index;
                if (!placeBelow) index++;
            }
            parentArr.splice(index, 0, ...nodes);
        },
        /**
         * Move ids into the specified group at top or bottom.
         * groupId null refers to root.
         */
        putIn(ids, groupId, placeTop = true) {
            const nodes = ids.map(id => this._removeFromTree(id) || (this._isGroup[id] ? { id, children: reactive([]) } : { id }));
            let targetArr = this._tree;
            if (groupId != null) {
                const info = this._findNode(groupId);
                if (info && info.node.children) targetArr = info.node.children;
            }
            const index = placeTop ? 0 : targetArr.length;
            targetArr.splice(index, 0, ...nodes);
        },
        deleteEmptyLayers() {
            const order = flatten(this._tree);
            const emptyIds = order.filter(id => {
                const set = this._pixels[id];
                return set.size === 0;
            });
            if (emptyIds.length) this.deleteLayers(emptyIds);
            return emptyIds;
        },
        _selectedAncestor(id) {
            let info = this._findNode(id);
            let parent = info?.parent;
            while (parent) {
                if (this._selection.has(parent.id)) return parent;
                parent = this._findNode(parent.id)?.parent;
            }
            return null;
        },
        _collapseSelection() {
            const traverse = (nodes, ancestorSelected) => {
                for (const node of nodes) {
                    const selected = this._selection.has(node.id);
                    if (ancestorSelected && selected) this._selection.delete(node.id);
                    if (node.children) {
                        traverse(node.children, ancestorSelected || selected);
                        if (node.children.every(ch => this._selection.has(ch.id))) {
                            for (const ch of node.children) this._selection.delete(ch.id);
                            this._selection.add(node.id);
                        }
                    }
                }
            };
            traverse(this._tree, false);
        },
        _deselect(id) {
            if (this._selection.delete(id)) return;
            const ancestor = this._selectedAncestor(id);
            if (!ancestor) return;
            this._selection.delete(ancestor.id);
            for (const child of ancestor.children) this._selection.add(child.id);
            this._deselect(id);
        },
        replaceSelection(ids = []) {
            this._selection = new Set(ids);
            this._collapseSelection();
        },
        addToSelection(ids = []) {
            for (const id of ids) {
                if (!this._selectedAncestor(id)) this._selection.add(id);
            }
            this._collapseSelection();
        },
        removeFromSelection(ids = []) {
            for (const id of ids) this._deselect(id);
            this._collapseSelection();
        },
        toggleSelection(id) {
            if (id == null) return;
            if (this.isSelected(id)) this.removeFromSelection([id]);
            else this.addToSelection([id]);
        },
        clearSelection() {
            this._selection.clear();
        },
        translateAll(dx = 0, dy = 0) {
            dx |= 0; dy |= 0;
            if (dx === 0 && dy === 0) return;
            const order = flatten(this._tree);
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
        /** Serialization */
        serialize() {
            const order = flatten(this._tree);
            return {
                tree: cloneTree(this._tree),
                byId: Object.fromEntries(order.map(id => [id, {
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
            const treePayload = payload?.tree;
            const orderPayload = payload?.order;
            const byId = payload?.byId || {};
            // reset
            this._tree = reactive([]);
            this._name = {};
            this._color = {};
            this._visibility = {};
            this._locked = {};
            this._pixels = {};
            this._attributes = {};
            this._isGroup = {};
            // rebuild tree
            if (Array.isArray(treePayload)) this._tree = reactive(buildTree(treePayload));
            else if (Array.isArray(orderPayload)) this._tree = reactive(orderPayload.map(id => ({ id })));
            // rebuild layer info
            const order = flatten(this._tree);
            for (const id of order) {
                const info = byId[id] || byId[id.toString()];
                if (!info) continue;
                this._name[id] = info.name || 'Layer';
                this._visibility[id] = !!info.visibility;
                this._locked[id] = !!info.locked;
                this._color[id] = (info.color ?? randColorU32()) >>> 0;
                const keyedPixels = info.pixels ? info.pixels.map(coordToKey) : [];
                this._pixels[id] = reactive(new Set(keyedPixels));
                const attrs = info.attributes ? info.attributes.map(a => ({ ...a })) : [];
                this._attributes[id] = reactive(attrs);
                this._isGroup[id] = false;
            }
            const markGroups = (nodes) => {
                for (const n of nodes) {
                    if (n.children) {
                        this._isGroup[n.id] = true;
                        markGroups(n.children);
                    }
                }
            };
            markGroups(this._tree);
            this._selection = new Set(payload?.selection || []);
        }
    }
});
