<template>
    <div class="flex items-center gap-2 p-2 flex-wrap">
      <button @click="stageStore.toggleView" class="inline-flex items-center px-2 py-1 text-xs rounded-md border border-white/15 bg-white/5 hover:bg-white/10">{{ stageStore.toggleLabel }}</button>

      <div class="h-4 w-px bg-white/10 mx-1"></div>

      <!-- Shape toggle -->
      <div class="inline-flex rounded-md overflow-hidden border border-white/15">
        <button @click="toolStore.setShape('stroke')"
                :title="'Stroke'"
                :class="`p-1 ${toolStore.isStroke ? 'bg-white/15' : 'bg-white/5 hover:bg-white/10'}`">
          <img :src="'image/stage_toolbar/stroke.svg'" alt="Stroke" class="w-4 h-4">
        </button>
        <button @click="toolStore.setShape('rect')"
                :title="'Rect'"
                :class="`p-1 ${toolStore.isRect ? 'bg-white/15' : 'bg-white/5 hover:bg-white/10'}`">
          <img :src="'image/stage_toolbar/rect.svg'" alt="Rect" class="w-4 h-4">
        </button>
      </div>

      <!-- Tool Toggles -->
      <div class="inline-flex rounded-md overflow-hidden border border-white/15">
        <button v-for="tool in selectables" :key="tool.type"
                @click="toolStore.setStatic(tool.type)"
                :title="tool.name"
                :class="`p-1 ${toolStore.expected === tool.type ? 'bg-white/15' : 'bg-white/5 hover:bg-white/10'}`">
          <img :src="tool.icon" :alt="tool.name" class="w-4 h-4">
        </button>
      </div>

      <div class="flex-1"></div>

      <button @click="undo" title="Undo" class="p-1 rounded-md border border-white/15 bg-white/5 hover:bg-white/10">
        <img :src="'image/stage_toolbar/undo.svg'" alt="Undo" class="w-4 h-4">
      </button>
      <button @click="redo" title="Redo" class="p-1 rounded-md border border-white/15 bg-white/5 hover:bg-white/10">
        <img :src="'image/stage_toolbar/redo.svg'" alt="Redo" class="w-4 h-4">
      </button>
    </div>
  </template>

<script setup>
import { reactive, watch } from 'vue';
import { useStageStore } from '../stores/stage';
import { useToolStore } from '../stores/tool';
import { useLayerStore } from '../stores/layers';
import { useOutputStore } from '../stores/output';

const stageStore = useStageStore();
const toolStore = useToolStore();
const layers = useLayerStore();
const output = useOutputStore();

const selectables = reactive([]);
watch(() => layers.selectionCount, (size) => {
  selectables.splice(0, selectables.length, ...(size === 1
    ? [
        { type: 'draw', name: 'Draw', icon: 'image/stage_toolbar/draw.svg' },
        { type: 'erase', name: 'Erase', icon: 'image/stage_toolbar/erase.svg' },
        { type: 'cut', name: 'Cut', icon: 'image/stage_toolbar/cut.svg' }
      ]
    : [
        { type: 'select', name: 'Select', icon: 'image/stage_toolbar/select.svg' },
        { type: 'globalErase', name: 'Global Erase', icon: 'image/stage_toolbar/global_erase.svg' }
      ]));
    if (!selectables.some(tool => tool.type === toolStore.static)) {
      toolStore.setStatic(size === 1 ? 'draw' : 'select');
    }
}, { immediate: true });

const undo = () => output.undo();
const redo = () => output.redo();

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
