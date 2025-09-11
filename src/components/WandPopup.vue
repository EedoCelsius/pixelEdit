<template>
  <div class="absolute left-0 top-full mt-1 flex flex-col rounded-md border border-white/15 bg-slate-800 p-1 z-10 w-max">
    <button
      v-for="tool in tools"
      :key="tool.type"
      @click="$emit('select', tool)"
      class="flex items-center gap-2 px-1 py-1 text-xs rounded w-full"
      :class="tool.usable?.value ? 'hover:bg-white/10' : 'opacity-50 cursor-not-allowed'"
      :disabled="!tool.usable?.value"
    >
      <img v-if="tool.icon" :src="tool.icon" :alt="tool.name" class="w-4 h-4" />
      <span class="whitespace-nowrap">{{ tool.name }}</span>
    </button>
  </div>
</template>

<script setup>
import { WAND_TOOLS } from '@/constants';
import { usePathToolService, useRelayToolService, useExpandToolService, useBorderToolService, useMarginToolService } from '@/services/wandTools';

const services = {
  path: usePathToolService(),
  relay: useRelayToolService(),
  expand: useExpandToolService(),
  border: useBorderToolService(),
  margin: useMarginToolService()
};

const tools = WAND_TOOLS.map(t => ({ ...t, usable: services[t.type].usable }));
</script>
