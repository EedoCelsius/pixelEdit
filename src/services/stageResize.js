import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useStore } from '../stores';

export const useStageResizeService = defineStore('stageResizeService', () => {
  const { viewport } = useStore();
  const show = ref(false);

  function open() {
    show.value = true;
  }

  function close() {
    show.value = false;
  }

  function apply(payload) {
    viewport.resizeByEdges(payload);
    close();
  }

  return { show, open, close, apply };
});
