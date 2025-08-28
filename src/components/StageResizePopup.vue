<template>
  <div v-if="stageResizeService.show" class="fixed inset-0 flex items-center justify-center bg-black/50">
    <div class="bg-slate-800 p-4 rounded-md text-xs space-y-2">
      <div class="grid grid-cols-3 grid-rows-3 gap-2 items-center justify-items-center">
        <div></div>
        <label class="flex flex-col items-center">
          <span class="mb-1">Top</span>
          <input type="number" v-model.number="top" class="w-16 px-1 py-0.5 rounded bg-slate-700" />
        </label>
        <div></div>

        <label class="flex flex-col items-center">
          <span class="mb-1">Left</span>
          <input type="number" v-model.number="left" class="w-16 px-1 py-0.5 rounded bg-slate-700" />
        </label>
        <div class="relative w-24 h-24 border-2 border-dashed border-slate-500">
          <button @click="adjust('top', 1)" class="absolute -top-5 left-1/2 -translate-x-1/2 w-4 h-4 bg-slate-700 rounded text-white">+</button>
          <button @click="adjust('top', -1)" class="absolute top-0 left-1/2 -translate-x-1/2 w-4 h-4 bg-slate-700 rounded text-white">-</button>
          <button @click="adjust('bottom', 1)" class="absolute -bottom-5 left-1/2 -translate-x-1/2 w-4 h-4 bg-slate-700 rounded text-white">+</button>
          <button @click="adjust('bottom', -1)" class="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-4 bg-slate-700 rounded text-white">-</button>
          <button @click="adjust('left', 1)" class="absolute top-1/2 -left-5 -translate-y-1/2 w-4 h-4 bg-slate-700 rounded text-white">+</button>
          <button @click="adjust('left', -1)" class="absolute top-1/2 left-0 -translate-y-1/2 w-4 h-4 bg-slate-700 rounded text-white">-</button>
          <button @click="adjust('right', 1)" class="absolute top-1/2 -right-5 -translate-y-1/2 w-4 h-4 bg-slate-700 rounded text-white">+</button>
          <button @click="adjust('right', -1)" class="absolute top-1/2 right-0 -translate-y-1/2 w-4 h-4 bg-slate-700 rounded text-white">-</button>
        </div>
        <label class="flex flex-col items-center">
          <span class="mb-1">Right</span>
          <input type="number" v-model.number="right" class="w-16 px-1 py-0.5 rounded bg-slate-700" />
        </label>

        <div></div>
        <label class="flex flex-col items-center">
          <span class="mb-1">Bottom</span>
          <input type="number" v-model.number="bottom" class="w-16 px-1 py-0.5 rounded bg-slate-700" />
        </label>
        <div></div>
      </div>
      <div class="text-center">W: {{ width }} → {{ newWidth }}, H: {{ height }} → {{ newHeight }}</div>
      <div class="flex justify-end gap-2 pt-2">
        <button @click="close" class="px-2 py-1 rounded bg-white/5 hover:bg-white/10">Cancel</button>
        <button @click="apply" class="px-2 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white">Apply</button>
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
const newWidth = computed(() => width.value + left.value + right.value);
const newHeight = computed(() => height.value + top.value + bottom.value);

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
