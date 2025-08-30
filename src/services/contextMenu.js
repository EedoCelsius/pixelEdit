import { defineStore } from 'pinia';
import { reactive, toRefs } from 'vue';

export const useContextMenuService = defineStore('contextMenuService', () => {
  const state = reactive({
    visible: false,
    x: 0,
    y: 0,
    items: [],
  });

  function open(event, items = []) {
    state.x = event.clientX;
    state.y = event.clientY;
    state.items = items;
    state.visible = true;
    document.addEventListener('click', close);
  }

  function close() {
    state.visible = false;
    state.items = [];
    document.removeEventListener('click', close);
  }

  return { ...toRefs(state), open, close };
});
