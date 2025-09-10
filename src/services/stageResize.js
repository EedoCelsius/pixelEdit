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
    viewport.recalcContentSize();
    viewport.setScale(viewport.stage.containScale * 0.75);
    viewport.setOffset(0, 0);
    close();
  }

  return { show, open, close, apply };
});
