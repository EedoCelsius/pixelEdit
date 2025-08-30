<template>
  <ul v-if="visible" class="context-menu" :style="{ left: x + 'px', top: y + 'px' }">
    <li v-for="(item, i) in items" :key="i" @click="select(item)" class="menu-item">
      {{ item.label }}
    </li>
  </ul>
</template>

<script setup>
import { useContextMenuService } from '../services/contextMenu';

const { visible, x, y, items, close } = useContextMenuService();

function select(item) {
  close();
  item.action && item.action();
}
</script>

<style scoped>
.context-menu {
  position: fixed;
  z-index: 1000;
  background: rgba(15, 23, 42, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  padding: 4px 0;
  min-width: 120px;
}
.menu-item {
  padding: 4px 12px;
  cursor: pointer;
}
.menu-item:hover {
  background: rgba(255, 255, 255, 0.1);
}
</style>
