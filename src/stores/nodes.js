import { defineStore } from 'pinia';
import { reactive } from 'vue';
import { murmurHash32, mixHash } from '../utils/hash.js';

// ---------------------------------------------------------------------------
// hash helpers
// ---------------------------------------------------------------------------

function randColorU32() {
    const r = Math.floor(150 + Math.random() * 105);
    const g = Math.floor(50 + Math.random() * 180);
    const b = Math.floor(50 + Math.random() * 180);
    return (r & 255) | ((g & 255) << 8) | ((b & 255) << 16) | (255 << 24);
}

function hashAttributes(attrs = {}) {
    const entries = Object.entries(attrs).map(([name, value]) => `${name}:${value}`);
    const str = entries.sort().join('|');
    return murmurHash32(str);
}

function initNodeHash(store, id) {
    const node = {
        id: id,
        name: mixHash(id, store._hash.name[id]),
        attributes: mixHash(id, store._hash.attributes[id]),
        color: mixHash(id, store._color[id]),
        visibility: mixHash(id, store._visibility[id] ? 3 : 0),
        locked: mixHash(id, store._locked[id] ? 2 : 0),
        isGroup: mixHash(id, store._isGroup[id] ? 1 : 0),
        hash: 0
    };
    node.hash = node.id ^ node.name ^ node.attributes ^ node.color ^ node.visibility ^ node.locked ^ node.isGroup;
    store._hash.node[id] = node;
    store._hash.all ^= node.hash;
}

function updateHashPart(store, id, part, newValue) {
    const node = store._hash.node[id];
    if (!node) return;
    const oldNodeHash = node.hash;
    const oldPart = node[part] || 0;
    node[part] = newValue;
    node.hash ^= oldPart ^ node[part];
    store._hash.all ^= oldNodeHash ^ node.hash;
}

function rehashAttributes(store, id) {
    const attrHash = hashAttributes(store._attributes[id] || {});
    store._hash.attributes[id] = attrHash;
    updateHashPart(store, id, 'attributes', mixHash(id, attrHash));
}

const PROP_HASHERS = {
    name: (store, id) => mixHash(id, store._hash.name[id]),
    color: (store, id) => mixHash(id, store._color[id]),
    visibility: (store, id) => mixHash(id, store._visibility[id] ? 3 : 0),
    locked: (store, id) => mixHash(id, store._locked[id] ? 2 : 0),
    isGroup: (store, id) => mixHash(id, store._isGroup[id] ? 1 : 0),
    attributes: (store, id) => mixHash(id, store._hash.attributes[id])
};

function setSimpleProp(store, id, key, value) {
    if (!store.has(id)) return;
    store[`_${key}`][id] = value;
    if (key === 'name') {
        const h = murmurHash32(value);
        store._hash.name[id] = h;
    }
    updateHashPart(store, id, key, PROP_HASHERS[key](store, id));
}

function prepareNode(store, id, { name, visibility, locked, color, isGroup, attributes }) {
    store._name[id] = name;
    store._visibility[id] = visibility;
    store._locked[id] = locked;
    store._color[id] = color;
    store._isGroup[id] = isGroup;

    const attrs = { ...attributes };
    store._attributes[id] = reactive(attrs);

    store._hash.name[id] = murmurHash32(name);
    store._hash.attributes[id] = hashAttributes(attrs);
    initNodeHash(store, id);
}

export const useNodeStore = defineStore('nodes', {
    state: () => ({
        _name: {},
        _color: {},
        _visibility: {},
        _locked: {},
        _attributes: {},
        _isGroup: {},
        _hash: { name: {}, attributes: {}, node: {}, all: 0 }
    }),
    getters: {
        has: (state) => (id) => state._name[id] != null,
        name: (state) => (id) => state._name[id],
        color: (state) => (id) => state._color[id],
        visibility: (state) => (id) => state._visibility[id],
        locked: (state) => (id) => state._locked[id],
        isGroup: (state) => (id) => state._isGroup[id],
        attributes: (state) => (id) => ({ ...(state._attributes[id] || {}) }),
        getProperties: (state) => {
            const propsOf = (id) => ({
                id,
                name: state._name[id],
                color: state._color[id],
                visibility: state._visibility[id],
                locked: state._locked[id],
                isGroup: state._isGroup[id],
                attributes: { ...(state._attributes[id] || {}) }
            });
            return (ids = []) => {
                if (Array.isArray(ids)) return ids.map(propsOf);
                return propsOf(ids);
            };
        }
    },
    actions: {
        _createNode(props = {}, isGroup) {
            const id = crypto.getRandomValues(new Uint32Array(1))[0];
            const defaults = {
                name: isGroup ? 'Group' : 'Layer',
                visibility: true,
                locked: false,
                color: randColorU32(),
                attributes: {}
            };
            prepareNode(this, id, { ...defaults, ...props, isGroup });
            return id;
        },
        addLayer(props = {}) {
            return this._createNode(props, false);
        },
        addGroup(props = {}) {
            return this._createNode(props, true);
        },
        setName(id, name) { setSimpleProp(this, id, 'name', name); },
        setVisibility(id, value) { setSimpleProp(this, id, 'visibility', value); },
        setLocked(id, value) { setSimpleProp(this, id, 'locked', value); },
        setColor(id, color) {
            if (this._locked[id]) return;
            setSimpleProp(this, id, 'color', color);
        },
        setIsGroup(id, value) { setSimpleProp(this, id, 'isGroup', value); },
        update(id, props = {}) {
            if (!this.has(id)) return;
            const handlers = {
                name: this.setName,
                visibility: this.setVisibility,
                locked: this.setLocked,
                color: this.setColor,
                isGroup: this.setIsGroup,
                attributes: this.setAttributes
            };
            for (const [key, value] of Object.entries(props)) {
                if (value !== undefined && handlers[key]) handlers[key].call(this, id, value);
            }
        },
        toggleVisibility(id) {
            this.setVisibility(id, !this._visibility[id]);
        },
        toggleLock(id) {
            this.setLocked(id, !this._locked[id]);
        },
        addAttributes(id, attrs = {}) {
            if (!this.has(id)) return;
            Object.assign(this._attributes[id], attrs);
            rehashAttributes(this, id);
        },
        addAttribute(id, key, value) {
            if (!this.has(id)) return;
            Object.assign(this._attributes[id], { [key]: value });
            rehashAttributes(this, id);
        },
        removeAttribute(id, key) {
            if (!this.has(id)) return;
            delete this._attributes[id][key];
            rehashAttributes(this, id);
        },
        clearAttribute(id) {
            if (!this.has(id)) return;
            this._attributes[id] = reactive({});
            rehashAttributes(this, id);
        },
        remove(ids = []) {
            const removed = [];
            for (const id of ids) {
                if (!this.has(id)) continue;
                const nodeHash = this._hash.node[id]?.hash ?? 0;
                removed.push(id);
                delete this._name[id];
                delete this._color[id];
                delete this._visibility[id];
                delete this._locked[id];
                delete this._attributes[id];
                delete this._isGroup[id];
                delete this._hash.name[id];
                delete this._hash.attributes[id];
                delete this._hash.node[id];
                this._hash.all ^= nodeHash;
            }
            return removed;
        },
        serialize() {
            const allIds = Object.keys(this._name).map(id => Number(id));
            const propsOf = this.getProperties;
            return Object.fromEntries(allIds.map(id => [id, propsOf(id)]));
        },
        applySerialized(byId = {}) {
            this._name = {};
            this._color = {};
            this._visibility = {};
            this._locked = {};
            this._attributes = {};
            this._isGroup = {};
            this._hash = { name: {}, attributes: {}, node: {}, all: 0 };
            for (const [idStr, info] of Object.entries(byId)) {
                const id = Number(idStr);
                const defaults = {
                    name: 'Layer',
                    visibility: true,
                    locked: false,
                    color: randColorU32(),
                    isGroup: false,
                    attributes: {}
                };
                prepareNode(this, id, { ...defaults, ...info });
            }
        }
    }
});
