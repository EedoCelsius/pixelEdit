<template>
  <div class="flex gap-2 items-stretch p-2">
    <div class="flex flex-col gap-1">
      <!-- 결과 -->
      <svg v-show="viewportStore.display!=='result'" :viewBox="viewportStore.viewBox" preserveAspectRatio="xMidYMid meet" class="w-44 h-44 rounded-md border border-white/15">
        <rect x="0" y="0" :width="viewportStore.stage.width" :height="viewportStore.stage.height" :fill="patternUrl"/>
        <LayerSvg :nodes="layers.tree" />
      </svg>
      <!-- 원본 -->
        <img v-show="viewportStore.display!=='original'" class="w-44 h-44 object-contain rounded-md border border-white/15" :src="viewportStore.imageSrc" alt="source image"/>
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
import { ref, computed, onMounted, nextTick, h, defineComponent } from 'vue';
import { useStore } from '../stores';
import { rgbaCssU32, ensureCheckerboardPattern } from '../utils';

const { viewport: viewportStore, layers, output } = useStore();
const text = ref('');
const textareaElement = ref(null);

const patternUrl = computed(() => `url(#${ensureCheckerboardPattern(document.body)})`);

const LayerSvg = defineComponent({
    name: 'LayerSvg',
    props: { nodes: { type: Array, required: true } },
    setup(props) {
        return () => props.nodes.map(node => {
            if (node.type === 'group') {
                return h('g', { key: 'g'+node.id, visibility: node.visibility?'visible':'hidden' }, [
                    h(LayerSvg, { nodes: node.children })
                ]);
            }
            return h('path', {
                key: 'p'+node.id,
                d: layers.pathOf(node.id),
                fill: rgbaCssU32(node.color),
                visibility: node.visibility?'visible':'hidden',
                'fill-rule': 'evenodd',
                'shape-rendering': 'crispEdges'
            });
        });
    }
});

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

<style scoped>
img {
  image-rendering: pixelated;
}
</style>
