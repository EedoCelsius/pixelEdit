<template>
  <div class="flex gap-2 items-center justify-end p-2">
    <select v-model="type" class="px-2 py-1 text-xs rounded-md border border-white/15 bg-slate-950">
      <option value="json">JSON</option>
      <option value="svg">SVG</option>
    </select>
    <button @click="download" class="px-2 py-1 text-xs rounded-md border border-white/15 bg-white/5 hover:bg-white/10">다운로드</button>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useStore } from '../stores';
const { output } = useStore();
const type = ref(localStorage.getItem('downloadType') || 'json');
watch(type, (value) => localStorage.setItem('downloadType', value));

function download() {
    const content = type.value === 'json' ? output.exportToJSON() : output.exportToSVG();
    const blob = new Blob([content], { type: type.value === 'json' ? 'application/json' : 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pixel-edit.${type.value}`;
    a.click();
    URL.revokeObjectURL(url);
}
</script>
