<template>
    <div ref="container" class="flex flex-col lg:flex-row gap-3 flex-1 min-h-0 w-full">
      <!-- ===== 좌: 디스플레이 ===== -->
      <section
        class="rounded-xl border border-white/10 bg-sky-950/30 flex flex-col min-h-0 overflow-hidden"
        :style="displayStyle"
      >
        <h2 class="m-0 px-3 py-2 text-xs uppercase tracking-wide text-slate-300/90 border-b border-white/10">Display</h2>
      <viewport-toolbar class="border-b border-white/10"></viewport-toolbar>
        <Viewport class="flex-1 min-h-0"></Viewport>
        <viewport-info class="border-t border-white/10"></viewport-info>
      </section>

      <!-- 드래그 핸들 -->
      <div
        class="hidden lg:block w-1 bg-white/20 cursor-col-resize"
        @mousedown="startDrag"
      ></div>

      <!-- ===== 우: 레이어 ===== -->
      <aside
        class="rounded-xl border border-white/10 bg-sky-950/30 flex flex-col min-h-0 overflow-hidden"
        :style="layersStyle"
      >
        <h2 class="m-0 px-3 py-2 text-xs uppercase tracking-wide text-slate-300/90 border-b border-white/10">Layers</h2>
        <layers-toolbar class="border-b border-white/10"></layers-toolbar>
        <layers-panel class="flex-1 min-h-0"></layers-panel>
        <export-panel class="border-t border-white/10"></export-panel>
      </aside>
    </div>
    <StageResizePopup />
    <ImageLoadPopup />
    <SettingsPopup />
    <ContextMenu />
</template>

<script setup>
import { onMounted, ref, computed, onUnmounted } from 'vue';
import { useStore } from './stores';
import { useService } from './services';

import Viewport from './components/Viewport.vue';
import ViewportInfo from './components/ViewportInfo.vue';
import LayersToolbar from './components/LayersToolbar.vue';
import LayersPanel from './components/LayersPanel.vue';
import ExportPanel from './components/ExportPanel.vue';
import ViewportToolbar from './components/ViewportToolbar.vue';
import StageResizePopup from './components/StageResizePopup.vue';
import ImageLoadPopup from './components/ImageLoadPopup.vue';
import SettingsPopup from './components/SettingsPopup.vue';
import ContextMenu from './components/ContextMenu.vue';
const { input } = useStore();
const { imageLoad: imageLoadService } = useService();

// Width control between display and layers
const container = ref(null);
const leftWidth = ref(70);
const isDragging = ref(false);

const displayStyle = computed(() => ({ width: `${leftWidth.value}%` }));
const layersStyle = computed(() => ({ width: `${100 - leftWidth.value}%` }));

function startDrag(event) {
  isDragging.value = true;
  event.preventDefault();
}

function onDrag(event) {
  if (!isDragging.value || !container.value) return;
  const rect = container.value.getBoundingClientRect();
  const percent = ((event.clientX - rect.left) / rect.width) * 100;
  leftWidth.value = Math.min(80, Math.max(20, percent));
}

function stopDrag() {
  isDragging.value = false;
}

onMounted(async () => {
  try {
    await input.loadFromQuery();
  } catch {}
  if (input.isLoaded) {
    imageLoadService.open();
  }
  window.addEventListener('mousemove', onDrag);
  window.addEventListener('mouseup', stopDrag);
});

onUnmounted(() => {
  window.removeEventListener('mousemove', onDrag);
  window.removeEventListener('mouseup', stopDrag);
});
</script>

<style>
/* Global styles from pixel.html */
[v-cloak]{display:none}

/* Scrollbar styling */
*{
  scrollbar-width:thin;
  scrollbar-color:rgba(71,85,105,.8) rgba(30,41,59,.5);
}
*::-webkit-scrollbar{
  width:8px;
  height:8px;
}
*::-webkit-scrollbar-track{
  background:rgba(30,41,59,.5);
}
*::-webkit-scrollbar-thumb{
  background-color:rgba(71,85,105,.8);
  border-radius:4px;
}
*::-webkit-scrollbar-thumb:hover{
  background-color:rgba(100,116,139,.8);
}
</style>
