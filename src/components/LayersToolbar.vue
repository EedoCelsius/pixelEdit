<template>
  <div class="flex items-center gap-2 p-2 flex-wrap">
    <button @click="onAdd" class="px-2 py-1 text-xs rounded-md border border-white/15 bg-white/5 hover:bg-white/10">+ 레이어</button>
    <button @click="onMerge" :disabled="selection.count < 2" class="px-2 py-1 text-xs rounded-md border border-white/15 bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed">병합</button>
    <button @click="onCopy" :disabled="!selection.hasSelection" class="px-2 py-1 text-xs rounded-md border border-white/15 bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed">복사</button>
    <button @click="onRemoveEmpty" class="px-2 py-1 text-xs rounded-md border border-white/15 bg-white/5 hover:bg-white/10">Remove empty</button>
    <button @click="onSplit" :disabled="selection.count !== 1" class="px-2 py-1 text-xs rounded-md border border-white/15 bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed">Split divided</button>
    <div class="flex-1"></div>
    <button @click="undo" class="px-2 py-1 text-xs rounded-md border border-white/15 bg-white/5 hover:bg-white/10">↶ Undo</button>
    <button @click="redo" class="px-2 py-1 text-xs rounded-md border border-white/15 bg-white/5 hover:bg-white/10">Redo ↷</button>
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
    const id = layers.create({});
    if (above !== null) {
        layers.reorder([id], above, false);
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
const onRemoveEmpty = () => {
    output.setRollbackPoint();
    layerSvc.removeEmptyLayers();
    output.commit();
};
const onSplit = () => {
    output.setRollbackPoint();
    layerSvc.splitSelectedLayer();
    output.commit();
};
const undo = () => output.undo();
const redo = () => output.redo();
</script>
