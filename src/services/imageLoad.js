import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useStore } from '../stores';

export const useImageLoadService = defineStore('imageLoadService', () => {
  const show = ref(false);
  const { input, pixels } = useStore();

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

  function apply({ direction, initialize, tolerance }) {
    pixels.setDefaultDirection(direction);
    input.initialize({ initializeLayers: initialize, segmentTolerance: tolerance });
    close();
  }

  return { show, open, close, apply, cancel };
});
