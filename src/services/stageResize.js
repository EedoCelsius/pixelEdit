import { defineStore } from 'pinia';
import { useStore } from '../stores';

export const useStageResizeService = defineStore('stageResizeService', () => {
  const { viewport } = useStore();

  function resize(direction, delta = 1) {
    const payload = { top: 0, bottom: 0, left: 0, right: 0 };
    if (direction === 'top') payload.top = delta;
    else if (direction === 'bottom') payload.bottom = delta;
    else if (direction === 'left') payload.left = delta;
    else if (direction === 'right') payload.right = delta;
    viewport.resizeByEdges(payload);
  }

  function expand(direction, amount = 1) {
    resize(direction, Math.abs(amount));
  }

  function shrink(direction, amount = 1) {
    resize(direction, -Math.abs(amount));
  }

  return { resize, expand, shrink };
});
