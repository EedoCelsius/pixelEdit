<template>
    <div class="flex items-center gap-2 p-2 flex-wrap">
      <button @click="onAdd" class="p-1 rounded-md border border-white/15 bg-white/5 hover:bg-white/10">
        <img src="/image/layer_toolbar/add.svg" alt="Add layer">
      </button>
      <button @click="onMerge" :disabled="selection.count < 2" class="p-1 rounded-md border border-white/15 bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed">
        <img src="/image/layer_toolbar/merge.svg" alt="Merge layers">
      </button>
      <button @click="onCopy" :disabled="!selection.exists" class="p-1 rounded-md border border-white/15 bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed">
        <img src="/image/layer_toolbar/copy.svg" alt="Copy layer">
      </button>
      <button @click="onSelectEmpty" class="p-1 rounded-md border border-white/15 bg-white/5 hover:bg-white/10">
        <img src="/image/layer_toolbar/empty.svg" alt="Select empty">
      </button>
      <button @click="onSplit" :disabled="selection.count !== 1" class="p-1 rounded-md border border-white/15 bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed">
        <img src="/image/layer_toolbar/split.svg" alt="Split divided">
      </button>
    </div>
</template>

<script setup>
import { useLayerStore } from '../stores/layers';
import { useLayerService } from '../services/layers';
import { useOutputStore } from '../stores/output';
import { useSelectionStore } from '../stores/selection';

const layers = useLayerStore();
const layerSvc = useLayerService();
const output = useOutputStore();
const selection = useSelectionStore();

const onAdd = () => {
    output.setRollbackPoint();
    const above = selection.count ? layers.uppermostIdOf(selection.ids) : null;
    const id = layers.createLayer({});
    if (above !== null) {
        layers.reorderLayers([id], above, false);
    }
    selection.selectOne(id);
    output.commit();
};
const onMerge = () => {
    output.setRollbackPoint();
    const id = layerSvc.mergeSelected();
    selection.selectOne(id);
    output.commit();
};
const onCopy = () => {
    output.setRollbackPoint();
    const ids = layerSvc.copySelected();
    selection.replace(ids, ids?.[0] ?? null, null);
    output.commit();
};
const onSelectEmpty = () => {
    layerSvc.selectEmptyLayers();
};
  const onSplit = () => {
      output.setRollbackPoint();
      layerSvc.splitLayer(selection.anchorId);
      output.commit();
  };
</script>
