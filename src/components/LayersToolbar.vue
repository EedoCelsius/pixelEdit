<template>
    <div class="flex items-center gap-2 p-2 flex-wrap">
        <button @click="onAdd" title="Add layer" class="p-1 rounded-md border border-white/15 bg-white/5 hover:bg-white/10">
          <img :src="toolbarIcons.add" alt="Add layer" class="w-4 h-4">
        </button>
        <button @click="onCopy" :disabled="!layers.selectionExists" title="Copy layer" class="p-1 rounded-md border border-white/15 bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed">
          <img :src="toolbarIcons.copy" alt="Copy layer" class="w-4 h-4">
        </button>
        <button @click="onMerge" :disabled="layers.selectionCount < 2" title="Merge layers" class="p-1 rounded-md border border-white/15 bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed">
          <img :src="toolbarIcons.merge" alt="Merge layers" class="w-4 h-4">
        </button>
        <button @click="onSplit" :disabled="!canSplit" title="Split disconnected" class="p-1 rounded-md border border-white/15 bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed">
          <img :src="toolbarIcons.split" alt="Split disconnected" class="w-4 h-4">
        </button>
        <button @click="onSelectEmpty" :disabled="!hasEmptyLayers" title="Select empty layers" class="p-1 rounded-md border border-white/15 bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed">
          <img :src="toolbarIcons.empty" alt="Select empty layers" class="w-4 h-4">
        </button>
    </div>
</template>

<script setup>
import { useStore } from '../stores';
import { useService } from '../services';
import { computed } from 'vue';
import toolbarIcons from '../image/layer_toolbar';

const { layers, output } = useStore();
const { layerTool: layerSvc, layerPanel, query } = useService();

const hasEmptyLayers = computed(() => layers.order.some(id => layers.getProperty(id, 'pixels').length === 0));
const canSplit = computed(() => layers.selectedIds.some(id => layers.disconnectedCountOf(id) > 1));

const onAdd = () => {
    output.setRollbackPoint();
    const above = layers.selectionCount ? query.uppermost(layers.selectedIds) : null;
    const id = layers.createLayer({});
    layers.insertLayers([id], above, false);
    layers.replaceSelection([id]);
    layerPanel.setScrollRule({ type: 'follow', target: id });
    output.commit();
};
const onMerge = () => {
    output.setRollbackPoint();
    const id = layerSvc.mergeSelected();
    layers.replaceSelection([id]);
    layerPanel.setScrollRule({ type: 'follow', target: id });
    output.commit();
};
const onCopy = () => {
    output.setRollbackPoint();
    const ids = layerSvc.copySelected();
    layers.replaceSelection(ids);
    layerPanel.setScrollRule({ type: 'follow', target: ids[0] });
    output.commit();
};
const onSelectEmpty = () => {
    const ids = query.empty();
    layers.replaceSelection(ids);
    layerPanel.setScrollRule({ type: 'follow', target: ids[0] });
};
const onSplit = () => {
    output.setRollbackPoint();
    const newIds = layerSvc.splitSelected();
    layerPanel.setScrollRule({ type: 'follow', target: newIds[0] });
    output.commit();
};
</script>
