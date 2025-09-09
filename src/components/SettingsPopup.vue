<template>
  <div v-if="settingsService.show" class="fixed inset-0 flex items-center justify-center bg-black/50">
    <div class="bg-slate-800 p-6 rounded-lg text-xs w-72 space-y-4">
      <div>
        <div class="flex border-b border-white/20 mb-2">
          <button v-for="tab in tabs" :key="tab" @click="currentTab = tab"
                  :class="['px-2 py-1', currentTab === tab ? 'bg-slate-700 text-white' : 'text-white/70']">{{ tab }}</button>
        </div>
        <div v-if="currentTab === 'Pixels'" class="space-y-2 text-white/70">
          <label class="block">
            <span>Default Orientation</span>
            <select v-model="defaultOrientation" class="mt-1 w-full rounded bg-slate-700 px-2 py-1">
              <option v-for="ori in orientations" :key="ori" :value="ori">{{ ori }}</option>
            </select>
          </label>
        </div>
        <div v-else-if="currentTab === 'Stage'" class="space-y-2 text-white/70">
          <label class="block">
            <span>Checkerboard Repeat</span>
            <input type="number" min="1" v-model.number="checkerboardRepeat" class="mt-1 w-full rounded bg-slate-700 px-2 py-1"/>
          </label>
        </div>
      </div>
      <div class="flex justify-end gap-2">
        <button @click="settingsService.close" class="px-2 py-1 rounded bg-white/5 hover:bg-white/10">Close</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useService } from '../services';
import { usePixelStore, PIXEL_DEFAULT_ORIENTATIONS } from '@/stores/pixels';
import { CHECKERBOARD_CONFIG } from '@/constants';
import { checkerboardPatternUrl } from '@/utils/pixels.js';

const { settings: settingsService } = useService();
const pixelStore = usePixelStore();

const tabs = ['Pixels', 'Stage'];
const currentTab = ref(tabs[0]);

const orientations = PIXEL_DEFAULT_ORIENTATIONS;
const defaultOrientation = ref(pixelStore.defaultOrientation);
watch(defaultOrientation, ori => pixelStore.setDefaultOrientation(ori));

const checkerboardRepeat = ref(CHECKERBOARD_CONFIG.REPEAT);
watch(checkerboardRepeat, repeat => {
  CHECKERBOARD_CONFIG.REPEAT = repeat;
  localStorage.setItem('settings.checkerboardRepeat', String(repeat));
  const patternEl = document.getElementById(CHECKERBOARD_CONFIG.PATTERN_ID);
  patternEl?.parentNode?.parentNode?.remove();
  checkerboardPatternUrl(document.body);
});
</script>
