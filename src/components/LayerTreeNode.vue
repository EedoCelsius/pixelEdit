<template>
  <div v-if="isGroup" class="group-node">
    <div class="layer flex items-center gap-3 p-2 border border-white/15 rounded-lg bg-sky-950/30">
      <span class="cursor-pointer select-none" @click.stop="toggleCollapse(node.id)">{{ node.collapsed ? '+' : '-' }}</span>
      <div class="name font-semibold truncate text-sm flex-1">{{ node.name }}</div>
      <div class="flex gap-1 justify-end">
        <div class="inline-flex items-center justify-center w-7 h-7 rounded-md" title="보이기/숨기기">
          <img :src="(node.visibility?icons.show:icons.hide)" alt="show/hide" class="w-4 h-4 cursor-pointer" @click.stop="toggleGroupVisibility(node.id)" />
        </div>
        <div class="inline-flex items-center justify-center w-7 h-7 rounded-md" title="잠금/해제">
          <img :src="(node.locked?icons.lock:icons.unlock)" alt="lock/unlock" class="w-4 h-4 cursor-pointer" @click.stop="toggleGroupLock(node.id)" />
        </div>
      </div>
    </div>
    <div v-show="!node.collapsed" class="pl-4 flex flex-col gap-2">
      <LayerTreeNode v-for="child in node.children" :key="child.id || child" :node="child" :depth="depth+1" />
    </div>
  </div>
  <div v-else class="layer flex items-center gap-3 p-2 border border-white/15 rounded-lg bg-sky-950/30 select-none"
       :data-id="layerProps.id"
       @click="layerPanel.onLayerClick(layerProps.id,$event)">
    <div class="name font-semibold truncate text-sm flex-1">{{ layerProps.name }}</div>
    <div class="flex gap-1 justify-end">
      <div class="inline-flex items-center justify-center w-7 h-7 rounded-md" title="보이기/숨기기">
        <img :src="(layerProps.visibility?icons.show:icons.hide)" alt="show/hide" class="w-4 h-4 cursor-pointer" @click.stop="toggleVisibility(layerProps.id)" />
      </div>
      <div class="inline-flex items-center justify-center w-7 h-7 rounded-md" title="잠금/해제">
        <img :src="(layerProps.locked?icons.lock:icons.unlock)" alt="lock/unlock" class="w-4 h-4 cursor-pointer" @click.stop="toggleLock(layerProps.id)" />
      </div>
      <div class="inline-flex items-center justify-center w-7 h-7 rounded-md" title="삭제">
        <img :src="icons.del" alt="delete" class="w-4 h-4 cursor-pointer" @click.stop="deleteLayer(layerProps.id)" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useStore } from '../stores';
import { useService } from '../services';
import blockIcons from '../image/layer_block';

defineOptions({ name: 'LayerTreeNode' });

const props = defineProps({
  node: { type: [Object, Number], required: true },
  depth: { type: Number, default: 0 }
});

const { layers, layerGroups, output } = useStore();
const { layerPanel } = useService();
const icons = blockIcons;

const isGroup = computed(() => typeof props.node === 'object');
const layerProps = computed(() => typeof props.node === 'number' ? layers.getProperties(props.node) : null);

function toggleVisibility(id) {
  output.setRollbackPoint();
  layers.toggleVisibility(id);
  output.commit();
}
function toggleLock(id) {
  output.setRollbackPoint();
  layers.toggleLock(id);
  output.commit();
}
function deleteLayer(id) {
  output.setRollbackPoint();
  layerGroups.removeLayer(id);
  layers.deleteLayers([id]);
  output.commit();
}
function toggleGroupVisibility(id) {
  output.setRollbackPoint();
  layerGroups.toggleVisibility(id);
  output.commit();
}
function toggleGroupLock(id) {
  output.setRollbackPoint();
  layerGroups.toggleLock(id);
  output.commit();
}
function toggleCollapse(id) {
  layerGroups.toggleCollapse(id);
}
</script>
