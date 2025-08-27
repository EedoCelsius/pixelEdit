<template>
    <div ref="container" class="flex flex-col lg:flex-row gap-3 flex-1 min-h-0 w-full">
      <!-- ===== 좌: 디스플레이 ===== -->
      <section
        class="rounded-xl border border-white/10 bg-sky-950/30 flex flex-col min-h-0 overflow-hidden"
        :style="displayStyle"
      >
        <h2 class="m-0 px-3 py-2 text-xs uppercase tracking-wide text-slate-300/90 border-b border-white/10">Display</h2>
        <viewport-toolbar ref="viewportToolbar" class="border-b border-white/10"></viewport-toolbar>
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
const { input, viewport: viewportStore, layers, output } = useStore();
const { layerPanel, query } = useService();
const viewportToolbar = ref(null);

// Width control between display and layers
const container = ref(null);
// Display starts at 2/3 of the width (66.67%), leaving 1/3 for layers
const leftWidth = ref((2 / 3) * 100);
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

// General key handler
function onKeydown(event) {
  const target = event.target;
  const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
  if (typing) return;

  const key = event.key.toLowerCase();
  const ctrl = event.ctrlKey || event.metaKey;
  const shift = event.shiftKey;

  switch (event.key) {
    case 'Control':
    case 'Meta':
      return viewportToolbar.value?.ctrlKeyDown(event);
    case 'Shift':
      return viewportToolbar.value?.shiftKeyDown(event);
    case 'ArrowUp':
      event.preventDefault();
      layerPanel.onArrowUp(shift, ctrl);
      return;
    case 'ArrowDown':
      event.preventDefault();
      layerPanel.onArrowDown(shift, ctrl);
      return;
    case 'Delete':
    case 'Backspace':
      event.preventDefault();
      if (!layers.selectionExists) return;
      output.setRollbackPoint();
      const belowId = query.below(query.lowermost(layers.selectedIds));
      const ids = layers.selectedIds;
      layers.deleteLayers(ids);
      layers.removeFromSelection(ids);
      const newSelect = layers.has(belowId) ? belowId : query.lowermost();
      layerPanel.setRange(newSelect, newSelect);
      layerPanel.setScrollRule({ type: "follow", target: newSelect });
      output.commit();
      return;
    case 'Enter':
         if (!ctrl && !shift) {
            const anchorId = layerPanel.anchorId;
            const row = document.querySelector(`.layer[data-id="${anchorId}"] .nameText`)
            if (row) {
                event.preventDefault();
                row.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
            }
        }
        return;
    case 'Escape':
      if (output.hasPendingRollback) {
        event.preventDefault();
        output.rollbackPending();
        return;
      }
      layers.clearSelection();
      return;
  }

  if (ctrl) {
    if (key === 'a') {
      event.preventDefault();
      layerPanel.selectAll();
    } else if (key === 'z' && !shift) {
      event.preventDefault();
      output.undo();
    } else if (key === 'y' || (key === 'z' && shift)) {
      event.preventDefault();
      output.redo();
    }
  }
}

function onKeyup(event) {
  switch (event.key) {
    case 'Control':
    case 'Meta':
      return viewportToolbar.value?.ctrlKeyUp(event);
    case 'Shift':
      return viewportToolbar.value?.shiftKeyUp(event);
  }
}

onMounted(async () => {
  try {
    await input.loadFromQuery();
  } catch {}
  if (!input.isLoaded) {
    viewportStore.setSize(21, 18);
  } else {
    viewportStore.setSize(input.width, input.height);
    viewportStore.setImage(input.src || '');
  }

  const autoSegments = input.isLoaded ? input.segment(40) : [];
  if (autoSegments.length) {
    for (let i = 0; i < autoSegments.length; i++) {
      const segment = autoSegments[i];
      layers.createLayer({
        name: `Auto ${i+1}`,
        color: segment.colorU32,
        visibility: true,
        pixels: segment.pixels
      });
    }
  } else {
    layers.createLayer({});
    layers.createLayer({});
  }

  layerPanel.setScrollRule({ type: "follow", target: layers.order[layers.order.length - 1] });

  window.addEventListener('keydown', onKeydown);
  window.addEventListener('keyup', onKeyup);
  window.addEventListener('blur', () => {
    viewportToolbar.value?.ctrlKeyUp();
    viewportToolbar.value?.shiftKeyUp();
  });
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
