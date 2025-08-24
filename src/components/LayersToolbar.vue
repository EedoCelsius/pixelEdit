<template>
    <div class="flex items-center gap-2 p-2 flex-wrap">
      <button @click="onAdd" title="Add layer" class="p-1 rounded-md border border-white/15 bg-white/5 hover:bg-white/10">
        <img :src="'image/layer_toolbar/add.svg'" alt="Add layer" class="w-4 h-4">
      </button>
      <button @click="onCopy" :disabled="!layers.hasSelection" title="Copy layer" class="p-1 rounded-md border border-white/15 bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed">
        <img :src="'image/layer_toolbar/copy.svg'" alt="Copy layer" class="w-4 h-4">
      </button>
      <button @click="onMerge" :disabled="layers.selectionCount < 2" title="Merge layers" class="p-1 rounded-md border border-white/15 bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed">
        <img :src="'image/layer_toolbar/merge.svg'" alt="Merge layers" class="w-4 h-4">
      </button>
      <button @click="onSplit" :disabled="!canSplit" title="Split disconnected" class="p-1 rounded-md border border-white/15 bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed">
        <img :src="'image/layer_toolbar/split.svg'" alt="Split disconnected" class="w-4 h-4">
      </button>
      <button @click="onSelectEmpty" :disabled="!hasEmptyLayers" title="Select empty layers" class="p-1 rounded-md border border-white/15 bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed">
        <img :src="'image/layer_toolbar/empty.svg'" alt="Select empty layers" class="w-4 h-4">
      </button>
    </div>
</template>

<script setup>
import { useLayerStore } from '../stores/layers';
import { useLayerPanelStore } from '../stores/layerPanel';
import { useLayerService } from '../services/layers';
import { useRangeSelectionService } from '../services/rangeSelection';
import { useOutputStore } from '../stores/output';
import { computed } from 'vue';

const layers = useLayerStore();
const layerPanel = useLayerPanelStore();
const layerSvc = useLayerService();
const rangeSelect = useRangeSelectionService();
const output = useOutputStore();

const hasEmptyLayers = computed(() => layers.order.some(id => layers.pixelCountOf(id) === 0));
const canSplit = computed(() => layers.selectedIds.some(id => layers.disconnectedCountOf(id) > 1));

const onAdd = () => {
    output.setRollbackPoint();
    const above = layers.selectionCount ? layers.uppermostIdOf(layers.selectedIds) : null;
    const id = layers.createLayer({});
    if (above !== null) {
        layers.reorderLayers([id], above, false);
    }
    rangeSelect.selectOne(id);
    output.commit();
};
const onMerge = () => {
    output.setRollbackPoint();
    const id = layerSvc.mergeSelected();
    rangeSelect.selectOne(id);
    output.commit();
};
const onCopy = () => {
    output.setRollbackPoint();
    const ids = layerSvc.copySelected();
    rangeSelect.replaceSelection(ids, ids?.[0] ?? null, null);
    output.commit();
};
const onSelectEmpty = () => {
    layerSvc.selectEmptyLayers();
};
  const onSplit = () => {
      output.setRollbackPoint();
    layerSvc.splitLayer(layerPanel.anchorId);
      output.commit();
  };
</script>
