import { defineStore } from 'pinia';
import { readonly } from 'vue';

export const useHistoryStore = defineStore('historyStore', {
  state: () => ({
    _undoStack: [],
    _redoStack: [],
    _snapshotId: 0,
  }),
  getters: {
    undoStack: (state) => readonly(state._undoStack),
    redoStack: (state) => readonly(state._redoStack),
    snapshotId: (state) => state._snapshotId,
  },
  actions: {
    pushUndo(snapshot) {
      this._undoStack.push(snapshot);
    },
    pushRedo(snapshot) {
      this._redoStack.push(snapshot);
    },
    clearRedo() {
      this._redoStack.length = 0;
    },
    incrementSnapshot() {
      this._snapshotId++;
    },
  },
});

