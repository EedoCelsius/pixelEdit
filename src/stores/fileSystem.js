import { defineStore } from 'pinia';

export const useFileSystemStore = defineStore('fileSystem', {
    state: () => ({
        loadHandle: null,
        saveHandle: null,
        saveFormat: 'json'
    }),
    getters: {
        canQuickSave: (state) => !!state.saveHandle,
        lastSaveFormat: (state) => state.saveFormat || 'json'
    },
    actions: {
        setLoadHandle(handle) {
            this.loadHandle = handle ?? null;
        },
        setSaveContext(handle, format = 'json') {
            this.saveHandle = handle ?? null;
            if (format) {
                this.saveFormat = format;
            }
        },
        clearSaveContext() {
            this.saveHandle = null;
        }
    }
});
