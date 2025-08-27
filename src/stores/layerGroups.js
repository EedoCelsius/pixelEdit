import { defineStore } from 'pinia';
import { reactive } from 'vue';
import { useLayerStore } from './layers';

export const useLayerGroupStore = defineStore('layerGroups', {
    state: () => ({
        // root group id is 0
        _groups: reactive({
            0: { id: 0, name: 'Root', children: [], collapsed: false, visibility: true, locked: false, parent: null }
        }),
        _parent: reactive({}) // layerId or groupId -> parent group id
    }),
    getters: {
        root(state) {
            return state._groups[0];
        },
        tree(state) {
            const build = (id) => {
                const node = state._groups[id];
                return {
                    ...node,
                    children: node.children.map(cid => state._groups[cid] ? build(cid) : cid)
                };
            };
            return build(0).children;
        }
    },
    actions: {
        _allocId() {
            let id = Date.now();
            while (this._groups[id]) id++;
            return id;
        },
        createGroup(name = 'Group', parent = 0) {
            const id = this._allocId();
            this._groups[id] = { id, name, children: [], collapsed: false, visibility: true, locked: false, parent };
            this._parent[id] = parent;
            this._groups[parent].children.push(id);
            return id;
        },
        initFromLayers() {
            if (this._groups[0].children.length) return;
            const { layers } = useLayerStore();
            this._groups[0].children = layers.order.slice();
            for (const id of layers.order) this._parent[id] = 0;
        },
        addLayer(layerId, parent = 0) {
            const p = this._parent[layerId];
            if (p != null) {
                const arr = this._groups[p].children;
                const idx = arr.indexOf(layerId);
                if (idx >= 0) arr.splice(idx,1);
            }
            this._parent[layerId] = parent;
            this._groups[parent].children.push(layerId);
            this._syncLayerOrder();
        },
        removeLayer(layerId) {
            const p = this._parent[layerId];
            if (p == null) return;
            const arr = this._groups[p].children;
            const idx = arr.indexOf(layerId);
            if (idx >= 0) arr.splice(idx,1);
            delete this._parent[layerId];
            this._syncLayerOrder();
        },
        toggleCollapse(id) {
            if (this._groups[id]) this._groups[id].collapsed = !this._groups[id].collapsed;
        },
        toggleVisibility(id) {
            const group = this._groups[id];
            if (!group) return;
            group.visibility = !group.visibility;
            const { layers } = useLayerStore();
            const toggle = (nodeId, visible) => {
                const g = this._groups[nodeId];
                if (g) {
                    g.visibility = visible;
                    g.children.forEach(child => toggle(child, visible));
                } else {
                    layers.updateProperties(nodeId, { visibility: visible });
                }
            };
            group.children.forEach(child => toggle(child, group.visibility));
        },
        toggleLock(id) {
            const group = this._groups[id];
            if (!group) return;
            group.locked = !group.locked;
            const { layers } = useLayerStore();
            const toggle = (nodeId, locked) => {
                const g = this._groups[nodeId];
                if (g) {
                    g.locked = locked;
                    g.children.forEach(child => toggle(child, locked));
                } else {
                    layers.updateProperties(nodeId, { locked });
                }
            };
            group.children.forEach(child => toggle(child, group.locked));
        },
        _flattenLayers(id = 0, result = []) {
            const group = this._groups[id];
            for (const child of group.children) {
                if (this._groups[child]) {
                    this._flattenLayers(child, result);
                } else {
                    result.push(child);
                }
            }
            return result;
        },
        _syncLayerOrder() {
            const flat = this._flattenLayers();
            const { layers } = useLayerStore();
            if (layers && Array.isArray(flat)) {
                layers.setOrder(flat);
            }
        }
    }
});

