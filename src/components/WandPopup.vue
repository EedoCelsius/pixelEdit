<template>
  <div class="absolute left-0 top-full mt-1 flex flex-col rounded-md border border-white/15 bg-slate-800 p-1 z-10 w-max">
    <button
      v-for="tool in tools"
      :key="tool.type"
      @click="$emit('select', tool)"
      :disabled="!tool.usable"
      :class="`flex items-center gap-2 px-1 py-1 text-xs rounded w-full ${tool.usable ? 'hover:bg-white/10' : 'opacity-50 cursor-not-allowed'}`"
    >
      <img v-if="tool.icon" :src="tool.icon" :alt="tool.name" class="w-4 h-4" />
      <span class="whitespace-nowrap">{{ tool.name }}</span>
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { WAND_TOOLS } from '@/constants';
import { useService } from '../services';

const { tools: serviceTools } = useService();
const tools = computed(() => WAND_TOOLS.map(t => ({ ...t, usable: serviceTools[t.type]?.usable })));
</script>
