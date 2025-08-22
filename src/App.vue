<template>
    <div class="grid grid-cols-1 gap-3 lg:grid-cols-2 flex-1 min-h-0 w-full">
      <!-- ===== 좌: 디스플레이 ===== -->
      <section class="rounded-xl border border-white/10 bg-sky-950/30 flex flex-col min-h-0 overflow-hidden">
        <h2 class="m-0 px-3 py-2 text-xs uppercase tracking-wide text-slate-300/90 border-b border-white/10">Display</h2>
        <stage-toolbar class="border-b border-white/10"></stage-toolbar>
        <Stage class="flex-1 min-h-0"></Stage>
        <stage-info class="border-t border-white/10"></stage-info>
      </section>

      <!-- ===== 우: 레이어 ===== -->
      <aside class="rounded-xl border border-white/10 bg-sky-950/30 flex flex-col min-h-0 overflow-hidden">
        <h2 class="m-0 px-3 py-2 text-xs uppercase tracking-wide text-slate-300/90 border-b border-white/10">Layers</h2>
        <layers-toolbar class="border-b border-white/10"></layers-toolbar>
        <layers-panel class="flex-1 min-h-0"></layers-panel>
        <export-panel class="border-t border-white/10"></export-panel>
      </aside>
    </div>
</template>

<script setup>
import { onMounted, nextTick } from 'vue';
import { useInputStore } from './stores/input';
import { useStageStore } from './stores/stage';
import { useStageService } from './services/stage';
import { useLayerStore } from './stores/layers';
import { useSelectionStore } from './stores/selection';
import { useLayerService } from './services/layers';
import { useSelectService } from './services/select';
import { useOutputStore } from './stores/output';

import StageToolbar from './components/StageToolbar.vue';
import Stage from './components/Stage.vue';
import StageInfo from './components/StageInfo.vue';
import LayersToolbar from './components/LayersToolbar.vue';
import LayersPanel from './components/LayersPanel.vue';
import ExportPanel from './components/ExportPanel.vue';

const input = useInputStore();
const stageStore = useStageStore();
const stageService = useStageService();
const layers = useLayerStore();
const selection = useSelectionStore();
const layerSvc = useLayerService();
const selectSvc = useSelectService();
const output = useOutputStore();

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
      return stageService.ctrlKeyDown();
    case 'Shift':
      return stageService.shiftKeyDown();
    case 'ArrowUp':
      event.preventDefault();
      if (!layers.exists) return;
      if (shift && !ctrl) {
        if (!selection.exists) return;
        const newTail = layerSvc.aboveId(selection.tailId) ?? layerSvc.uppermostId();
        selectSvc.selectRange(selection.anchorId, newTail);
        selection.setScrollRule({ type: 'follow-up', target: newTail });
      } else if (!ctrl) {
        const nextId = layerSvc.aboveId(selection.anchorId) ?? selection.anchorId;
        selection.selectOnly(nextId);
        selection.setScrollRule({ type: 'follow-up', target: nextId });
      }
      return;
    case 'ArrowDown':
      event.preventDefault();
      if (!layers.exists) return;
      if (shift && !ctrl) {
        if (!selection.exists) return;
        const newTail = layerSvc.belowId(selection.tailId) ?? layerSvc.lowermostId();
        selectSvc.selectRange(selection.anchorId, newTail);
        selection.setScrollRule({ type: 'follow-down', target: newTail });
      } else if (!ctrl) {
        const nextId = layerSvc.belowId(selection.anchorId) ?? selection.anchorId;
        selection.selectOnly(nextId);
        selection.setScrollRule({ type: 'follow-down', target: nextId });
      }
      return;
    case 'Delete':
    case 'Backspace':
      event.preventDefault();
      if (!selection.exists) return;
      output.setRollbackPoint();
      const belowId = layerSvc.belowId(layerSvc.lowermostIdOf(selection.asArray));
      layerSvc.deleteSelected();
      const newSelect = layers.layersById[belowId] ? belowId : layerSvc.lowermostId();
      selection.selectOnly(newSelect);
      selection.setScrollRule({ type: "follow", target: newSelect });
      output.commit();
      return;
    case 'Enter':
         if (!ctrl && !shift) {
            const anchorId = selection.anchorId;
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
      selection.clear();
      return;
  }
  
  if (ctrl) {
    if (key === 'a') {
      event.preventDefault();
      const anchor = layerSvc.uppermostId(), tail = layerSvc.lowermostId();
      selection.set(layers.order, anchor, tail);
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
      return stageService.ctrlKeyUp();
    case 'Shift':
      return stageService.shiftKeyUp();
  }
}

onMounted(async () => {
  try {
    await input.initFromQuery();
  } catch {}
  if (!input.hasImage) {
    stageStore.setSize(21, 18);
  } else {
    stageStore.setSize(input.width, input.height);
    stageStore.setImage(input.src || '');
  }

  const autoSegments = input.hasImage ? input.segment(40) : [];
  if (autoSegments.length) {
    for (let i = 0; i < autoSegments.length; i++) {
      const segment = autoSegments[i];
      layers.create({
        name: `Auto ${i+1}`,
        colorU32: segment.colorU32,
        visible: true,
        pixels: segment.pixels
      });
    }
  } else {
    layers.create({});
    layers.create({});
  }
  selection.selectOnly(layers.listTopToBottomIds[0]);

  nextTick(() => stageService.recalcScale(document.getElementById('stage')?.parentElement?.parentElement || document.body));

  window.addEventListener('keydown', onKeydown);
  window.addEventListener('keyup', onKeyup);
  window.addEventListener('blur', () => {
    stageService.ctrlKeyUp();
    stageService.shiftKeyUp();
  });
});
</script>

<style>
/* Global styles from pixel.html */
[v-cloak]{display:none}

/* 레이어 재정렬 표시 */
.insert-before{box-shadow:inset 0 3px 0 0 rgba(56,189,248,.7)}
.insert-after{box-shadow:inset 0 -3px 0 0 rgba(56,189,248,.7)}

/* 선택 강조 */
.layer.selected{
  outline:2px solid rgba(56,189,248,.70);
  background:linear-gradient(180deg,rgba(56,189,248,.12),rgba(56,189,248,.05));
  border-color:rgba(56,189,248,.35)
}
.layer.selected.anchor{
  outline:3px solid rgba(56,189,248,.95);
  background:linear-gradient(180deg,rgba(56,189,248,.18),rgba(56,189,248,.07));
  border-color:rgba(56,189,248,.6)
}

/* 드래그/이름편집 UX */
.layers.dragging,.layers .layer.dragging{cursor:grabbing!important}
</style>