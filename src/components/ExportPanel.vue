<template>
  <div class="flex gap-2 items-stretch p-2">
    <div class="flex flex-col gap-1">
      <!-- 결과 -->
      <svg v-show="stageStore.display!=='result'" :viewBox="stageStore.viewBox" preserveAspectRatio="xMidYMid meet" class="w-44 h-44 rounded-md border border-white/15">
        <rect x="0" y="0" :width="stageStore.canvas.width" :height="stageStore.canvas.height" :fill="patternUrl"/>
        <g>
            <path v-for="props in layers.getProperties(layers.idsBottomToTop)" :key="'pix-'+props.id" :d="layers.pathOf(props.id)" fill-rule="evenodd" shape-rendering="crispEdges" :fill="rgbaCssU32(props.color)" :visibility="props.visible?'visible':'hidden'"></path>
        </g>
      </svg>
      <!-- 원본 -->
      <img v-show="stageStore.display!=='original'" class="w-44 h-44 object-contain rounded-md border border-white/15" :src="stageStore.imageSrc" alt="source image" style="image-rendering:pixelated"/>
    </div>
    <div class="flex-1 min-w-0 flex flex-col gap-2">
      <div class="flex gap-2 items-center">
        <button @click="generate" class="px-2 py-1 text-xs rounded-md border border-white/15 bg-white/5 hover:bg-white/10">JSON 내보내기</button>
        <button @click="copy" class="px-2 py-1 text-xs rounded-md border border-white/15 bg-white/5 hover:bg-white/10">복사</button>
        <button @click="selectAll" class="px-2 py-1 text-xs rounded-md border border-white/15 bg-white/5 hover:bg-white/10">전체선택</button>
      </div>
      <textarea ref="textareaElement" readonly v-model="text" class="w-full h-28 resize-y rounded-md border border-white/15 bg-slate-950 text-sky-100 p-2 text-sm"></textarea>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue';
import { useStageStore } from '../stores/stage';
import { useStageService } from '../services/stage';
import { useLayerStore } from '../stores/layers';
import { useOutputStore } from '../stores/output';
import { rgbaCssU32 } from '../utils';

const stageStore = useStageStore();
const stageService = useStageService();
const layers = useLayerStore();
const output = useOutputStore();
const text = ref('');
const textareaElement = ref(null);

const patternUrl = computed(() => `url(#${stageService.ensureCheckerboardPattern(document.body)})`);

function generate() {
    text.value = output.exportToJSON();
}
async function copy() {
    if (!text.value) generate();
    try {
        await navigator.clipboard.writeText(text.value);
    } catch {}
}

function selectAll() {
    nextTick(() => {
        textareaElement.value?.select?.();
    });
}
onMounted(() => generate());
</script>
