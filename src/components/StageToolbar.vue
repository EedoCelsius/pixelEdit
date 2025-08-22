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
      <button v-for="tool in selectables" :key="tool.type"
              @click="toolStore.setStatic(tool.type)"
              :class="`px-2 py-1 text-xs ${toolStore.expected === tool.type ? 'bg-white/15' : 'bg-white/5 hover:bg-white/10'}`">
        {{ tool.name }}
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

const selectables = ref([]);
watch(() => selection.count, (size) => {
  selectables.value = size === 1 ? 
    [{ type: 'draw', name: 'Draw' }, { type: 'erase', name: 'Erase' }] :
    [{ type: 'select', name: 'Select' }, { type: 'globalErase', name: 'Global Erase' }];
  if (!selectables.value.includes(toolStore.static)) {
    toolStore.setStatic(size === 1 ? 'draw' : 'select');
  }
}, { immediate: true });

// Keyboard handlers
let ctrlKeyDownTimestamp = 0;
const KEY_TAP_MS = 200;
function ctrlKeyDown() {
  if (!toolStore.ctrlHeld) {
    ctrlKeyDownTimestamp = performance.now();
    toolStore.setCtrlHeld(true);
  }
}
function ctrlKeyUp() {
  if (performance.now() - ctrlKeyDownTimestamp < KEY_TAP_MS) {
    const t = toolStore.static;
    if (t === 'draw' || t === 'erase') {
      toolStore.setStatic(t === 'draw' ? 'erase' : 'draw');
    } else if (t === 'select' || t === 'globalErase') {
      toolStore.setStatic(t === 'select' ? 'globalErase' : 'select');
    }
  }
  toolStore.setCtrlHeld(false);
  ctrlKeyDownTimestamp = 0;
}
function shiftKeyDown() { toolStore.setShiftHeld(true); }
function shiftKeyUp() { toolStore.setShiftHeld(false); }

defineExpose({ ctrlKeyDown, ctrlKeyUp, shiftKeyDown, shiftKeyUp });
</script>
