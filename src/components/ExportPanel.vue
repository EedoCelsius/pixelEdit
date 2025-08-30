<template>
  <div class="flex gap-2 items-stretch p-2">
    <div class="flex flex-col gap-1">
      <!-- 결과 -->
      <svg v-show="viewportStore.display!=='result'" :viewBox="viewportStore.viewBox" preserveAspectRatio="xMidYMid meet" class="w-44 h-44 rounded-md border border-white/15">
        <rect x="0" y="0" :width="viewportStore.stage.width" :height="viewportStore.stage.height" :fill="patternUrl"/>
        <g>
            <path v-for="props in nodes.getProperties(nodeTree.layerIdsBottomToTop)" :key="'pix-'+props.id" :d="pixelStore.pathOfLayer(props.id)" fill-rule="evenodd" shape-rendering="crispEdges" :fill="rgbaCssU32(props.color)" :visibility="props.visibility?'visible':'hidden'"></path>
        </g>
      </svg>
      <!-- 원본 -->
        <img v-show="viewportStore.display!=='original'" class="w-44 h-44 object-contain rounded-md border border-white/15" :src="viewportStore.imageSrc" alt="source image"/>
    </div>
    <div class="flex-1 min-w-0 flex flex-col gap-2">
      <div class="flex gap-2 items-center">
        <button @click="generate" class="px-2 py-1 text-xs rounded-md border border-white/15 bg-white/5 hover:bg-white/10">새로고침</button>
        <button @click="copy" class="px-2 py-1 text-xs rounded-md border border-white/15 bg-white/5 hover:bg-white/10">복사</button>
      </div>
      <textarea ref="textareaElement" readonly v-model="text" class="w-full h-28 resize-y rounded-md border border-white/15 bg-slate-950 text-sky-100 p-2 text-sm"></textarea>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue';
import { useStore } from '../stores';
import { rgbaCssU32, ensureCheckerboardPattern } from '../utils';

const { viewport: viewportStore, nodeTree, nodes, pixels: pixelStore, output } = useStore();
const text = ref('');
const textareaElement = ref(null);

const patternUrl = computed(() => `url(#${ensureCheckerboardPattern(document.body)})`);

function generate() {
    text.value = output.exportToJSON();
}
async function copy() {
    if (!text.value) generate();
    try {
        await navigator.clipboard.writeText(text.value);
    } catch {}
}

onMounted(() => generate());
</script>

<style scoped>
img {
  image-rendering: pixelated;
}
</style>
