<template>
  <div v-if="stageResizeService.show" class="fixed inset-0 flex items-center justify-center bg-black/50">
    <div class="bg-slate-800 px-14 pt-12 pb-14 rounded-lg text-xs space-y-2">
      <div class="relative w-80 h-64 mx-auto">
        <div class="absolute inset-0 border-2 border-dashed border-slate-500">
          <div class="absolute inset-0 flex flex-col items-center justify-center text-white/70 space-y-1">
            <label class="flex items-center gap-1">
              <span>W: {{ viewport.stage.width }} →</span>
              <input type="number" v-model.number="newWidth" class="w-10 px-1 py-0.5 rounded bg-slate-700" />
            </label>
            <label class="flex items-center gap-1">
              <span>H: {{ viewport.stage.height }} →</span>
              <input type="number" v-model.number="newHeight" class="w-10 px-1 py-0.5 rounded bg-slate-700" />
            </label>
          </div>
        </div>
        <label class="absolute top-7 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
          <span class="mb-1">Top</span>
          <input type="number" v-model.number="offsets.top" class="w-10 px-1 py-0.5 rounded bg-slate-700" />
          <button @click="offsets.top++" class="absolute top-1/2 right-12 -translate-y-1/2 w-4 h-4 bg-slate-700 rounded text-white">▲</button>
          <button @click="offsets.top--" class="absolute top-1/2 left-12 -translate-y-1/2 w-4 h-4 bg-slate-700 rounded text-white">▼</button>
        </label>
        <label class="absolute top-1/2 left-7 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
          <span class="mb-1">Left</span>
          <input type="number" v-model.number="offsets.left" class="w-10 px-1 py-0.5 rounded bg-slate-700" />
          <button @click="offsets.left++" class="absolute top-1/2 right-12 -translate-y-1/2 w-4 h-4 bg-slate-700 rounded text-white">◀</button>
          <button @click="offsets.left--" class="absolute top-1/2 left-12 -translate-y-1/2 w-4 h-4 bg-slate-700 rounded text-white">▶</button>
        </label>
        <label class="absolute bottom-1/2 right-7 translate-x-1/2 translate-y-1/2 flex flex-col items-center">
          <span class="mb-1">Right</span>
          <input type="number" v-model.number="offsets.right" class="w-10 px-1 py-0.5 rounded bg-slate-700" />
          <button @click="offsets.right++" class="absolute bottom-1/2 left-12 translate-y-1/2 w-4 h-4 bg-slate-700 rounded text-white">▶</button>
          <button @click="offsets.right--" class="absolute bottom-1/2 right-12 translate-y-1/2 w-4 h-4 bg-slate-700 rounded text-white">◀</button>
        </label>
        <label class="absolute bottom-7 right-1/2 translate-x-1/2 translate-y-1/2 flex flex-col items-center">
          <span class="mb-1">Bottom</span>
          <input type="number" v-model.number="offsets.bottom" class="w-10 px-1 py-0.5 rounded bg-slate-700" />
          <button @click="offsets.bottom++" class="absolute bottom-1/2 left-12 translate-y-1/2 w-4 h-4 bg-slate-700 rounded text-white">▼</button>
          <button @click="offsets.bottom--" class="absolute bottom-1/2 right-12 translate-y-1/2 w-4 h-4 bg-slate-700 rounded text-white">▲</button>
        </label>
        <div class="absolute -bottom-12 -right-8">
          <div class="flex justify-end gap-2">
            <button @click="stageResizeService.close" class="px-2 py-1 rounded bg-white/5 hover:bg-white/10">Cancel</button>
            <button @click="apply" class="px-2 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white">Apply</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive } from 'vue';
import { useService } from '../services';
import { useStore } from '../stores';

const { stageResize: stageResizeService } = useService();
const { viewport } = useStore();
const offsets = reactive({ top: 0, bottom: 0, left: 0, right: 0 });

const newWidth = computed({
  get() {
    return viewport.stage.width + offsets.left + offsets.right;
  },
  set(val) {
    const delta = val - viewport.stage.width;
    offsets.left = Math.floor(delta / 2);
    offsets.right = delta - offsets.left;
  },
});
const newHeight = computed({
  get() {
    return viewport.stage.height + offsets.top + offsets.bottom;
  },
  set(val) {
    const delta = val - viewport.stage.height;
    offsets.top = Math.floor(delta / 2);
    offsets.bottom = delta - offsets.top;
  },
});

function apply() {
  stageResizeService.apply(offsets);
  Object.assign(offsets, { top: 0, bottom: 0, left: 0, right: 0 });
};
</script>
