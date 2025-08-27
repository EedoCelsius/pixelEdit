<template>
  <div class="layers flex-1 overflow-auto p-2 flex flex-col gap-2">
    <LayerTreeNode v-for="node in layerGroups.tree" :key="node.id || node" :node="node" />
    <div v-show="layers.idsTopToBottom.length===0" class="text-xs text-slate-400/80 py-6 text-center">(레이어가 없습니다)</div>
  </div>
</template>

<script setup>
import { useStore } from '../stores';
import LayerTreeNode from './LayerTreeNode.vue';

const { layers, layerGroups } = useStore();
</script>
