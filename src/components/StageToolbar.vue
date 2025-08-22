<template>
  <div class="flex items-center gap-2 p-2 flex-wrap">
    <button @click="stageStore.toggleView" class="inline-flex items-center px-2 py-1 text-xs rounded-md border border-white/15 bg-white/5 hover:bg-white/10">{{ stageStore.toggleLabel }}</button>

    <div class="h-4 w-px bg-white/10 mx-1"></div>

    <!-- Shape toggle -->
    <div class="inline-flex rounded-md overflow-hidden border border-white/15">
      <button @click="toolStore.setShape('stroke')"
              :class="`px-2 py-1 text-xs ${toolStore.isStroke ? 'bg-white/15' : 'bg-white/5 hover:bg-white/10'}`">
        Stroke
      </button>
      <button @click="toolStore.setShape('rect')"
              :class="`px-2 py-1 text-xs ${toolStore.isRect ? 'bg-white/15' : 'bg-white/5 hover:bg-white/10'}`">
        Rect
      </button>
    </div>

    <!-- Tool Toggles -->
    <div class="inline-flex rounded-md overflow-hidden border border-white/15">
      <button v-for="t in tools" :key="t"
              @click="toolStore.setStatic(t)"
              :class="`px-2 py-1 text-xs ${toolStore.expected === t ? 'bg-white/15' : 'bg-white/5 hover:bg-white/10'}`">
        {{ t.charAt(0).toUpperCase() + t.slice(1) }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useStageStore } from '../stores/stage';
import { useToolStore } from '../stores/tool';
import { useSelectionStore } from '../stores/selection';

const stageStore = useStageStore();
const toolStore = useToolStore();
const selection = useSelectionStore();

const tools = ref([]);
watch(() => selection.size, (size) => {
  const multi = size !== 1;
  tools.value = multi ? ['select', 'globalErase'] : ['draw', 'erase'];
  const defaultTool = multi ? 'select' : 'draw';
  if (!tools.value.includes(toolStore.static)) {
    toolStore.setStatic(defaultTool);
  }
}, { immediate: true });
</script>
