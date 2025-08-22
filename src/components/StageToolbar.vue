<template>
  <div class="flex items-center gap-2 p-2 flex-wrap">
    <button @click="stageStore.toggleView" class="inline-flex items-center px-2 py-1 text-xs rounded-md border border-white/15 bg-white/5 hover:bg-white/10">{{ stageStore.toggleLabel }}</button>

    <div class="h-4 w-px bg-white/10 mx-1"></div>

    <!-- Shape toggle -->
    <div class="inline-flex rounded-md overflow-hidden border border-white/15">
      <button @click="toolStore.setToolShape('stroke')" :class="buttonClass(toolStore.isStroke, false)">Stroke</button>
      <button @click="toolStore.setToolShape('rect')"   :class="buttonClass(toolStore.isRect, false)">Rect</button>
    </div>

    <!-- Tool Toggles -->
    <!-- Single Layer Mode Tools -->
    <div v-if="toolStore.effectiveMode === 'single'" class="inline-flex rounded-md overflow-hidden border border-white/15">
      <button @click="toolStore.setTool('draw')"  :class="buttonClass(toolStore.isDraw, false)">Draw</button>
      <button @click="toolStore.setTool('erase')" :class="buttonClass(toolStore.isErase, false)">Erase</button>
    </div>
    <!-- Multi Layer Mode Tools -->
    <div v-else class="inline-flex rounded-md overflow-hidden border border-white/15">
      <button @click="toolStore.setTool('select')" :class="buttonClass(toolStore.isSelect, false)">Select</button>
      <button @click="toolStore.setTool('globalErase')" :class="buttonClass(toolStore.isGlobalErase, false)">Global Erase</button>
    </div>
  </div>
</template>

<script setup>
import { useStageStore } from '../stores/stage';
import { useToolStore } from '../stores/tool';

const stageStore = useStageStore();
const toolStore = useToolStore();
const buttonClass = (active, disabled) => `px-2 py-1 text-xs ${disabled?'opacity-40 pointer-events-none cursor-not-allowed':''}${active&&!disabled?'bg-white/15':'bg-white/5 hover:bg-white/10'}`;
</script>
