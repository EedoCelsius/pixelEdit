import { defineStore } from 'pinia';

export const useSelectionStore = defineStore('selection', {
    state: () => ({
        _selectedIds: new Set(),
        _anchorId: null,
        _tailId: null,
        _scrollRule: null
    }),
    getters: {
        exists: (state) => state._selectedIds.size > 0,
        has: (state) => (id) => state._selectedIds.has(id),
        size: (state) => state._selectedIds.size,
        asArray: (state) => [...state._selectedIds],
        anchorId: (state) => state._anchorId,
        tailId: (state) => state._tailId,
        scrollRule: (state) => state._scrollRule,
    },
    actions: {
        set(ids, anchorId, tailId) {
            this._selectedIds = new Set(ids);
            this._anchorId = anchorId;
            this._tailId = tailId;
            // scrollRule는 호출부에서 명시적으로 설정
        },
        add(id) {
            this.set([id, ...this._selectedIds], this._anchorId ?? id, this._anchorId ?? id);
        },
        selectOnly(id = null) {
            if (id === null) {
                this.clear();
                return;
            }
            this.set([id], id, id);
        },
        clear() {
            this.set([], null, null);
        },
        toggle(id = null) {
            if (id === null) return;
            const idSet = new Set(this._selectedIds);
            idSet.has(id) ? idSet.delete(id) : idSet.add(id);
            const newAnchorId = this._anchorId === id ? null : this._anchorId;
            this.set(idSet, newAnchorId, newAnchorId);
        },

        setScrollRule(rule) {
            this._scrollRule = rule;
        },

        serialize() {
            return {
                selection: [...this._selectedIds],
                anchor: this._anchorId,
                tailId: this._tailId,
                scrollRule: this._scrollRule
            };
        },
        applySerialized(payload) {
            this.set(payload?.selection || [], payload?.anchor ?? null, payload?.tailId ?? null);
            this._scrollRule = payload?.scrollRule;
        }
    }
});
