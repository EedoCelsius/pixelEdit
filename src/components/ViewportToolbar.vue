<template>
    <div class="flex items-center gap-2 p-2 flex-wrap">
      <button @click="viewportStore.toggleView" class="inline-flex items-center px-2 py-1 text-xs rounded-md border border-white/15 bg-white/5 hover:bg-white/10">{{ viewportStore.toggleLabel }}</button>
      <!-- Stage resize -->
      <button @click="stageResizeService.open" title="Resize Canvas" class="p-1 rounded-md border border-white/15 bg-white/5 hover:bg-white/10">
        <img :src="stageIcons.resize" alt="resize" class="w-4 h-4">
      </button>

      <div class="h-4 w-px bg-white/10 mx-1"></div>

      <!-- Shape toggle -->
      <div class="inline-flex rounded-md overflow-hidden border border-white/15">
        <button @click="toolSelectionService.setShape('stroke')"
                :title="'Stroke'"
                :class="`p-1 ${toolSelectionService.isStroke ? 'bg-white/15' : 'bg-white/5 hover:bg-white/10'}`">
          <img :src="stageIcons.stroke" alt="Stroke" class="w-4 h-4">
        </button>
        <button @click="toolSelectionService.setShape('rect')"
                :title="'Rect'"
                :class="`p-1 ${toolSelectionService.isRect ? 'bg-white/15' : 'bg-white/5 hover:bg-white/10'}`">
          <img :src="stageIcons.rect" alt="Rect" class="w-4 h-4">
        </button>
      </div>

      <!-- Tool Toggles -->
      <div class="inline-flex rounded-md overflow-hidden border border-white/15">
        <button v-for="tool in selectables" :key="tool.type"
                @click="toolSelectionService.setPrepared(tool.type)"
                :title="tool.name"
                :class="`p-1 ${toolSelectionService.prepared === tool.type ? 'bg-white/15' : 'bg-white/5 hover:bg-white/10'}`">
          <img :src="tool.icon" :alt="tool.name" class="w-4 h-4">
        </button>
      </div>

      <div class="flex-1"></div>

      <button @click="output.undo" title="Undo" class="p-1 rounded-md border border-white/15 bg-white/5 hover:bg-white/10">
        <img :src="stageIcons.undo" alt="Undo" class="w-4 h-4">
      </button>
      <button @click="output.redo" title="Redo" class="p-1 rounded-md border border-white/15 bg-white/5 hover:bg-white/10">
        <img :src="stageIcons.redo" alt="Redo" class="w-4 h-4">
      </button>
    </div>
  </template>

<script setup>
import { ref, watch } from 'vue';
import { useStore } from '../stores';
import { useService } from '../services';
import { SINGLE_SELECTION_TOOLS, MULTI_SELECTION_TOOLS, TOOL_MODIFIERS } from '@/constants';
import stageIcons from '../image/stage_toolbar';

const { viewport: viewportStore, nodeTree, output, keyboardEvent: keyboardEvents } = useStore();
const { toolSelection: toolSelectionService, stageResize: stageResizeService } = useService();

let previousTool = null;
let lastSingleTool = 'draw';
let lastMultiTool = 'select';
const selectables = ref(MULTI_SELECTION_TOOLS);
toolSelectionService.setPrepared(lastMultiTool);
toolSelectionService.setShape('stroke');

watch(() => keyboardEvents.recent.down, (downs) => {
    for (const e of downs) {
        const key = e.key.toLowerCase();
        const ctrl = e.ctrlKey || e.metaKey;
        const shift = e.shiftKey;
        if (ctrl) {
            if (key === 'z' && !shift) {
                e.preventDefault();
                output.undo();
                continue;
            }
            if (key === 'y' || (key === 'z' && shift)) {
                e.preventDefault();
                output.redo();
                continue;
            }
        }
        const map = TOOL_MODIFIERS[e.key];
        if (!map || e.repeat) continue;
        const change = map[toolSelectionService.prepared] ?? map.default;
        if (change) {
            previousTool = toolSelectionService.prepared;
            toolSelectionService.setPrepared(change);
            break;
        }
    }
});
watch(() => keyboardEvents.recent.up, (ups) => {
    for (const e of ups) {
        if (e.key === 'Shift') {
            if (toolSelectionService.prepared !== previousTool) {
                toolSelectionService.setPrepared(previousTool);
                break;
            }
        }
        if (e.key === 'Control' || e.key === 'Meta') {
            const down = keyboardEvents.get("keydown", e.key);
            if (!down || !down.repeat) continue;
            if (toolSelectionService.prepared !== previousTool) {
                toolSelectionService.setPrepared(previousTool);
                break;
            }
        }
    }
});
watch(() => nodeTree.selectedLayerCount, (size, prev) => {
    if (size === 1) {
        if (prev !== 1) lastMultiTool = toolSelectionService.prepared;
        selectables.value = SINGLE_SELECTION_TOOLS;
        const tool = lastSingleTool;
        toolSelectionService.setPrepared(tool);
        previousTool = tool;
    }
    else if (prev === 1) {
        lastSingleTool = toolSelectionService.prepared;
        selectables.value = MULTI_SELECTION_TOOLS;
        const tool = lastMultiTool;
        toolSelectionService.setPrepared(tool);
        previousTool = tool;
    }
});

</script>
