import { defineStore } from 'pinia';

export const useSelectionStore = defineStore('selection', {
    state: () => ({
        _ids: new Set(),
        _anchorId: null,
        _tailId: null,
        _scrollRule: null
    }),
    getters: {
        exists: (state) => state._ids.size > 0,
        isSelected: (state) => (id) => state._ids.has(id),
        count: (state) => state._ids.size,
        ids: (state) => [...state._ids],
        anchorId: (state) => state._anchorId,
        tailId: (state) => state._tailId,
        scrollRule: (state) => state._scrollRule,
    },
    actions: {
        replace(ids = [], anchorId = null, tailId = null) {
            this._ids = new Set(ids);
            this._anchorId = anchorId;
            this._tailId = tailId;
            // scrollRule는 호출부에서 명시적으로 설정
        },
        addOne(id) {
            if (id == null) return;
            const oldAnchor = this._anchorId;
            this._ids.add(id);
            if (oldAnchor != null && this._ids.has(oldAnchor)) {
                this._anchorId = oldAnchor;
                this._tailId = oldAnchor;
            } else {
                this._anchorId = null;
                this._tailId = null;
            }
        },
        addMany(ids = []) {
            const oldAnchor = this._anchorId;
            for (const id of ids) this._ids.add(id);
            if (oldAnchor != null && this._ids.has(oldAnchor)) {
                this._anchorId = oldAnchor;
                this._tailId = oldAnchor;
            } else {
                this._anchorId = null;
                this._tailId = null;
            }
        },
        removeOne(id) {
            if (id == null) return;
            const oldAnchor = this._anchorId;
            this._ids.delete(id);
            if (oldAnchor != null && this._ids.has(oldAnchor)) {
                this._anchorId = oldAnchor;
                this._tailId = oldAnchor;
            } else {
                this._anchorId = null;
                this._tailId = null;
            }
        },
        removeMany(ids = []) {
            const oldAnchor = this._anchorId;
            ids.forEach(id => this._ids.delete(id));
            if (oldAnchor != null && this._ids.has(oldAnchor)) {
                this._anchorId = oldAnchor;
                this._tailId = oldAnchor;
            } else {
                this._anchorId = null;
                this._tailId = null;
            }
        },
        selectOne(id = null) {
            if (id === null) {
                this.clear();
                return;
            }
            this.replace([id], id, id);
        },
        clear() {
            this.replace([], null, null);
        },
        toggle(id = null) {
            if (id === null) return;
            if (this._ids.has(id)) {
                this.removeOne(id);
            } else {
                this.addOne(id);
            }
        },

        setScrollRule(rule) {
            this._scrollRule = rule;
        },

        serialize() {
            return {
                selection: [...this._ids],
                anchor: this._anchorId,
                tailId: this._tailId,
                scrollRule: this._scrollRule
            };
        },
        applySerialized(payload) {
            this.replace(payload?.selection || [], payload?.anchor ?? null, payload?.tailId ?? null);
            this._scrollRule = payload?.scrollRule;
        }
    }
});
