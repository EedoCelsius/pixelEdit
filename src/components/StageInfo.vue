<template>
  <div class="flex items-center gap-3 text-sm px-3 py-2">
    <div>원본: <span class="text-slate-200">{{ stageStore.canvas.width }}×{{ stageStore.canvas.height }}</span></div>
    <div>확대: <span class="text-slate-200">{{ stageStore.canvas.scale }}x</span></div>
    <div>선택 영역 픽셀 수: <span class="text-slate-200">{{ selectedAreaPixelCount }}</span></div>
    <div class="flex-1"></div>
    <div class="text-xs text-slate-400">{{ stageStore.pixelInfo }}</div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useStageStore } from '../stores/stage';
import { useLayerStore } from '../stores/layers';
import { useSelectionStore } from '../stores/selection';
import { coordsToKey } from '../utils';

const stageStore = useStageStore();
const layers = useLayerStore();
const selection = useSelectionStore();
const selectedAreaPixelCount = computed(() => {
    const pixelSet = new Set();
    for (const id of selection.ids) {
        const layer = layers.get(id);
        if (!layer) continue;
        layer.forEachPixel((x, y) => pixelSet.add(coordsToKey(x, y)));
    }
    return pixelSet.size;
});
</script>
