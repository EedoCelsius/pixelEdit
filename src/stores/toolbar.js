import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useToolbarStore = defineStore('toolbar', () => {
    const tools = ref([]);

    function register(tool) {
        if (!tools.value.find(t => t.type === tool.type)) {
            tools.value.push(tool);
        }
    }

    return { tools, register };
});
