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
      <div class="relative flex">
        <div class="inline-flex rounded-md overflow-hidden border border-white/15">
          <button @click="setShape('stroke')"
                  :title="'Stroke'"
                  :disabled="wandWorking"
                  :class="`p-1 ${toolSelectionService.isStroke ? 'bg-white/15' : 'bg-white/5 hover:bg-white/10'} ${wandWorking ? 'opacity-50 cursor-not-allowed' : ''}`">
            <img :src="stageIcons.stroke" alt="Stroke" class="w-4 h-4">
          </button>
          <button @click="setShape('rect')"
                  :title="'Rect'"
                  :disabled="wandWorking"
                  :class="`p-1 ${toolSelectionService.isRect ? 'bg-white/15' : 'bg-white/5 hover:bg-white/10'} ${wandWorking ? 'opacity-50 cursor-not-allowed' : ''}`">
            <img :src="stageIcons.rect" alt="Rect" class="w-4 h-4">
          </button>
          <button @click="openWand"
                  :title="'Wand'"
                  :disabled="wandWorking"
                  :class="`p-1 ${toolSelectionService.isWand ? 'bg-white/15' : 'bg-white/5 hover:bg-white/10'} ${wandWorking ? 'opacity-50 cursor-not-allowed' : ''}`">
            <img :src="stageIcons.wand" alt="Wand" class="w-4 h-4">
          </button>
        </div>
        <WandPopup id="wandPopup" v-if="wandOpen" @select="selectWandTool" />
      </div>

      <!-- Tool Toggles -->
      <div class="inline-flex rounded-md overflow-hidden border border-white/15">
        <button v-for="tool in toolbarStore.tools" :key="tool.type"
                @click="toolSelectionService.addPrepared(tool)"
                :title="tool.name"
                :disabled="!tool.usable"
                :class="`p-1 ${toolSelectionService.current === tool.type ? 'bg-white/15' : 'bg-white/5 hover:bg-white/10'} ${!tool.usable ? 'opacity-50 cursor-not-allowed' : ''}`">
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
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useStore } from '../stores';
import { useService } from '../services';
import { WAND_TOOLS } from '@/constants';
import stageIcons from '../image/stage_toolbar';
import WandPopup from './WandPopup.vue';

const { viewport: viewportStore, input, output, toolbar: toolbarStore } = useStore();
const { toolSelection: toolSelectionService, stageResize: stageResizeService, imageLoad: imageLoadService, settings: settingsService, tools } = useService();

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

toolSelectionService.setShape('stroke');

const wandOpen = ref(false);
const wandToolTypes = new Set(WAND_TOOLS.map(t => t.type));
const wandWorking = computed(() => wandToolTypes.has(toolSelectionService.current));

function openWand() {
  wandOpen.value = true;
  toolSelectionService.setShape('wand');
}

function selectWandTool(tool) {
  wandOpen.value = false;
  const serviceTool = tools[tool.type];
  if (serviceTool) toolSelectionService.addPrepared({ ...tool, usable: serviceTool.usable });
}

function closeWand() {
  wandOpen.value = false;
  toolSelectionService.useRecent();
}

function setShape(shape) {
  if (wandOpen.value) closeWand();
  toolSelectionService.setShape(shape);
}

function handleClickOutside(e) {
  if (!wandOpen.value) return;
  if (!e.target.closest("#wandPopup")) {
    toolSelectionService.setShape('stroke');
    closeWand();
  }
}

onMounted(() => document.addEventListener('mousedown', handleClickOutside));
onBeforeUnmount(() => document.removeEventListener('mousedown', handleClickOutside));

</script>
