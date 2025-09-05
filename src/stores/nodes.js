import { defineStore } from 'pinia';
import { reactive } from 'vue';
import { randColorU32 } from '../utils';

export const useNodeStore = defineStore('nodes', {
    state: () => ({
        _name: {},
        _color: {},
        _visibility: {},
        _locked: {},
        _attributes: {},
        _type: {}
    }),
    getters: {
        has: (state) => (id) => state._name[id] != null,
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
                case 'type':
                    return state._type[id];
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
                type: state._type[id],
                attributes: state._attributes[id]?.map(a => ({ ...a })) || []
            });
            return (ids = []) => {
                if (Array.isArray(ids)) return ids.map(propsOf);
                return propsOf(ids);
            };
        }
    },
    actions: {
        createLayer(layerProperties = {}) {
            const id = Math.floor(Date.now() * Math.random());
            this._name[id] = layerProperties.name || 'Layer';
            this._visibility[id] = layerProperties.visibility ?? true;
            this._locked[id] = layerProperties.locked ?? false;
            this._color[id] = (layerProperties.color ?? randColorU32()) >>> 0;
            const attrs = layerProperties.attributes ? layerProperties.attributes.map(a => ({ ...a })) : [];
            this._attributes[id] = reactive(attrs);
            this._type[id] = 'layer';
            return id;
        },
        createGroup(groupProperties = {}) {
            const id = Math.floor(Date.now() * Math.random());
            this._name[id] = groupProperties.name || 'Group';
            this._visibility[id] = groupProperties.visibility ?? true;
            this._locked[id] = groupProperties.locked ?? false;
            this._color[id] = (groupProperties.color ?? randColorU32()) >>> 0;
            this._attributes[id] = reactive([]);
             this._type[id] = 'group';
            return id;
        },
        update(id, props) {
            if (this._name[id] == null) return;
            if (props.name !== undefined) this._name[id] = props.name;
            if (props.visibility !== undefined) this._visibility[id] = !!props.visibility;
            if (props.locked !== undefined) this._locked[id] = !!props.locked;
            if (!this._locked[id] && props.color !== undefined) this._color[id] = (props.color >>> 0);
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
        remove(ids = []) {
            const removed = [];
            for (const id of ids) {
                if (this._name[id] == null) continue;
                removed.push(id);
                delete this._name[id];
                delete this._color[id];
                delete this._visibility[id];
                delete this._locked[id];
                delete this._attributes[id];
                delete this._type[id];
            }
            return removed;
        },
        serialize() {
            const allIds = Object.keys(this._name).map(id => Number(id));
            return Object.fromEntries(allIds.map(id => [id, {
                name: this._name[id],
                visibility: !!this._visibility[id],
                locked: !!this._locked[id],
                color: (this._color[id] >>> 0),
                type: this._type[id],
                attributes: this._attributes[id]?.map(a => ({ ...a })) || []
            }]));
        },
        applySerialized(byId = {}) {
            this._name = {};
            this._color = {};
            this._visibility = {};
            this._locked = {};
            this._attributes = {};
            this._type = {};
            for (const id of Object.keys(byId)) {
                const info = byId[id];
                const numId = Number(id);
                this._name[numId] = info.name || 'Layer';
                this._visibility[numId] = !!info.visibility;
                this._locked[numId] = !!info.locked;
                this._color[numId] = (info.color ?? randColorU32()) >>> 0;
                this._type[numId] = info.type || 'layer';
                const attrs = info.attributes ? info.attributes.map(a => ({ ...a })) : [];
                this._attributes[numId] = reactive(attrs);
            }
        }
    }
});
