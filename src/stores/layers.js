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
        has: (state) => (id) => state._layersById[id] != null,
        count: (state) => state._order.length,
        indexOfLayer: (state) => (id) => state._order.indexOf(id),
        idsBottomToTop: (state) => state._order.slice(),
        idsTopToBottom: (state) => state._order.slice().reverse(),
        uppermostId: (state) => state._order[state._order.length - 1] ?? null,
        lowermostId: (state) => state._order[0] ?? null,
        uppermostIdOf: (state) => (ids) => {
            const idSet = new Set(ids);
            if (!idSet.size) return null;
            const index = Math.max(...state._order.map((id, idx) => idSet.has(id) ? idx : -1));
            return index >= 0 ? state._order[index] : null;
        },
        lowermostIdOf: (state) => (ids) => {
            const idSet = new Set(ids);
            if (!idSet.size) return null;
            const index = Math.min(...state._order.map((id, idx) => idSet.has(id) ? idx : Infinity));
            return isFinite(index) ? state._order[index] : null;
        },
        aboveId: (state) => (id) => {
            if (id == null) return null;
            const idx = state._order.indexOf(id);
            return state._order[idx + 1] ?? null;
        },
        belowId: (state) => (id) => {
            if (id == null) return null;
            const idx = state._order.indexOf(id);
            return state._order[idx - 1] ?? null;
        },
        pathOf: (state) => (id) => state._layersById[id]?.d,
        colorOf: (state) => (id) => state._layersById[id]?.getColorU32() ?? 0,
        nameOf: (state) => (id) => state._layersById[id]?.name,
        visibilityOf: (state) => (id) => !!state._layersById[id]?.visible,
        pixelCountOf: (state) => (id) => state._layersById[id]?.pixelCount ?? 0,
        disconnectedCountOf: (state) => (id) => state._layersById[id]?.disconnectedCount ?? 0,
        compositeColorAt: (state) => (x, y) => {
            for (let i = state._order.length - 1; i >= 0; i--) {
                const layer = state._layersById[state._order[i]];
                if (!layer || !layer.visible) continue;
                if (layer.has(x, y)) return layer.getColorU32() >>> 0;
            }
            return 0x00000000 >>> 0;
        },
        topVisibleIdAt: (state) => (x, y) => {
            for (let i = state._order.length - 1; i >= 0; i--) {
                const id = state._order[i];
                const layer = state._layersById[id];
                if (!layer || !layer.visible) continue;
                if (layer.has(x, y)) return id;
            }
            return null;
        },
    },
    actions: {
        _allocId() {
            return this._nextId++;
        },
        getLayer(id) {
            return this._layersById[id] || null;
        },
        getLayers(ids) {
            const result = [];
            for (const id of ids) {
                const layer = this._layersById[id];
                if (layer) result.push(layer);
            }
            return result;
        },
        /** Create a layer and insert relative to a reference id (above = on top of it). If refId null -> push on top */
        createLayer(layerProperties, above = null) {
            const layer = new Layer(layerProperties);
            const id = this._allocId();
            this._layersById[id] = layer;
            if (above === null) {
                this._order.push(id);
            } else {
                const idx = this.indexOfLayer(above);
                (idx < 0) ? this._order.push(id): this._order.splice(idx + 1, 0, id);
            }
            return id;
        },
        /** Update properties of a layer */
        updateLayer(id, props) {
            const layer = this._layersById[id];
            if (!layer) return;
            if (props.name !== undefined) layer.name = props.name;
            if (props.colorU32 !== undefined) layer.setColorU32(props.colorU32);
            if (props.visible !== undefined) layer.visible = !!props.visible;
        },
        toggleVisibility(id) {
            const layer = this._layersById[id];
            if (layer) layer.visible = !layer.visible;
        },
        addPixels(id, pixels) {
            const layer = this._layersById[id];
            if (layer) layer.addPixels(pixels);
        },
        removePixels(id, pixels) {
            const layer = this._layersById[id];
            if (layer) layer.removePixels(pixels);
        },
        togglePixel(id, x, y) {
            const layer = this._layersById[id];
            if (layer) layer.togglePixel(x, y);
        },
        /** Remove layers by ids */
        deleteLayers(ids) {
            const idSet = new Set(ids);
            this._order = this._order.filter(id => !idSet.has(id));
            for (const id of idSet) {
                this._layersById[id]?.dispose?.();
                delete this._layersById[id];
            }
        },
        /** Reorder selected ids as a block relative to targetId. */
        reorderLayers(ids, targetId, placeBelow = true) {
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
        deleteEmptyLayers() {
            const emptyIds = this._order.filter(id => {
                const layer = this._layersById[id];
                return layer && layer.pixelCount === 0;
            });
            if (emptyIds.length) this.deleteLayers(emptyIds);
            return emptyIds;
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
