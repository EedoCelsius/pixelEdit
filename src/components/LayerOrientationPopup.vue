<template>
  <div v-if="layerOrientation.show" class="fixed inset-0 flex items-center justify-center bg-black/50 layer-orientation-popup">
    <div class="bg-slate-800 p-6 rounded-lg text-xs w-60 space-y-4">
      <label class="block text-white/70">
        <span>Orientation</span>
        <select v-model="layerOrientation.orientation" class="mt-1 w-full rounded bg-slate-700 px-2 py-1">
          <option v-for="ori in orientations" :key="ori" :value="ori">{{ ORIENTATION_LABELS[ori] }}</option>
        </select>
      </label>
      <div v-if="layerOrientation.orientation === 'checkerboard'" class="flex gap-2">
        <select v-model="layerOrientation.cbOriA" class="flex-1 rounded bg-slate-700 px-2 py-1">
          <option v-for="ori in pixelOrientations" :key="ori" :value="ori">{{ ORIENTATION_LABELS[ori] }}</option>
        </select>
        <select v-model="layerOrientation.cbOriB" class="flex-1 rounded bg-slate-700 px-2 py-1">
          <option v-for="ori in pixelOrientations" :key="ori" :value="ori">{{ ORIENTATION_LABELS[ori] }}</option>
        </select>
      </div>
      <div class="flex justify-end gap-2">
        <button @click="layerOrientation.close" class="px-2 py-1 rounded bg-white/5 hover:bg-white/10">Cancel</button>
        <button @click="layerOrientation.apply" class="px-2 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white">Apply</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { PIXEL_DEFAULT_ORIENTATIONS, ORIENTATION_LABELS, PIXEL_ORIENTATIONS } from '@/constants/orientation.js';
import { useService } from '../services';

const { layerOrientation } = useService();
const orientations = PIXEL_DEFAULT_ORIENTATIONS;
const pixelOrientations = PIXEL_ORIENTATIONS;
</script>
