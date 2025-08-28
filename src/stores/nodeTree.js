import { defineStore } from 'pinia';
import { readonly, reactive } from 'vue';

function flatten(nodes, result = []) {
    for (const node of nodes) {
        if (node.children) flatten(node.children, result);
        else result.push(node.id);
    }
    return result;
}

function flattenAll(nodes, result = []) {
    for (const node of nodes) {
        result.push(node.id);
        if (node.children) flattenAll(node.children, result);
    }
    return result;
}

function buildTree(nodes) {
    return nodes.map(n => n.children
        ? { id: n.id, children: reactive(buildTree(n.children)) }
        : { id: n.id });
}

function cloneTree(nodes) {
    return nodes.map(n => n.children
        ? { id: n.id, children: cloneTree(n.children) }
        : { id: n.id });
}

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

function pathTo(nodes, id, stack = []) {
    for (const node of nodes) {
        stack.push(node);
        if (node.id === id) return [...stack];
        if (node.children) {
            const res = pathTo(node.children, id, stack);
            if (res) return res;
        }
        stack.pop();
    }
    return null;
}

function collectLayerIds(node, result = []) {
    if (!node) return result;
    if (node.children) {
        for (const child of node.children) collectLayerIds(child, result);
    } else {
        if (Array.isArray(result)) result.push(node.id);
        else result.add(node.id);
    }
    return result;
}

function flattenSelection(tree, selection) {
    const result = new Set();
    for (const id of selection) {
        const info = findNode(tree, id);
        if (info) collectLayerIds(info.node, result);
    }
    return [...result];
}

export const useNodeTreeStore = defineStore('nodeTree', {
    state: () => ({
        _tree: reactive([]),
        _selection: new Set()
    }),
    getters: {
        exists: (state) => flattenAll(state._tree).length > 0,
        layerOrder: (state) => readonly(flatten(state._tree)),
        tree: (state) => readonly(state._tree),
        has: (state) => (id) => findNode(state._tree, id) != null,
        layerCount: (state) => flatten(state._tree).length,
        layerIdsBottomToTop: (state) => readonly(flatten(state._tree)),
        layerIdsTopToBottom: (state) => readonly([...flatten(state._tree)].reverse()),
        indexOfLayer: (state) => (id) => flatten(state._tree).indexOf(id),
        selectedLayerIds: (state) => flattenSelection(state._tree, state._selection),
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
        selectedLayerCount: (state) => flattenSelection(state._tree, state._selection).length,
        layerSelectionExists: (state) => flattenSelection(state._tree, state._selection).length > 0,
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
        allNodeIds: (state) => flattenAll(state._tree)
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
        insert(ids, targetId, placeBelow = true) {
            const nodes = ids.map(id => this._removeFromTree(id) || { id });
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
        putIn(ids, groupId, placeTop = true) {
            const nodes = ids.map(id => this._removeFromTree(id) || { id });
            let targetArr = this._tree;
            if (groupId != null) {
                const info = this._findNode(groupId);
                if (info && info.node.children) targetArr = info.node.children;
            }
            const index = placeTop ? 0 : targetArr.length;
            targetArr.splice(index, 0, ...nodes);
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
                    if (node.children) traverse(node.children, ancestorSelected || selected);
                }
            };
            traverse(this._tree, false);
        },
        _deselect(id) {
            if (this._selection.delete(id)) return;
            const ancestor = this._selectedAncestor(id);
            if (!ancestor) return;
            const path = pathTo(this._tree, id);
            if (!path) return;
            const start = path.findIndex(n => n.id === ancestor.id);
            if (start === -1) return;
            for (const node of path.slice(start, -1)) {
                if (node.children) {
                    for (const child of node.children) this._selection.add(child.id);
                }
            }
            this._selection.delete(ancestor.id);
            this._selection.delete(id);
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
        remove(ids) {
            const removed = [];
            const collectIds = (node) => {
                removed.push(node.id);
                if (node.children) {
                    for (const child of node.children) collectIds(child);
                }
            };
            for (const id of ids) {
                const node = this._removeFromTree(id);
                if (node) collectIds(node);
            }
            return removed;
        },
        serialize() {
            return {
                tree: cloneTree(this._tree),
                selection: [...this._selection]
            };
        },
        applySerialized(payload) {
            const treePayload = payload?.tree;
            const orderPayload = payload?.order;
            if (Array.isArray(treePayload)) this._tree = reactive(buildTree(treePayload));
            else if (Array.isArray(orderPayload)) this._tree = reactive(orderPayload.map(id => ({ id }))); 
            else this._tree = reactive([]);
            this._selection = new Set(payload?.selection || []);
        }
    }
});
