import { defineStore } from 'pinia';

export const useSelectionStore = defineStore('selection', {
    state: () => ({
        _ids: new Set(),
        _anchorId: null,
        _tailId: null,
        _scrollRule: null
    }),
    getters: {
        hasSelection: (state) => state._ids.size > 0,
        has: (state) => (id) => state._ids.has(id),
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
        add(ids) {
            const arr = Array.isArray(ids) ? ids : [ids];
            const merged = new Set(this._ids);
            arr.forEach(id => merged.add(id));
            const anchor = this._anchorId ?? arr[0] ?? null;
            const tail = this._tailId ?? anchor;
            this.replace([...merged], anchor, tail);
        },
        remove(ids) {
            const arr = Array.isArray(ids) ? ids : [ids];
            const remaining = new Set(this._ids);
            arr.forEach(id => remaining.delete(id));
            let anchor = remaining.has(this._anchorId) ? this._anchorId : null;
            let tail = remaining.has(this._tailId) ? this._tailId : anchor;
            this.replace([...remaining], anchor, tail);
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
            this.has(id) ? this.remove(id) : this.add(id);
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
