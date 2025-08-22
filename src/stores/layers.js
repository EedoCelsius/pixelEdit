import { defineStore } from 'pinia';
import { readonly, shallowReadonly } from 'vue';
import { Layer } from '../domain/Layer';

export const useLayerStore = defineStore('layers', {
    state: () => ({
        _order: [],
        _layersById: {},
        _nextId: 1
    }),
    getters: {
        exists: (state) => state._order.length > 0,
        order: (state) => readonly(state._order),
        layersById: (state) => shallowReadonly(state._layersById),
        count: (state) => state._order.length,
        indexOf: (state) => (id) => state._order.indexOf(id),
        listBottomToTopIds: (state) => state._order.slice(),
        listTopToBottomIds: (state) => state._order.slice().reverse(),
    },
    actions: {
        _allocId() {
            return this._nextId++;
        },
        get(id) {
            return this._layersById[id] || null;
        },
        /** Create a layer and insert relative to a reference id (above = on top of it). If refId null -> push on top */
        create(layerProperties, above = null) {
            const layer = new Layer(layerProperties);
            const id = this._allocId();
            this._layersById[id] = layer;
            if (above === null) {
                this._order.push(id);
            } else {
                const idx = this.indexOf(above);
                (idx < 0) ? this._order.push(id): this._order.splice(idx + 1, 0, id);
            }
            return id;
        },
        /** Remove layers by ids */
        remove(ids) {
            const idSet = new Set(ids);
            this._order = this._order.filter(id => !idSet.has(id));
            for (const id of idSet) {
                this._layersById[id]?.dispose?.();
                delete this._layersById[id];
            }
        },
        /** Reorder selected ids as a block relative to targetId. */
        reorder(ids, targetId, placeBelow = true) {
            const selectionSet = new Set(ids);
            if (!selectionSet.size) return;
            const keptIds = this._order.filter(id => !selectionSet.has(id));
            let targetIndex = keptIds.indexOf(targetId);
            if (targetIndex < 0) targetIndex = keptIds.length;
            if (!placeBelow) targetIndex = targetIndex + 1;
            const selectionInStack = this._order.filter(id => selectionSet.has(id));
            keptIds.splice(targetIndex, 0, ...selectionInStack);
            this._order = keptIds;
        },
        /** Serialization */
        serialize() {
            return {
                nextId: this._nextId,
                order: this._order.slice(),
                byId: Object.fromEntries(this._order.map(id => [id, this._layersById[id]?.toJSON()]))
            };
        },
        applySerialized(payload) {
            const order = payload?.order || [];
            const byId = payload?.byId || {};
            const layers = [];
            // reset
            this._order.splice(0, this._order.length);
            for (const k of Object.keys(this._layersById)) {
                this._layersById[k].dispose?.();
                delete this._layersById[k];
            }
            // rebuild
            for (const idStr of order) {
                const id = +idStr;
                const info = byId[idStr] || byId[id];
                if (!info) continue;
                const layer = Layer.fromJSON(info);
                this._layersById[id] = layer;
                this._order.push(id);
                layers.push(id);
            }
            // nextId
            const maxId = layers.length ? Math.max(...layers) : 0;
            this._nextId = Math.max(payload?.nextId || 0, maxId + 1);
        }
    }
});
