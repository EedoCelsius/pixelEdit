<template>
  <div v-if="stageResizeService.show" class="fixed inset-0 flex items-center justify-center bg-black/50">
    <div class="bg-slate-800 p-4 rounded-md text-xs space-y-2">
      <div class="grid grid-cols-2 gap-2">
        <label class="flex flex-col">
          <span class="mb-1">Top</span>
          <input type="number" v-model.number="top" class="px-1 py-0.5 rounded bg-slate-700" />
        </label>
        <label class="flex flex-col">
          <span class="mb-1">Bottom</span>
          <input type="number" v-model.number="bottom" class="px-1 py-0.5 rounded bg-slate-700" />
        </label>
        <label class="flex flex-col">
          <span class="mb-1">Left</span>
          <input type="number" v-model.number="left" class="px-1 py-0.5 rounded bg-slate-700" />
        </label>
        <label class="flex flex-col">
          <span class="mb-1">Right</span>
          <input type="number" v-model.number="right" class="px-1 py-0.5 rounded bg-slate-700" />
        </label>
      </div>
      <div class="flex justify-end gap-2 pt-2">
        <button @click="close" class="px-2 py-1 rounded bg-white/5 hover:bg-white/10">Cancel</button>
        <button @click="apply" class="px-2 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white">Apply</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useService } from '../services';

const { stageResize: stageResizeService } = useService();

const top = ref(0);
const bottom = ref(0);
const left = ref(0);
const right = ref(0);

function close() {
  stageResizeService.close();
}

function apply() {
  stageResizeService.apply({ top: top.value, bottom: bottom.value, left: left.value, right: right.value });
  top.value = bottom.value = left.value = right.value = 0;
}
</script>
