<template>
  <div class="flex gap-2 items-stretch p-2">
    <div class="flex flex-col gap-1">
      <!-- 결과 -->
      <svg v-show="viewportStore.display!=='result'" :viewBox="viewportStore.viewBox" preserveAspectRatio="xMidYMid meet" class="w-44 h-44 rounded-md border border-white/15">
        <rect x="0" y="0" :width="viewportStore.stage.width" :height="viewportStore.stage.height" :fill="patternUrl"/>
        <g>
            <path v-for="props in nodes.getProperties(nodeTree.layerIdsBottomToTop)" :key="'pix-'+props.id" :d="pixelStore.pathOf(props.id)" fill-rule="evenodd" shape-rendering="crispEdges" :fill="rgbaCssU32(props.color)" :visibility="props.visibility?'visible':'hidden'"></path>
        </g>
      </svg>
      <!-- 원본 -->
        <img v-show="viewportStore.display!=='original'" class="w-44 h-44 object-contain rounded-md border border-white/15" :src="viewportStore.imageSrc" alt="source image"/>
    </div>
    <div class="flex-1 min-w-0 flex flex-col gap-2">
      <div class="flex gap-2 items-center">
        <select v-model="type" class="px-2 py-1 text-xs rounded-md border border-white/15 bg-slate-950">
          <option value="json">JSON</option>
          <option value="svg">SVG</option>
        </select>
        <button @click="download" class="px-2 py-1 text-xs rounded-md border border-white/15 bg-white/5 hover:bg-white/10">다운로드</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useStore } from '../stores';
import { rgbaCssU32 } from '../utils';
import { checkerboardPatternUrl } from '../utils/pixels.js';

const { viewport: viewportStore, nodeTree, nodes, pixels: pixelStore, output } = useStore();
const type = ref('json');

const patternUrl = checkerboardPatternUrl();
function download() {
    const data = type.value === 'json' ? output.exportToJSON() : output.exportToSVG();
    const blob = new Blob([data], { type: type.value === 'json' ? 'application/json' : 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = type.value === 'json' ? 'output.json' : 'output.svg';
    a.click();
    URL.revokeObjectURL(url);
}
</script>

<style scoped>
img {
  image-rendering: pixelated;
}
</style>
