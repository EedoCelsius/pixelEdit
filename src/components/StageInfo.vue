<template>
  <div class="flex items-center gap-3 text-sm px-3 py-2">
    <div>원본: <span class="text-slate-200">{{ stageStore.canvas.width }}×{{ stageStore.canvas.height }}</span></div>
    <div>확대: <span class="text-slate-200">{{ stageStore.canvas.scale.toFixed(1) }}x</span></div>
    <div>선택 영역 픽셀 수: <span class="text-slate-200">{{ selectedAreaPixelCount }}</span></div>
    <div class="flex-1"></div>
    <div class="text-xs text-slate-400">{{ stageStore.pixelInfo }}</div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useStageStore } from '../stores/stage';
import { useLayerStore } from '../stores/layers';
import { getPixelUnionSet } from '../utils';

const stageStore = useStageStore();
const layers = useLayerStore();
const selectedAreaPixelCount = computed(() => {
    const pixelSet = getPixelUnionSet(layers, layers.selectedIds);
    return pixelSet.size;
  });
</script>
