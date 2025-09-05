<template>
    <div class="flex items-center gap-2 p-2 flex-wrap">
      <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="onFileChange" />
      <button v-if="input.isLoaded" @click="viewportStore.toggleView" class="inline-flex items-center px-2 py-1 text-xs rounded-md border border-white/15 bg-white/5 hover:bg-white/10">{{ viewportStore.toggleLabel }}</button>
      <button v-else @click="openFileDialog" class="inline-flex items-center px-2 py-1 text-xs rounded-md border border-white/15 bg-white/5 hover:bg-white/10">Load</button>
      <!-- Stage resize -->
      <button @click="stageResizeService.open" title="Resize Canvas" class="p-1 rounded-md border border-white/15 bg-white/5 hover:bg-white/10">
        <img :src="stageIcons.resize" alt="resize" class="w-4 h-4">
      </button>
        <div class="h-4 w-px bg-white/10 mx-1"></div>

      <!-- Shape toggle -->
      <div class="relative">
        <div class="inline-flex rounded-md overflow-hidden border border-white/15">
          <button @click="setStroke"
                  :title="'Stroke'"
                  :class="`p-1 ${toolSelectionService.isStroke ? 'bg-white/15' : 'bg-white/5 hover:bg-white/10'}`">
            <img :src="stageIcons.stroke" alt="Stroke" class="w-4 h-4">
          </button>
          <button @click="setRect"
                  :title="'Rect'"
                  :class="`p-1 ${toolSelectionService.isRect ? 'bg-white/15' : 'bg-white/5 hover:bg-white/10'}`">
            <img :src="stageIcons.rect" alt="Rect" class="w-4 h-4">
          </button>
          <button @click="toggleWand"
                  :title="'Wand'"
                  :class="`p-1 ${wandVisible ? 'bg-white/15' : 'bg-white/5 hover:bg-white/10'}`">
            <img :src="stageIcons.wand" alt="Wand" class="w-4 h-4">
          </button>
        </div>
        <WandPopup ref="wandPopup" />
      </div>

      <!-- Tool Toggles -->
      <div class="inline-flex rounded-md overflow-hidden border border-white/15">
        <button v-for="tool in selectables" :key="tool.type"
                @click="toolSelectionService.setPrepared(tool.type)"
                :title="tool.name"
                :class="`p-1 ${toolSelectionService.prepared === tool.type ? 'bg-white/15' : 'bg-white/5 hover:bg-white/10'}`">
          <img v-if="tool.icon" :src="tool.icon" :alt="tool.name" class="w-4 h-4">
          <span v-else class="text-xs">{{ tool.label || tool.name }}</span>
        </button>
      </div>

      <div class="flex-1"></div>

      <button @click="output.undo" title="Undo" class="p-1 rounded-md border border-white/15 bg-white/5 hover:bg-white/10">
        <img :src="stageIcons.undo" alt="Undo" class="w-4 h-4">
      </button>
        <button @click="output.redo" title="Redo" class="p-1 rounded-md border border-white/15 bg-white/5 hover:bg-white/10">
          <img :src="stageIcons.redo" alt="Redo" class="w-4 h-4">
        </button>
        <button @click="settingsService.open" title="Settings" class="p-1 rounded-md border border-white/15 bg-white/5 hover:bg-white/10">
          <img :src="stageIcons.settings" alt="settings" class="w-4 h-4">
        </button>
      </div>
    </template>

<script setup>
import { ref, watch, computed } from 'vue';
import { useStore } from '../stores';
import { useService } from '../services';
import { SINGLE_SELECTION_TOOLS, MULTI_SELECTION_TOOLS } from '@/constants';
import stageIcons from '../image/stage_toolbar';
import WandPopup from './WandPopup.vue';

const { viewport: viewportStore, nodeTree, input, output } = useStore();
const { toolSelection: toolSelectionService, stageResize: stageResizeService, imageLoad: imageLoadService, settings: settingsService } = useService();
const wandPopup = ref(null);
const wandVisible = computed(() => wandPopup.value?.show.value ?? false);
function toggleWand() {
  wandPopup.value?.toggle();
}
function setStroke() {
  wandPopup.value?.close();
  toolSelectionService.setShape('stroke');
}
function setRect() {
  wandPopup.value?.close();
  toolSelectionService.setShape('rect');
}

const fileInput = ref(null);
function openFileDialog() {
  fileInput.value?.click();
}
async function onFileChange(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  await input.loadFile(file);
  imageLoadService.open();
  e.target.value = '';
}

let lastSingleTool = 'draw';
let lastMultiTool = 'select';
const selectables = ref(MULTI_SELECTION_TOOLS);
toolSelectionService.setPrepared(lastMultiTool);
toolSelectionService.setShape('stroke');
watch(() => nodeTree.selectedLayerCount, (size, prev) => {
    if (size === 1) {
        if (prev !== 1) lastMultiTool = toolSelectionService.prepared;
        selectables.value = SINGLE_SELECTION_TOOLS;
        const tool = lastSingleTool;
        toolSelectionService.setPrepared(tool);
    }
    else if (prev === 1) {
        lastSingleTool = toolSelectionService.prepared;
        selectables.value = MULTI_SELECTION_TOOLS;
        const tool = lastMultiTool;
        toolSelectionService.setPrepared(tool);
    }
});

</script>
