import { defineStore } from 'pinia';
import { readonly, reactive } from 'vue';
import { useNodeStore } from './nodes.js';
import { mixHash } from '../utils/hash.js';

function flattenLayers(nodes, result = [], nodeStore = useNodeStore()) {
    for (const node of nodes) {
        if (node.children) flattenLayers(node.children, result, nodeStore);
        else if (!nodeStore.isGroup(node.id)) result.push(node.id);
    }
    return result;
}

function flattenNode(nodes, result = []) {
    for (const node of nodes) {
        result.push(node.id);
        if (node.children) flattenNode(node.children, result);
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

function collectLayerIds(node, result = [], nodeStore = useNodeStore()) {
    if (!node) return result;
    if (nodeStore.isGroup(node.id)) {
        if (node.children) {
            for (const child of node.children) collectLayerIds(child, result, nodeStore);
        }
    } else {
        if (Array.isArray(result)) result.push(node.id);
        else result.add(node.id);
    }
    return result;
}

function flattenSelectedNode(tree, selection) {
    const result = [];
    for (const id of selection) {
        const info = findNode(tree, id);
        if (info) flattenNode([info.node], result);
    }
    return result;
}

function flattenSelectedLayers(tree, selection) {
    const result = new Set();
    for (const id of selection) {
        const info = findNode(tree, id);
        if (info) collectLayerIds(info.node, result);
    }
    return [...result];
}

function createHashNode(store, node) {
    let hashNode;
    if (node.children && node.children.length) {
        const children = node.children.map(child => createHashNode(store, child));
        let h = node.id;
        for (const c of children) h = mixHash(h, c.hash);
        hashNode = { hash: h, children };
    } else {
        hashNode = { hash: node.id };
    }
    store._hashNodes[node.id] = hashNode;
    return hashNode;
}

function deleteHashNode(store, node) {
    delete store._hashNodes[node.id];
    if (node.children) {
        for (const child of node.children) deleteHashNode(store, child);
    }
}

function rehashUpFrom(store, id) {
    if (id != null) {
        const path = pathTo(store._tree, id);
        if (path) {
            for (let i = path.length - 1; i >= 0; i--) {
                const tNode = path[i];
                const hNode = store._hashNodes[tNode.id];
                if (tNode.children && tNode.children.length) {
                    hNode.children = tNode.children.map(ch => store._hashNodes[ch.id]);
                    let h = tNode.id;
                    for (const ch of hNode.children) h = mixHash(h, ch.hash);
                    hNode.hash = h;
                } else {
                    delete hNode.children;
                    hNode.hash = tNode.id;
                }
            }
        }
    }
    const rootChildren = store._tree.map(n => store._hashNodes[n.id]);
    store._hash.tree.children = rootChildren;
    let rootHash = 0;
    for (const child of rootChildren) rootHash = mixHash(rootHash, child.hash);
    store._hash.tree.hash = rootHash;
}

function rebuildHashTree(store) {
    store._hashNodes = {};
    const children = store._tree.map(node => createHashNode(store, node));
    let rootHash = 0;
    for (const child of children) rootHash = mixHash(rootHash, child.hash);
    store._hash.tree = { hash: rootHash, children };
}

export const useNodeTreeStore = defineStore('nodeTree', {
    state: () => ({
        _tree: [],
        _selection: new Set(),
        _hash: { tree: { hash: 0, children: [] }, selection: 0 },
        _hashNodes: {}
    }),
    getters: {
        _layerIds: (state) => flattenLayers(state._tree),
        _nodeIds: (state) => flattenNode(state._tree),
        _selectedLayerIds: (state) => flattenSelectedLayers(state._tree, state._selection),
        _selectedNodeIds: (state) => flattenSelectedNode(state._tree, state._selection),
        _selectedNodeIdSet(state) { return new Set(this._selectedNodeIds) },
        tree(state) { return readonly(state._tree) },
        selectedIds(state) { return [...state._selection] },
        orderedSelection(state) {
            const index = new Map(this._nodeIds.map((id, idx) => [id, idx]));
            return [...state._selection].sort((a, b) => index.get(a) - index.get(b));
        },
        exists(state) { return this._nodeIds.length > 0 },
        has(state) { return (id) => findNode(state._tree, id) != null },
        layerOrder(state) { return readonly(this._layerIds) },
        layerCount(state) { return this._layerIds.length },
        layerIdsBottomToTop(state) { return readonly(this._layerIds) },
        layerIdsTopToBottom(state) { return readonly([...this._layerIds].reverse()) },
        indexOfLayer(state) { return (id) => this._layerIds.indexOf(id) },
        selectedLayerIds(state) { return this._selectedLayerIds },
        selectedLayerCount(state) { return this._selectedLayerIds.length },
        layerSelectionExists(state) { return this._selectedLayerIds.length > 0 },
        allNodeIds(state) { return this._nodeIds },
        selectedNodeIds(state) { return this._selectedNodeIds },
        selectedNodeCount(state) { return this._selectedNodeIds.length },
        selectedGroupIds(state) {
            const nodeStore = useNodeStore();
            return [...state._selection].filter(id => nodeStore.isGroup(id));
        },
        selectedGroupCount(state) { return this.selectedGroupIds.length },
        descendantLayerIds(state) { return (id) => {
            const info = findNode(state._tree, id);
            return info ? collectLayerIds(info.node, []) : [];
        } }
    },
    actions: {
        _findNode(id) {
            return findNode(this._tree, id);
        },
        _removeFromTree(id) {
            const info = findNode(this._tree, id);
            if (!info) return null;
            const parentArr = info.parent ? info.parent.children : this._tree;
            const parentHashArr = info.parent ? this._hashNodes[info.parent.id].children : this._hash.tree.children;
            const removed = parentArr.splice(info.index, 1)[0];
            parentHashArr.splice(info.index, 1);
            deleteHashNode(this, removed);
            rehashUpFrom(this, info.parent ? info.parent.id : null);
            return removed;
        },
        insert(ids, targetId, placeBelow = true) {
            const nodeStore = useNodeStore();
            const targetInfo = targetId != null ? this._findNode(targetId) : null;
            let parentArr = this._tree;
            let parentHashArr = this._hash.tree.children;
            let index = parentArr.length;
            if (targetInfo) {
                parentArr = targetInfo.parent ? targetInfo.parent.children : this._tree;
                if (targetInfo.parent) {
                    parentHashArr = this._hashNodes[targetInfo.parent.id].children;
                    if (!parentHashArr) {
                        this._hashNodes[targetInfo.parent.id].children = [];
                        parentHashArr = this._hashNodes[targetInfo.parent.id].children;
                    }
                } else {
                    parentHashArr = this._hash.tree.children;
                }
                index = targetInfo.index;
                if (!placeBelow) index++;
            }

            const idsSet = new Set(ids);
            let removedBefore = 0;
            for (let i = 0; i < index; i++) {
                if (idsSet.has(parentArr[i].id)) removedBefore++;
            }
            index -= removedBefore;

            const nodes = ids.map(id => {
                const existing = this._removeFromTree(id);
                if (existing) return existing;
                return nodeStore.isGroup(id)
                    ? { id, children: reactive([]) }
                    : { id };
            });

            const hashNodes = nodes.map(n => createHashNode(this, n));
            parentArr.splice(index, 0, ...nodes);
            parentHashArr.splice(index, 0, ...hashNodes);
            rehashUpFrom(this, targetInfo ? (targetInfo.parent ? targetInfo.parent.id : null) : null);
        },
        append(ids, groupId, placeTop = true) {
            const nodeStore = useNodeStore();
            const nodes = ids.map(id => {
                const existing = this._removeFromTree(id);
                if (existing) return existing;
                return nodeStore.isGroup(id)
                    ? { id, children: reactive([]) }
                    : { id };
            });
            const hashNodes = nodes.map(n => createHashNode(this, n));
            let targetArr = this._tree;
            let targetHashArr = this._hash.tree.children;
            if (groupId != null) {
                const info = this._findNode(groupId);
                if (info && info.node.children) targetArr = info.node.children;
                targetHashArr = this._hashNodes[groupId].children;
                if (!targetHashArr) {
                    this._hashNodes[groupId].children = [];
                    targetHashArr = this._hashNodes[groupId].children;
                }
            }
            const index = placeTop ? 0 : targetArr.length;
            targetArr.splice(index, 0, ...nodes);
            targetHashArr.splice(index, 0, ...hashNodes);
            rehashUpFrom(this, groupId != null ? groupId : null);
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
                    if (ancestorSelected && selected) {
                        this._selection.delete(node.id);
                        this._hash.selection ^= node.id;
                    }
                    if (node.children) traverse(node.children, ancestorSelected || selected);
                }
            };
            traverse(this._tree, false);
        },
        _deselect(id) {
            if (this._selection.delete(id)) { this._hash.selection ^= id; return; }
            const ancestor = this._selectedAncestor(id);
            if (!ancestor) return;
            const path = pathTo(this._tree, id);
            if (!path) return;
            const start = path.findIndex(n => n.id === ancestor.id);
            if (start === -1) return;
            for (const node of path.slice(start, -1)) {
                if (node.children) {
                    for (const child of node.children) {
                        if (!this._selection.has(child.id)) {
                            this._selection.add(child.id);
                            this._hash.selection ^= child.id;
                        }
                    }
                }
            }
            if (this._selection.delete(ancestor.id)) this._hash.selection ^= ancestor.id;
            if (this._selection.delete(id)) this._hash.selection ^= id;
        },
        replaceSelection(ids = []) {
            this._selection = new Set(ids);
            this._hash.selection = 0;
            for (const id of this._selection) this._hash.selection ^= id;
            this._collapseSelection();
        },
        addToSelection(ids = []) {
            for (const id of ids) {
                if (!this._selectedAncestor(id) && !this._selection.has(id)) {
                    this._selection.add(id);
                    this._hash.selection ^= id;
                }
            }
            this._collapseSelection();
        },
        removeFromSelection(ids = []) {
            for (const id of ids) this._deselect(id);
            this._collapseSelection();
        },
        toggleSelection(id) {
            if (id == null) return;
            if (this.selectedNodeIds.includes(id)) this.removeFromSelection([id]);
            else this.addToSelection([id]);
        },
        clearSelection() {
            this._selection.clear();
            this._hash.selection = 0;
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
            for (const id of removed) {
                if (this._selection.delete(id)) this._hash.selection ^= id;
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
            rebuildHashTree(this);
            this._selection = new Set(payload?.selection || []);
            this._hash.selection = 0;
            for (const id of this._selection) this._hash.selection ^= id;
            this._collapseSelection();
        }
    }
});
