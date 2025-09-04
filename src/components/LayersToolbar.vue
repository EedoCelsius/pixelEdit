<template>
    <div class="flex items-center gap-2 p-2 flex-wrap">
        <button @click="onAdd" title="Add layer" class="p-1 rounded-md border border-white/15 bg-white/5 hover:bg-white/10">
          <img :src="toolbarIcons.add" alt="Add layer" class="w-4 h-4">
        </button>
        <button @click="onAddGroup" title="Add group" class="p-1 rounded-md border border-white/15 bg-white/5 hover:bg-white/10">
          <img :src="toolbarIcons.group" alt="Add group" class="w-4 h-4">
        </button>
        <button @click="onCopy" :disabled="nodeTree.selectedNodeCount === 0" title="Copy" class="p-1 rounded-md border border-white/15 bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed">
          <img :src="toolbarIcons.copy" alt="Copy" class="w-4 h-4">
        </button>
        <button @click="onMerge" :disabled="nodeTree.selectedLayerCount < 2 && nodeTree.selectedGroupCount === 0" title="Merge layers" class="p-1 rounded-md border border-white/15 bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed">
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

const { nodeTree, nodes, pixels: pixelStore, output } = useStore();
const { layerTool: layerSvc, layerPanel, layerQuery } = useService();

const hasEmptyLayers = computed(() => nodeTree.layerOrder.some(id => pixelStore.get(id).length === 0));
const canSplit = computed(() => nodeTree.selectedLayerIds.some(id => pixelStore.disconnectedCountOfLayer(id) > 1));

const onAdd = () => {
    output.setRollbackPoint();
    const above = nodeTree.selectedLayerCount ? layerQuery.uppermost(nodeTree.selectedLayerIds) : null;
    const id = nodes.createLayer({color: 0xFFFFFFFF});
    nodeTree.insert([id], above, false);
    nodeTree.replaceSelection([id]);
    layerPanel.setScrollRule({ type: 'follow', target: id });
    output.commit();
};
const onAddGroup = () => {
    output.setRollbackPoint();
    const id = layerSvc.groupSelected();
    layerPanel.setRange(id, id);
    layerPanel.setScrollRule({ type: 'follow', target: id });
    output.commit();
};
const onMerge = () => {
    output.setRollbackPoint();
    const id = layerSvc.mergeSelected();
    nodeTree.replaceSelection([id]);
    layerPanel.setScrollRule({ type: 'follow', target: id });
    output.commit();
};
const onCopy = () => {
    output.setRollbackPoint();
    const ids = layerSvc.copySelected();
    nodeTree.replaceSelection(ids);
    layerPanel.setScrollRule({ type: 'follow', target: ids[0] });
    output.commit();
};
const onSelectEmpty = () => {
    const ids = layerQuery.empty();
    nodeTree.replaceSelection(ids);
    layerPanel.setScrollRule({ type: 'follow', target: ids[0] });
};
const onSplit = () => {
    output.setRollbackPoint();
    const newIds = layerSvc.splitSelected();
    layerPanel.setScrollRule({ type: 'follow', target: newIds[0] });
    output.commit();
};
</script>
