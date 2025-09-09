<template>
  <div class="flex items-center gap-3 text-sm px-3 py-2">
    <div>픽셀: <span class="text-slate-200">{{ viewportStore.stage.width }}×{{ viewportStore.stage.height }}</span></div>
    <div>확대: <span class="text-slate-200">{{ viewportStore.stage.scale.toFixed(1) }}x</span></div>
    <div>영역 내 픽셀 수: <span class="text-slate-200">{{ selectedAreaPixelCount }}</span></div>
    <div class="flex-1"></div>
    <div class="text-xs text-slate-400">{{ pixelInfo }}</div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useStore } from '../stores';
import { useService } from '../services';
import { rgbaCssU32, rgbaCssObj } from '../utils';
import { getPixelUnion, indexToCoord } from '../utils/pixels.js';

const { viewport: viewportStore, nodeTree, nodes, pixels: pixelStore, input } = useStore();
const { toolSelection: toolSelectionService, layerQuery } = useService();

const selectedAreaPixelCount = computed(() => {
    const pixels = getPixelUnion(pixelStore.get(nodeTree.selectedLayerIds));
    return pixels.length;
  });

const pixelInfo = computed(() => {
    const pixel = toolSelectionService.previewPixels[0];
    if (pixel == null) return '-';
    const [px, py] = indexToCoord(pixel);
    if (viewportStore.display === 'original' && input.isLoaded) {
      const colorObject = input.readPixel(pixel);
      return `[${px},${py}] ${rgbaCssObj(colorObject)}`;
    } else {
      const id = layerQuery.topVisibleAt(pixel);
      const colorU32 = id ? nodes.color(id) : 0;
      return `[${px},${py}] ${rgbaCssU32(colorU32)}`;
    }
  });
</script>
