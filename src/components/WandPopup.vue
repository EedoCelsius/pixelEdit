<template>
  <div v-if="show" ref="popup" class="absolute top-full left-0 mt-1 z-10 bg-sky-950/95 border border-white/15 rounded-md p-1 flex flex-col">
    <button v-for="op in operations" :key="op.name"
            @click="execute(op)"
            class="flex items-center gap-2 px-2 py-1 text-xs rounded hover:bg-white/10">
      <img v-if="op.icon" :src="op.icon" :alt="op.name" class="w-4 h-4" />
      <span>{{ op.name }}</span>
    </button>
  </div>
</template>

<script setup>
import { ref, watch, onBeforeUnmount, nextTick } from 'vue';
import stageIcons from '../image/stage_toolbar';
import { usePathToolService } from '../services';

const show = ref(false);
const popup = ref(null);

const pathTool = usePathToolService();
const operations = [
  { name: 'Path', icon: stageIcons.path, action: () => pathTool.apply() },
];

function toggle() {
  show.value = !show.value;
}

function close() {
  show.value = false;
}

function execute(op) {
  if (op && typeof op.action === 'function') {
    op.action();
  }
  close();
}

function handleOutside(event) {
  if (popup.value && !popup.value.contains(event.target)) {
    close();
  }
}

watch(show, (val) => {
  if (val) {
    nextTick(() => document.addEventListener('pointerdown', handleOutside));
  } else {
    document.removeEventListener('pointerdown', handleOutside);
  }
});

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleOutside);
});

defineExpose({ show, toggle, close });
</script>

<style scoped>
</style>
