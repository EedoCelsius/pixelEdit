import { defineStore } from 'pinia';
import { reactive } from 'vue';
import { murmurHash32 } from '../utils/hash.js';

// ---------------------------------------------------------------------------
// hash helpers
// ---------------------------------------------------------------------------

function randColorU32() {
    const r = Math.floor(150 + Math.random() * 105);
    const g = Math.floor(50 + Math.random() * 180);
    const b = Math.floor(50 + Math.random() * 180);
    return (r & 255) | ((g & 255) << 8) | ((b & 255) << 16) | (255 << 24);
}

function hashAttributes(attrs = []) {
    const str = attrs.map(a => `${a.name}:${a.value}`).sort().join('|');
    return murmurHash32(str);
}

function nodePartHash(id, value) {
    let h = id ^ value;
    h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    return h ^ (h >>> 16);
}

function initNodeHash(store, id) {
    const node = {
        id: id,
        name: nodePartHash(id, store._hash.name[id]),
        attributes: nodePartHash(id, store._hash.attributes[id]),
        color: nodePartHash(id, store._color[id]),
        visibility: nodePartHash(id, store._visibility[id] ? 3 : 0),
        locked: nodePartHash(id, store._locked[id] ? 2 : 0),
        isGroup: nodePartHash(id, store._isGroup[id] ? 1 : 0),
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
    const attrHash = hashAttributes(store._attributes[id] || []);
    store._hash.attributes[id] = attrHash;
    updateHashPart(store, id, 'attributes', nodePartHash(id, attrHash));
}

function prepareNode(store, id, { name, visibility, locked, color, isGroup, attributes }) {
    store._name[id] = name;
    store._visibility[id] = visibility;
    store._locked[id] = locked;
    store._color[id] = color;
    store._isGroup[id] = isGroup;

    const attrs = attributes.map(a => ({ ...a }));
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
        attributes: (state) => (id) => state._attributes[id]?.map(a => ({ ...a })) || [],
        getProperties: (state) => {
            const propsOf = (id) => ({
                id,
                name: state._name[id],
                color: state._color[id],
                visibility: state._visibility[id],
                locked: state._locked[id],
                isGroup: state._isGroup[id],
                attributes: state._attributes[id]?.map(a => ({ ...a })) || []
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
                attributes: []
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
        setName(id, name) {
            if (!this.has(id)) return;
            this._name[id] = name;
            const h = murmurHash32(name);
            this._hash.name[id] = h;
            updateHashPart(this, id, 'name', nodePartHash(id, h));
        },
        setVisibility(id, value) {
            if (!this.has(id)) return;
            this._visibility[id] = value;
            updateHashPart(this, id, 'visibility', nodePartHash(id, this._visibility[id] ? 3 : 0));
        },
        setLocked(id, value) {
            if (!this.has(id)) return;
            this._locked[id] = value;
            updateHashPart(this, id, 'locked', nodePartHash(id, this._locked[id] ? 2 : 0));
        },
        setColor(id, color) {
            if (!this.has(id) || this._locked[id]) return;
            this._color[id] = color;
            updateHashPart(this, id, 'color', nodePartHash(id, this._color[id]));
        },
        setIsGroup(id, value) {
            if (!this.has(id)) return;
            this._isGroup[id] = value;
            updateHashPart(this, id, 'isGroup', nodePartHash(id, this._isGroup[id] ? 1 : 0));
        },
        setAttributes(id, attrs = []) {
            if (!this.has(id)) return;
            this._attributes[id] = reactive(Array.isArray(attrs) ? attrs.map(a => ({ ...a })) : []);
            rehashAttributes(this, id);
        },
        update(id, props = {}) {
            if (!this.has(id)) return;
            if (props.name !== undefined) this.setName(id, props.name);
            if (props.visibility !== undefined) this.setVisibility(id, props.visibility);
            if (props.locked !== undefined) this.setLocked(id, props.locked);
            if (props.color !== undefined) this.setColor(id, props.color);
            if (props.isGroup !== undefined) this.setIsGroup(id, props.isGroup);
            if (props.attributes !== undefined) this.setAttributes(id, props.attributes);
        },
        toggleVisibility(id) {
            this.setVisibility(id, !this._visibility[id]);
        },
        toggleLock(id) {
            this.setLocked(id, !this._locked[id]);
        },
        setAttribute(id, name, value) {
            if (!this.has(id)) return;
            if (!this._attributes[id]) this._attributes[id] = reactive([]);
            const attrs = this._attributes[id];
            const found = attrs.find(a => a.name === name);
            if (found) found.value = value;
            else attrs.push({ name, value });
            rehashAttributes(this, id);
        },
        removeAttribute(id, name) {
            if (!this.has(id)) return;
            const attrs = this._attributes[id];
            if (!attrs) return;
            const index = attrs.findIndex(a => a.name === name);
            if (index >= 0) attrs.splice(index, 1);
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
            return Object.fromEntries(allIds.map(id => [id, {
                name: this._name[id],
                color: this._color[id],
                visibility: this._visibility[id],
                locked: this._locked[id],
                isGroup: this._isGroup[id],
                attributes: this._attributes[id]?.map(a => ({ ...a })) || []
            }]));
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
                    attributes: []
                };
                prepareNode(this, id, { ...defaults, ...info });
            }
        }
    }
});
