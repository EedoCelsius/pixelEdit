<template>
  <div class="flex items-center justify-between p-2">
    <div class="flex items-center gap-2">
      <input ref="fileInput" type="file" accept=".json,image/*" class="hidden" @change="onFileChange" />
      <button @click="openFileDialog" class="px-2 py-1 text-xs rounded-md border border-white/15 bg-white/5 hover:bg-white/10">Load</button>
      <button v-if="input.isLoaded" @click="viewportStore.toggleView" class="px-2 py-1 text-xs rounded-md border border-white/15 bg-white/5 hover:bg-white/10">{{ viewportStore.toggleLabel }}</button>
    </div>
    <div class="flex items-center gap-2">
      <select v-model="type" class="px-2 py-1 text-xs rounded-md border border-white/15 bg-slate-950">
        <option value="svg">SVG</option>
        <option value="json">JSON</option>
      </select>
      <button @click="download" class="px-2 py-1 text-xs rounded-md border border-white/15 bg-white/5 hover:bg-white/10">다운로드</button>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useStore } from '../stores';
import { useService } from '../services';
const { output, input, viewport: viewportStore } = useStore();
const { imageLoad: imageLoadService } = useService();
const type = ref(localStorage.getItem('downloadType') || 'json');
watch(type, (value) => localStorage.setItem('downloadType', value));

const fileInput = ref(null);
function openFileDialog() {
  fileInput.value?.click();
}

async function onFileChange(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  if (file.type === 'application/json' || file.name.endsWith('.json')) {
    const text = await file.text();
    await output.importFromJSON(text);
  } else {
    await input.loadFile(file);
    imageLoadService.open();
  }
  e.target.value = '';
}

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
