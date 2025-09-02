<template>
  <div v-if="imageLoadService.show" class="fixed inset-0 flex items-center justify-center bg-black/50">
    <div class="bg-slate-800 p-6 rounded-lg text-xs space-y-4 w-64">
      <div class="space-y-2 text-white/70">
        <label class="block">
          <span>Default Direction</span>
          <select v-model="direction" class="mt-1 w-full rounded bg-slate-700 px-2 py-1">
            <option v-for="dir in directions" :key="dir" :value="dir">{{ dir }}</option>
          </select>
        </label>
        <label class="flex items-center gap-2">
          <input type="checkbox" v-model="initialize" class="rounded bg-slate-700" />
          <span>Initialize Layers</span>
        </label>
        <label v-if="initialize" class="block">
          <span>Segment Tolerance</span>
          <input type="number" v-model.number="tolerance" class="mt-1 w-full rounded bg-slate-700 px-2 py-1" />
        </label>
      </div>
      <div class="flex justify-end gap-2">
        <button @click="cancel" class="px-2 py-1 rounded bg-white/5 hover:bg-white/10">Cancel</button>
        <button @click="apply" class="px-2 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white">Apply</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useService } from '../services';
import { PIXEL_DEFAULT_DIRECTIONS } from '@/stores/pixels';

const { imageLoad: imageLoadService } = useService();

const directions = PIXEL_DEFAULT_DIRECTIONS;
const direction = ref(directions[0]);
const initialize = ref(true);
const tolerance = ref(40);

function apply() {
  imageLoadService.apply({ direction: direction.value, initialize: initialize.value, tolerance: tolerance.value });
}

function cancel() {
  imageLoadService.cancel();
}
</script>
