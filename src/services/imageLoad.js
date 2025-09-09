import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import { useStore } from '../stores';
import { MAX_DIMENSION } from '../utils/pixels.js';

export const useImageLoadService = defineStore('imageLoadService', () => {
  const show = ref(false);
  const { input } = useStore();
  const initialize = ref(localStorage.getItem('imageLoad.initialize') !== 'false');
  const tolerance = ref(Number(localStorage.getItem('imageLoad.tolerance')) || 40);
  const canvasWidth = ref(Number(localStorage.getItem('imageLoad.canvasWidth')) || 0);
  const canvasHeight = ref(Number(localStorage.getItem('imageLoad.canvasHeight')) || 0);

  watch(initialize, v => localStorage.setItem('imageLoad.initialize', v));
  watch(tolerance, v => localStorage.setItem('imageLoad.tolerance', v));
  watch(canvasWidth, v => localStorage.setItem('imageLoad.canvasWidth', v));
  watch(canvasHeight, v => localStorage.setItem('imageLoad.canvasHeight', v));

  function open() {
    canvasWidth.value = Math.min(input.width + 2, MAX_DIMENSION);
    canvasHeight.value = Math.min(input.height + 2, MAX_DIMENSION);
    show.value = true;
  }

  function close() {
    show.value = false;
  }

  function cancel() {
    input.clear();
    close();
  }

  function apply() {
    const width = Math.min(canvasWidth.value, MAX_DIMENSION);
    const height = Math.min(canvasHeight.value, MAX_DIMENSION);
    input.initialize({ initializeLayers: initialize.value, segmentTolerance: tolerance.value, canvasWidth: width, canvasHeight: height });
    close();
  }

  return { show, open, close, apply, cancel, initialize, tolerance, canvasWidth, canvasHeight };
});
