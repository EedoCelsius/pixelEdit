import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useStore } from '../stores';

export const useStageResizeService = defineStore('stageResizeService', () => {
  const { viewport, output } = useStore();
  const show = ref(false);

  function open() {
    show.value = true;
  }

  function close() {
    show.value = false;
  }

  function apply(payload) {
    output.setRollbackPoint();
    viewport.resizeByEdges(payload);
    viewport.recalcContentSize();
    viewport.setScale(viewport.stage.containScale * 0.75);
    const w = viewport.stage.width * viewport.stage.scale;
    const h = viewport.stage.height * viewport.stage.scale;
    const x = (viewport.content.width - w) / 2;
    const y = (viewport.content.height - h) / 2;
    viewport.setOffset(x, y);
    output.commit();
    close();
  }

  return { show, open, close, apply };
});
