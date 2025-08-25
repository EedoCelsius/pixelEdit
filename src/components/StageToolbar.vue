<template>
    <div class="flex items-center gap-2 p-2 flex-wrap">
      <button @click="stageStore.toggleView" class="inline-flex items-center px-2 py-1 text-xs rounded-md border border-white/15 bg-white/5 hover:bg-white/10">{{ stageStore.toggleLabel }}</button>

      <div class="h-4 w-px bg-white/10 mx-1"></div>

      <!-- Shape toggle -->
      <div class="inline-flex rounded-md overflow-hidden border border-white/15">
        <button @click="toolService.setShape('stroke')"
                :title="'Stroke'"
                :class="`p-1 ${toolService.isStroke ? 'bg-white/15' : 'bg-white/5 hover:bg-white/10'}`">
          <img :src="stageIcons.stroke" alt="Stroke" class="w-4 h-4">
        </button>
        <button @click="toolService.setShape('rect')"
                :title="'Rect'"
                :class="`p-1 ${toolService.isRect ? 'bg-white/15' : 'bg-white/5 hover:bg-white/10'}`">
          <img :src="stageIcons.rect" alt="Rect" class="w-4 h-4">
        </button>
      </div>

      <!-- Tool Toggles -->
      <div class="inline-flex rounded-md overflow-hidden border border-white/15">
        <button v-for="tool in selectables" :key="tool.type"
                @click="toolService.setPrepared(tool.type)"
                :title="tool.name"
                :class="`p-1 ${toolService.active === tool.type ? 'bg-white/15' : 'bg-white/5 hover:bg-white/10'}`">
          <img :src="tool.icon" :alt="tool.name" class="w-4 h-4">
        </button>
      </div>

      <div class="flex-1"></div>

      <button @click="undo" title="Undo" class="p-1 rounded-md border border-white/15 bg-white/5 hover:bg-white/10">
        <img :src="stageIcons.undo" alt="Undo" class="w-4 h-4">
      </button>
      <button @click="redo" title="Redo" class="p-1 rounded-md border border-white/15 bg-white/5 hover:bg-white/10">
        <img :src="stageIcons.redo" alt="Redo" class="w-4 h-4">
      </button>
    </div>
  </template>

<script setup>
import { ref, watch } from 'vue';
import { useStore } from '../stores';
import { useService } from '../services';
import { CTRL_TAP_THRESHOLD_MS, SINGLE_SELECTION_TOOLS, MULTI_SELECTION_TOOLS } from '@/constants';
import stageIcons from '../image/stage_toolbar';

const { stage: stageStore, layers, output, stageEvent: stageEvents } = useStore();
const { tool: toolService } = useService();

const selectables = ref(SINGLE_SELECTION_TOOLS);
watch(() => layers.selectionCount, (size) => {
  selectables.value = size === 1 ? SINGLE_SELECTION_TOOLS : MULTI_SELECTION_TOOLS;
  if (!selectables.value.some(tool => tool.type === toolService.prepared)) {
    toolService.setPrepared(size === 1 ? 'draw' : 'select');
  }
}, { immediate: true });

const undo = () => output.undo();
const redo = () => output.redo();

// Keyboard handlers
let ctrlKeyDownTimestamp = 0;
function ctrlKeyDown() {
  if (!stageEvents.ctrlHeld) {
    ctrlKeyDownTimestamp = performance.now();
    stageEvents.setCtrlHeld(true);
  }
}
function ctrlKeyUp() {
  if (performance.now() - ctrlKeyDownTimestamp < CTRL_TAP_THRESHOLD_MS) {
    const t = toolService.prepared;
    if (t === 'draw' || t === 'erase') {
      toolService.setPrepared(t === 'draw' ? 'erase' : 'draw');
    } else if (t === 'select' || t === 'globalErase') {
      toolService.setPrepared(t === 'select' ? 'globalErase' : 'select');
    }
  }
  stageEvents.setCtrlHeld(false);
  ctrlKeyDownTimestamp = 0;
}
function shiftKeyDown() { stageEvents.setShiftHeld(true); }
function shiftKeyUp() { stageEvents.setShiftHeld(false); }

defineExpose({ ctrlKeyDown, ctrlKeyUp, shiftKeyDown, shiftKeyUp });
</script>
