import { defineStore } from 'pinia';
import { reactive } from 'vue';
import { useLayerStore } from './layers';

export const useLayerGroupStore = defineStore('layerGroups', {
    state: () => ({
        _groups: {
            root: reactive({ id: 'root', name: 'Root', expanded: true, visibility: true, locked: false, children: [] })
        },
        _parent: {}
    }),
    getters: {
        rootId: () => 'root',
        getGroup: (state) => (id) => state._groups[id],
        isGroup: (state) => (id) => state._groups[id] != null,
        childrenOf: (state) => (id) => state._groups[id]?.children || [],
    },
    actions: {
        initFromLayerStore() {
            const layers = useLayerStore();
            const root = this._groups.root;
            root.children = layers.idsBottomToTop.slice();
            for (const id of root.children) this._parent[id] = 'root';
        },
        createGroup({ name = 'Group', parentId = 'root', childIds = [] } = {}) {
            const id = 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2);
            const group = reactive({ id, name, expanded: true, visibility: true, locked: false, children: [] });
            this._groups[id] = group;
            this.addToGroup(parentId, id);
            if (childIds.length) this.addManyToGroup(id, childIds);
            return id;
        },
        addToGroup(parentId, childId, index = null) {
            const parent = this._groups[parentId];
            if (!parent) return;
            const children = parent.children;
            if (index == null || index < 0 || index > children.length) index = children.length;
            children.splice(index, 0, childId);
            this._parent[childId] = parentId;
        },
        addManyToGroup(parentId, ids) {
            for (const id of ids) this.addToGroup(parentId, id);
        },
        groupSelection(ids) {
            if (!ids.length) return null;
            const parentId = this._parent[ids[0]] || 'root';
            const parent = this._groups[parentId];
            const positions = ids.map(id => parent.children.indexOf(id)).filter(i => i >= 0).sort((a, b) => a - b);
            if (!positions.length) return null;
            const firstIndex = positions[0];
            const groupId = this.createGroup({ parentId });
            this._groups[groupId].children = [];
            for (const id of ids) {
                const idx = parent.children.indexOf(id);
                if (idx >= 0) parent.children.splice(idx, 1);
                this.addToGroup(groupId, id);
            }
            parent.children.splice(firstIndex, 0, groupId);
            this.rebuildLayerOrder();
            return groupId;
        },
        toggleExpanded(id) {
            const g = this._groups[id];
            if (g) g.expanded = !g.expanded;
        },
        toggleVisibility(id) {
            const layers = useLayerStore();
            const g = this._groups[id];
            if (!g) return;
            g.visibility = !g.visibility;
            const visible = g.visibility;
            const apply = (cid) => {
                if (this.isGroup(cid)) {
                    const cg = this._groups[cid];
                    cg.visibility = visible;
                    cg.children.forEach(apply);
                } else {
                    layers.updateProperties(cid, { visibility: visible });
                }
            };
            g.children.forEach(apply);
        },
        toggleLock(id) {
            const layers = useLayerStore();
            const g = this._groups[id];
            if (!g) return;
            g.locked = !g.locked;
            const locked = g.locked;
            const apply = (cid) => {
                if (this.isGroup(cid)) {
                    const cg = this._groups[cid];
                    cg.locked = locked;
                    cg.children.forEach(apply);
                } else {
                    layers.updateProperties(cid, { locked });
                }
            };
            g.children.forEach(apply);
        },
        moveItems(ids, targetId, position = 'after') {
            if (!ids || !ids.length) return;
            // remove from current parents
            for (const id of ids) {
                const parentId = this._parent[id];
                if (!parentId) continue;
                const arr = this._groups[parentId]?.children;
                const idx = arr ? arr.indexOf(id) : -1;
                if (idx >= 0) arr.splice(idx, 1);
            }
            if (position === 'inside') {
                const group = this._groups[targetId];
                if (!group) return;
                group.children.push(...ids);
                for (const id of ids) this._parent[id] = targetId;
            } else {
                const parentId = this._parent[targetId];
                const arr = this._groups[parentId]?.children;
                let idx = arr ? arr.indexOf(targetId) : -1;
                if (idx < 0) return;
                if (position === 'after') idx += 1;
                arr.splice(idx, 0, ...ids);
                for (const id of ids) this._parent[id] = parentId;
            }
            this.rebuildLayerOrder();
        },
        rebuildLayerOrder() {
            const layers = useLayerStore();
            const order = [];
            const traverse = (id) => {
                const group = this._groups[id];
                if (!group) return;
                for (const child of group.children) {
                    if (this.isGroup(child)) traverse(child);
                    else order.push(child);
                }
            };
            traverse(this.rootId);
            layers._order = order;
        }
    }
});
