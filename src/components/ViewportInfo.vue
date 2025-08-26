<template>
  <div class="flex items-center gap-3 text-sm px-3 py-2">
    <div>원본: <span class="text-slate-200">{{ viewportStore.stage.width }}×{{ viewportStore.stage.height }}</span></div>
    <div>확대: <span class="text-slate-200">{{ viewportStore.stage.scale.toFixed(1) }}x</span></div>
    <div>선택 영역 픽셀 수: <span class="text-slate-200">{{ selectedAreaPixelCount }}</span></div>
    <div class="flex-1"></div>
    <div class="text-xs text-slate-400">{{ viewportStore.pixelInfo }}</div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useStore } from '../stores';
import { getPixelUnion } from '../utils';

const { viewport: viewportStore, layers } = useStore();
const selectedAreaPixelCount = computed(() => {
    const pixels = getPixelUnion(layers.getProperties(layers.selectedIds));
    return pixels.length;
  });
</script>
