import { defineStore } from 'pinia';
import { reactive, readonly } from 'vue';

export const useLayerGroupStore = defineStore('layerGroups', {
    state: () => ({
        _order: [],
        _name: {},
        _visibility: {},
        _locked: {},
        _layers: {}, // groupId -> array of layer ids
        _groupOf: {} // layerId -> groupId
    }),
    getters: {
        exists: (state) => state._order.length > 0,
        order: (state) => readonly(state._order),
        layersOf: (state) => (groupId) => readonly(state._layers[groupId] || []),
        groupOfLayer: (state) => (layerId) => state._groupOf[layerId] ?? null,
        isVisible: (state) => (groupId) => groupId == null ? true : !!state._visibility[groupId],
        isLocked: (state) => (groupId) => groupId == null ? false : !!state._locked[groupId],
        getProperties: (state) => (id) => ({
            id,
            name: state._name[id],
            visibility: !!state._visibility[id],
            locked: !!state._locked[id],
            layers: (state._layers[id] || []).slice()
        }),
        ungrouped: (state) => (ids = []) => ids.filter(id => state._groupOf[id] == null)
    },
    actions: {
        _allocId() {
            let id = Date.now();
            while (this._name[id] != null) id++;
            return id;
        },
        createGroup(props = {}) {
            const id = this._allocId();
            this._name[id] = props.name || 'Group';
            this._visibility[id] = props.visibility ?? true;
            this._locked[id] = props.locked ?? false;
            this._layers[id] = [];
            this._order.push(id);
            return id;
        },
        addLayers(groupId, layerIds = []) {
            const arr = this._layers[groupId];
            if (!arr || this._locked[groupId]) return;
            for (const lid of layerIds) {
                const prev = this._groupOf[lid];
                if (prev != null) this.removeLayers(prev, [lid]);
                arr.push(lid);
                this._groupOf[lid] = groupId;
            }
        },
        removeLayers(groupId, layerIds = []) {
            const arr = this._layers[groupId];
            if (!arr) return;
            this._layers[groupId] = arr.filter(id => !layerIds.includes(id));
            for (const lid of layerIds) {
                if (this._groupOf[lid] === groupId) delete this._groupOf[lid];
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
        deleteGroup(id) {
            if (this._name[id] == null) return;
            for (const lid of this._layers[id]) {
                delete this._groupOf[lid];
            }
            delete this._name[id];
            delete this._visibility[id];
            delete this._locked[id];
            delete this._layers[id];
            this._order = this._order.filter(gid => gid !== id);
        },
        updateProperties(id, props) {
            if (this._name[id] == null) return;
            if (props.name !== undefined) this._name[id] = props.name;
            if (props.visibility !== undefined) this._visibility[id] = !!props.visibility;
            if (props.locked !== undefined) this._locked[id] = !!props.locked;
            if (props.layers !== undefined) {
                this._layers[id] = props.layers.slice();
                for (const lid of props.layers) this._groupOf[lid] = id;
            }
        },
        syncFromLayerOrder(order = []) {
            const pos = new Map(order.map((id, idx) => [id, idx]));
            for (const gid of this._order) {
                const arr = this._layers[gid];
                arr.sort((a, b) => (pos.get(a) ?? 0) - (pos.get(b) ?? 0));
            }
        },
        serialize() {
            return {
                order: this._order.slice(),
                byId: Object.fromEntries(this._order.map(id => [id, {
                    name: this._name[id],
                    visibility: !!this._visibility[id],
                    locked: !!this._locked[id],
                    layers: this._layers[id].slice()
                }]))
            };
        },
        applySerialized(payload) {
            const order = payload?.order || [];
            const byId = payload?.byId || {};
            this._order = [];
            this._name = {};
            this._visibility = {};
            this._locked = {};
            this._layers = {};
            this._groupOf = {};
            for (const idStr of order) {
                const id = +idStr;
                const info = byId[idStr] || byId[id];
                if (!info) continue;
                this._name[id] = info.name || 'Group';
                this._visibility[id] = !!info.visibility;
                this._locked[id] = !!info.locked;
                const layerArr = info.layers ? info.layers.slice() : [];
                this._layers[id] = layerArr;
                for (const lid of layerArr) this._groupOf[lid] = id;
                this._order.push(id);
            }
        }
    }
});

