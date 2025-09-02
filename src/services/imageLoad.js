import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import { useStore } from '../stores';

export const useImageLoadService = defineStore('imageLoadService', () => {
  const show = ref(false);
  const { input } = useStore();
  const initialize = ref(localStorage.getItem('imageLoad.initialize') !== 'false');
  const tolerance = ref(Number(localStorage.getItem('imageLoad.tolerance')) || 40);

  watch(initialize, v => localStorage.setItem('imageLoad.initialize', v));
  watch(tolerance, v => localStorage.setItem('imageLoad.tolerance', v));

  function open() {
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
    input.initialize({ initializeLayers: initialize.value, segmentTolerance: tolerance.value });
    close();
  }

  return { show, open, close, apply, cancel, initialize, tolerance };
});
