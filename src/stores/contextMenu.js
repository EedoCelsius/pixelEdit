import { defineStore } from 'pinia';

export const useContextMenuStore = defineStore('contextMenu', {
  state: () => ({
    visible: false,
    x: 0,
    y: 0,
    items: [],
  }),
  actions: {
    open(event, items = []) {
      this.x = event.clientX;
      this.y = event.clientY;
      this.items = items;
      this.visible = true;
      document.addEventListener('click', this.close);
    },
    close() {
      this.visible = false;
      this.items = [];
      document.removeEventListener('click', this.close);
    },
  },
});
