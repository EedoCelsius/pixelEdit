import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import { useStore } from '../stores';

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
    canvasWidth.value = input.width + 2;
    canvasHeight.value = input.height + 2;
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
    input.initialize({ initializeLayers: initialize.value, segmentTolerance: tolerance.value, canvasWidth: canvasWidth.value, canvasHeight: canvasHeight.value });
    close();
  }

  return { show, open, close, apply, cancel, initialize, tolerance, canvasWidth, canvasHeight };
});
