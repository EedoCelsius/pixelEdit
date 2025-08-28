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
import { getPixelUnion, rgbaCssU32, rgbaCssObj } from '../utils';

const { viewport: viewportStore, layers, input } = useStore();
const { toolSelection: toolSelectionService } = useService();

const selectedAreaPixelCount = computed(() => {
    const pixels = getPixelUnion(layers.getProperties(layers.selectedIds));
    return pixels.length;
  });

const pixelInfo = computed(() => {
    const coord = toolSelectionService.previewPixels[0];
    if (!coord) return '-';
    const [px, py] = coord;
    if (viewportStore.display === 'original' && input.isLoaded) {
      const colorObject = input.readPixel(coord);
      return `[${px},${py}] ${rgbaCssObj(colorObject)}`;
    } else {
      const colorU32 = layers.compositeColorAt(coord);
      return `[${px},${py}] ${rgbaCssU32(colorU32)}`;
    }
  });
</script>
