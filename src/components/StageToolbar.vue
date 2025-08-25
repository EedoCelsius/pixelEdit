<template>
    <div class="flex items-center gap-2 p-2 flex-wrap">
      <button @click="stageStore.toggleView" class="inline-flex items-center px-2 py-1 text-xs rounded-md border border-white/15 bg-white/5 hover:bg-white/10">{{ stageStore.toggleLabel }}</button>

      <div class="h-4 w-px bg-white/10 mx-1"></div>

      <!-- Shape toggle -->
      <div class="inline-flex rounded-md overflow-hidden border border-white/15">
        <button @click="stageToolService.setShape('stroke')"
                :title="'Stroke'"
                :class="`p-1 ${stageToolService.isStroke ? 'bg-white/15' : 'bg-white/5 hover:bg-white/10'}`">
          <img :src="stageIcons.stroke" alt="Stroke" class="w-4 h-4">
        </button>
        <button @click="stageToolService.setShape('rect')"
                :title="'Rect'"
                :class="`p-1 ${stageToolService.isRect ? 'bg-white/15' : 'bg-white/5 hover:bg-white/10'}`">
          <img :src="stageIcons.rect" alt="Rect" class="w-4 h-4">
        </button>
      </div>

      <!-- Tool Toggles -->
      <div class="inline-flex rounded-md overflow-hidden border border-white/15">
        <button v-for="tool in selectables" :key="tool.type"
                @click="stageToolService.setPrepared(tool.type)"
                :title="tool.name"
                :class="`p-1 ${stageToolService.active === tool.type ? 'bg-white/15' : 'bg-white/5 hover:bg-white/10'}`">
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
import { SINGLE_SELECTION_TOOLS, MULTI_SELECTION_TOOLS } from '@/constants';
import stageIcons from '../image/stage_toolbar';

const { stage: stageStore, layers, output, viewportEvent: viewportEvents } = useStore();
const { stageTool: stageToolService } = useService();

const selectables = ref(SINGLE_SELECTION_TOOLS);
watch(() => layers.selectionCount, (size) => {
  selectables.value = size === 1 ? SINGLE_SELECTION_TOOLS : MULTI_SELECTION_TOOLS;
  if (!selectables.value.some(tool => tool.type === stageToolService.prepared)) {
    stageToolService.setPrepared(size === 1 ? 'draw' : 'select');
  }
}, { immediate: true });

const undo = () => output.undo();
const redo = () => output.redo();

// Keyboard handlers
const isCtrlDown = () => {
  const ctrl = viewportEvents.keyboard['Control'];
  const meta = viewportEvents.keyboard['Meta'];
  const check = (entry) => entry && (!entry.up || entry.down?.timeStamp > entry.up.timeStamp);
  return check(ctrl) || check(meta);
};
function ctrlKeyDown(e) {
  viewportEvents.setKeyDown(e);
}
function ctrlKeyUp(e) {
  if (e) {
    const down = viewportEvents.keyboard[e.key]?.down;
    if (down && !down.repeat) {
      const t = stageToolService.prepared;
      if (t === 'draw' || t === 'erase') {
        stageToolService.setPrepared(t === 'draw' ? 'erase' : 'draw');
      } else if (t === 'select' || t === 'globalErase') {
        stageToolService.setPrepared(t === 'select' ? 'globalErase' : 'select');
      }
    }
    viewportEvents.setKeyUp(e);
  } else {
    const ts = performance.now();
    viewportEvents.setKeyUp({ key: 'Control', type: 'keyup', timeStamp: ts });
    viewportEvents.setKeyUp({ key: 'Meta', type: 'keyup', timeStamp: ts });
  }
}
function shiftKeyDown(e) { viewportEvents.setKeyDown(e); }
function shiftKeyUp(e) { viewportEvents.setKeyUp(e || { key: 'Shift', type: 'keyup', timeStamp: performance.now() }); }

defineExpose({ ctrlKeyDown, ctrlKeyUp, shiftKeyDown, shiftKeyUp });
</script>
