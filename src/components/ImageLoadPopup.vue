<template>
  <div v-if="imageLoadService.show" class="fixed inset-0 flex items-center justify-center bg-black/50">
    <div class="bg-slate-800 p-6 rounded-lg text-xs space-y-4 w-64">
      <div class="space-y-2 text-white/70">
        <label class="flex items-center gap-2">
          <input type="checkbox" v-model="imageLoadService.initialize" class="rounded bg-slate-700" />
          <span>Initialize Layers</span>
        </label>
        <label class="block" :class="{ 'opacity-50': !imageLoadService.initialize }">
          <span>Segment Tolerance</span>
          <input
            type="number"
            v-model.number="imageLoadService.tolerance"
            :disabled="!imageLoadService.initialize"
            class="mt-1 w-full rounded bg-slate-700 px-2 py-1 disabled:cursor-not-allowed"
          />
        </label>
        <label class="block">
          <span>Canvas Width</span>
          <input type="number" v-model.number="imageLoadService.canvasWidth" class="mt-1 w-full rounded bg-slate-700 px-2 py-1" />
        </label>
        <label class="block">
          <span>Canvas Height</span>
          <input type="number" v-model.number="imageLoadService.canvasHeight" class="mt-1 w-full rounded bg-slate-700 px-2 py-1" />
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
import { useService } from '../services';

const { imageLoad: imageLoadService } = useService();

function apply() {
  imageLoadService.apply();
}

function cancel() {
  imageLoadService.cancel();
}
</script>
