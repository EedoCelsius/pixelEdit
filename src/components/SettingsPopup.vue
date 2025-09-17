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
              <option v-for="ori in orientations" :key="ori" :value="ori">{{ ORIENTATION_LABELS[ori] }}</option>
            </select>
          </label>
          <div v-if="defaultOrientation === 'checkerboard'" class="flex gap-2">
            <select v-model="cbOriA" class="flex-1 rounded bg-slate-700 px-2 py-1">
              <option v-for="ori in pixelOrientations" :key="ori" :value="ori">{{ ORIENTATION_LABELS[ori] }}</option>
            </select>
            <select v-model="cbOriB" class="flex-1 rounded bg-slate-700 px-2 py-1">
              <option v-for="ori in pixelOrientations" :key="ori" :value="ori">{{ ORIENTATION_LABELS[ori] }}</option>
            </select>
          </div>
          <label class="block">
            <span>Orientation Overflow (%)</span>
            <input type="number" min="0" max="100" step="0.1" v-model.number="orientationOverflowPercent"
                   class="mt-1 w-full rounded bg-slate-700 px-2 py-1" />
          </label>
          <label class="block">
            <span>Star Orientation Overflow (%)</span>
            <input type="number" min="0" max="100" step="0.1" v-model.number="starOrientationOverflowPercent"
                   class="mt-1 w-full rounded bg-slate-700 px-2 py-1" />
          </label>
        </div>
        <div v-else-if="currentTab === 'Stage'" class="space-y-2 text-white/70">
          <label class="block">
            <span>Checkerboard Repeat</span>
            <input type="number" min="1" v-model.number="checkerboardRepeat" class="mt-1 w-full rounded bg-slate-700 px-2 py-1"/>
          </label>
          <label class="block">
            <span>SVG Pixel Size</span>
            <div class="mt-1 flex gap-2">
              <input type="number" min="0.01" step="0.01" v-model.number="svgPixelSize"
                     class="flex-1 rounded bg-slate-700 px-2 py-1" />
              <select v-model="svgUnit" class="w-20 rounded bg-slate-700 px-2 py-1">
                <option v-for="unit in svgUnits" :key="unit" :value="unit">{{ unit }}</option>
              </select>
            </div>
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
import { usePixelStore, PIXEL_DEFAULT_ORIENTATIONS, PIXEL_ORIENTATIONS } from '@/stores/pixels';
import { CHECKERBOARD_CONFIG } from '@/constants';
import { ORIENTATION_LABELS, ORIENTATION_OVERFLOW_CONFIG } from '@/constants/orientation.js';
import { checkerboardPatternUrl } from '@/utils/pixels.js';
import { SVG_EXPORT_CONFIG, SVG_EXPORT_UNITS } from '@/constants/svg.js';

const { settings: settingsService } = useService();
const pixelStore = usePixelStore();

const tabs = ['Pixels', 'Stage'];
const currentTab = ref(tabs[0]);

const orientations = PIXEL_DEFAULT_ORIENTATIONS;
const pixelOrientations = PIXEL_ORIENTATIONS;
const defaultOrientation = ref(pixelStore.defaultOrientation);
watch(defaultOrientation, ori => pixelStore.setDefaultOrientation(ori));
const [initialA, initialB] = pixelStore.checkerboardOrientations;
const cbOriA = ref(initialA);
const cbOriB = ref(initialB);
watch([cbOriA, cbOriB], ([a, b]) => pixelStore.setCheckerboardOrientations(a, b));

const orientationOverflowPercent = ref(ORIENTATION_OVERFLOW_CONFIG.LINE_PERCENT);
watch(orientationOverflowPercent, value => {
  let clamped = Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0;
  clamped = Math.round(clamped * 10) / 10;
  if (clamped !== value) {
    orientationOverflowPercent.value = clamped;
    return;
  }
  ORIENTATION_OVERFLOW_CONFIG.LINE_PERCENT = clamped;
  localStorage.setItem('settings.orientationOverflowPercent', String(clamped));
});

const starOrientationOverflowPercent = ref(ORIENTATION_OVERFLOW_CONFIG.STAR_PERCENT);
watch(starOrientationOverflowPercent, value => {
  let clamped = Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0;
  clamped = Math.round(clamped * 10) / 10;
  if (clamped !== value) {
    starOrientationOverflowPercent.value = clamped;
    return;
  }
  ORIENTATION_OVERFLOW_CONFIG.STAR_PERCENT = clamped;
  localStorage.setItem('settings.starOrientationOverflowPercent', String(clamped));
});

const checkerboardRepeat = ref(CHECKERBOARD_CONFIG.REPEAT);
watch(checkerboardRepeat, repeat => {
  CHECKERBOARD_CONFIG.REPEAT = repeat;
  localStorage.setItem('settings.checkerboardRepeat', String(repeat));
  const patternEl = document.getElementById(CHECKERBOARD_CONFIG.PATTERN_ID);
  patternEl?.parentNode?.parentNode?.remove();
  checkerboardPatternUrl(document.body);
});

const svgPixelSize = ref(SVG_EXPORT_CONFIG.PIXEL_SIZE);
watch(svgPixelSize, value => {
  let size = Number.isFinite(value) ? Math.max(0.01, value) : 1;
  size = Math.round(size * 1000) / 1000;
  if (size !== value) {
    svgPixelSize.value = size;
    return;
  }
  SVG_EXPORT_CONFIG.PIXEL_SIZE = size;
  localStorage.setItem('settings.svgExportPixelSize', String(size));
});

const svgUnits = SVG_EXPORT_UNITS;
const svgUnit = ref(SVG_EXPORT_CONFIG.UNIT);
watch(svgUnit, unit => {
  const fallback = SVG_EXPORT_UNITS[0];
  const next = SVG_EXPORT_UNITS.includes(unit) ? unit : fallback;
  if (next !== unit) {
    svgUnit.value = next;
    return;
  }
  SVG_EXPORT_CONFIG.UNIT = next;
  localStorage.setItem('settings.svgExportUnit', next);
});
</script>
