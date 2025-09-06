<template>
  <div class="absolute left-0 top-full mt-1 flex flex-col rounded-md border border-white/15 bg-slate-800 p-1 z-10 w-max">
    <button
      v-for="tool in tools"
      :key="tool.type"
      @click="$emit('select', tool)"
      class="flex items-center gap-2 px-1 py-1 text-xs rounded hover:bg-white/10 w-full"
    >
      <img v-if="tool.icon" :src="tool.icon" :alt="tool.name" class="w-4 h-4" />
      <span class="whitespace-nowrap">{{ tool.name }}</span>
    </button>
  </div>
</template>

<script setup>
import { WAND_TOOLS } from '@/constants';
const tools = WAND_TOOLS;
</script>
