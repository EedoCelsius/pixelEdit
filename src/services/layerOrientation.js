import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useStore } from '../stores';
import { OT } from '@/constants/orientation.js';

export const useLayerOrientationService = defineStore('layerOrientationService', () => {
  const { nodeTree, pixels } = useStore();
  const show = ref(false);
  const orientation = ref(OT.NONE);

  function open(initial = OT.NONE) {
    orientation.value = initial;
    show.value = true;
  }

  function close() {
    show.value = false;
  }

  function apply(ori = orientation.value) {
    const ids = nodeTree.selectedLayerIds;
    for (const id of ids) {
      const map = pixels.get(id);
      if (map) {
        pixels.override(id, map.keys(), ori);
      }
    }
    close();
  }

  return { show, orientation, open, close, apply };
});
