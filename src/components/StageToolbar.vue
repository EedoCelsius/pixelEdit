<template>
  <div class="flex items-center gap-2 p-2 flex-wrap">
    <button @click="stageStore.toggleView" class="inline-flex items-center px-2 py-1 text-xs rounded-md border border-white/15 bg-white/5 hover:bg-white/10">{{ stageStore.toggleLabel }}</button>

    <div class="h-4 w-px bg-white/10 mx-1"></div>

    <!-- Shape toggle -->
    <div class="inline-flex rounded-md overflow-hidden border border-white/15">
      <button @click="stageStore.setToolShape('stroke')" :class="buttonClass(stageStore.isStroke, false)">Stroke</button>
      <button @click="stageStore.setToolShape('rect')"   :class="buttonClass(stageStore.isRect, false)">Rect</button>
    </div>

    <!-- Tool Toggles -->
    <!-- Single Layer Mode Tools -->
    <div v-if="stageStore.effectiveMode === 'single'" class="inline-flex rounded-md overflow-hidden border border-white/15">
      <button @click="stageStore.setTool('draw')"  :class="buttonClass(stageStore.isDraw, false)">Draw</button>
      <button @click="stageStore.setTool('erase')" :class="buttonClass(stageStore.isErase, false)">Erase</button>
    </div>
    <!-- Multi Layer Mode Tools -->
    <div v-else class="inline-flex rounded-md overflow-hidden border border-white/15">
      <button @click="stageStore.setTool('select')" :class="buttonClass(stageStore.isSelect, false)">Select</button>
      <button @click="stageStore.setTool('globalErase')" :class="buttonClass(stageStore.isGlobalErase, false)">Global Erase</button>
    </div>
  </div>
</template>

<script setup>
import { useStageStore } from '../stores/stage';

const stageStore = useStageStore();
const buttonClass = (active, disabled) => `px-2 py-1 text-xs ${disabled?'opacity-40 pointer-events-none cursor-not-allowed':''} ${active&&!disabled?'bg-white/15':'bg-white/5 hover:bg-white/10'}`;
</script>
