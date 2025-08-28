<template>
  <div v-if="stageResizeService.show" class="fixed inset-0 flex items-center justify-center bg-black/50">
    <div class="bg-slate-800 px-14 pt-12 pb-14 rounded-lg text-xs space-y-2">
      <div class="relative w-80 h-64 mx-auto">
        <div class="absolute inset-0 border-2 border-dashed border-slate-500">
          <div class="absolute inset-0 flex flex-col items-center justify-center text-white/70 space-y-1">
            <label class="flex items-center gap-1">
              <span>W: {{ width }} →</span>
              <input type="number" v-model.number="newWidth" class="w-10 px-1 py-0.5 rounded bg-slate-700" />
            </label>
            <label class="flex items-center gap-1">
              <span>H: {{ height }} →</span>
              <input type="number" v-model.number="newHeight" class="w-10 px-1 py-0.5 rounded bg-slate-700" />
            </label>
          </div>
        </div>
        <label class="absolute top-7 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
          <span class="mb-1">Top</span>
          <input type="number" v-model.number="top" class="w-10 px-1 py-0.5 rounded bg-slate-700" />
          <button @click="adjust('top', 1)" class="absolute top-1/2 right-12 -translate-y-1/2 w-4 h-4 bg-slate-700 rounded text-white">▲</button>
          <button @click="adjust('top', -1)" class="absolute top-1/2 left-12 -translate-y-1/2 w-4 h-4 bg-slate-700 rounded text-white">▼</button>
        </label>
        <label class="absolute top-1/2 left-7 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
          <span class="mb-1">Left</span>
          <input type="number" v-model.number="left" class="w-10 px-1 py-0.5 rounded bg-slate-700" />
          <button @click="adjust('left', 1)" class="absolute top-1/2 right-12 -translate-y-1/2 w-4 h-4 bg-slate-700 rounded text-white">◀</button>
          <button @click="adjust('left', -1)" class="absolute top-1/2 left-12 -translate-y-1/2 w-4 h-4 bg-slate-700 rounded text-white">▶</button>
        </label>
        <label class="absolute bottom-1/2 right-7 translate-x-1/2 translate-y-1/2 flex flex-col items-center">
          <span class="mb-1">Right</span>
          <input type="number" v-model.number="right" class="w-10 px-1 py-0.5 rounded bg-slate-700" />
          <button @click="adjust('right', 1)" class="absolute bottom-1/2 left-12 translate-y-1/2 w-4 h-4 bg-slate-700 rounded text-white">▶</button>
          <button @click="adjust('right', -1)" class="absolute bottom-1/2 right-12 translate-y-1/2 w-4 h-4 bg-slate-700 rounded text-white">◀</button>
        </label>
        <label class="absolute bottom-7 right-1/2 translate-x-1/2 translate-y-1/2 flex flex-col items-center">
          <span class="mb-1">Bottom</span>
          <input type="number" v-model.number="bottom" class="w-10 px-1 py-0.5 rounded bg-slate-700" />
          <button @click="adjust('bottom', 1)" class="absolute bottom-1/2 left-12 translate-y-1/2 w-4 h-4 bg-slate-700 rounded text-white">▼</button>
          <button @click="adjust('bottom', -1)" class="absolute bottom-1/2 right-12 translate-y-1/2 w-4 h-4 bg-slate-700 rounded text-white">▲</button>
        </label>
        <div class="absolute -bottom-12 -right-8">
          <div class="flex justify-end gap-2">
            <button @click="close" class="px-2 py-1 rounded bg-white/5 hover:bg-white/10">Cancel</button>
            <button @click="apply" class="px-2 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white">Apply</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useService } from '../services';
import { useStore } from '../stores';

const { stageResize: stageResizeService } = useService();
const { viewport } = useStore();

const top = ref(0);
const bottom = ref(0);
const left = ref(0);
const right = ref(0);

const width = computed(() => viewport.stage.width);
const height = computed(() => viewport.stage.height);
const newWidth = computed({
  get() {
    return width.value + left.value + right.value;
  },
  set(val) {
    const delta = val - width.value;
    left.value = Math.floor(delta / 2);
    right.value = delta - left.value;
  },
});
const newHeight = computed({
  get() {
    return height.value + top.value + bottom.value;
  },
  set(val) {
    const delta = val - height.value;
    top.value = Math.floor(delta / 2);
    bottom.value = delta - top.value;
  },
});

function adjust(edge, delta) {
  if (edge === 'top') top.value += delta;
  else if (edge === 'bottom') bottom.value += delta;
  else if (edge === 'left') left.value += delta;
  else if (edge === 'right') right.value += delta;
}

function close() {
  stageResizeService.close();
}

function apply() {
  stageResizeService.apply({ top: top.value, bottom: bottom.value, left: left.value, right: right.value });
  top.value = bottom.value = left.value = right.value = 0;
}
</script>
