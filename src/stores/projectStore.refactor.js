import { defineStore } from 'pinia';

export const useProjectStore = defineStore('projectStore', {
  state: () => ({
    _width: 16,
    _height: 16,
    _importStatus: 'idle',
    _exportStatus: 'idle',
  }),
  getters: {
    width: (state) => state._width,
    height: (state) => state._height,
    importStatus: (state) => state._importStatus,
    exportStatus: (state) => state._exportStatus,
  },
  actions: {
    setSize(w, h) {
      this._width = w;
      this._height = h;
    },
    setImportStatus(s) {
      this._importStatus = s;
    },
    setExportStatus(s) {
      this._exportStatus = s;
    },
  },
});

