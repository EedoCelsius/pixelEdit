<template>
  <g v-if="group" :visibility="group.visibility ? 'visible' : 'hidden'">
    <template v-for="child in children" :key="child">
      <LayerRenderGroup v-if="isGroup(child)" :id="child" />
      <path v-else
            :d="layers.pathOf(child)"
            fill-rule="evenodd"
            shape-rendering="crispEdges"
            :fill="rgbaCssU32(layers.getProperty(child,'color'))"
            :visibility="layers.getProperty(child,'visibility')?'visible':'hidden'" />
    </template>
  </g>
</template>

<script setup>
import { computed } from 'vue';
import { useStore } from '../stores';
import { rgbaCssU32 } from '../utils';

const props = defineProps({ id: String });

const { layers, layerGroups } = useStore();

defineOptions({ name: 'LayerRenderGroup' });

const group = computed(() => layerGroups.getGroup(props.id));
const children = computed(() => layerGroups.childrenOf(props.id));
const isGroup = (id) => layerGroups.isGroup(id);
</script>
