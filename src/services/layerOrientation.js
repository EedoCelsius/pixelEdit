import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useStore } from '../stores';
import { OT } from '@/constants/orientation.js';

export const useLayerOrientationService = defineStore('layerOrientationService', () => {
  const { nodeTree, pixels } = useStore();
  const show = ref(false);
  const orientation = ref(OT.NONE);
  const cbOriA = ref(pixels.checkerboardOrientations[0]);
  const cbOriB = ref(pixels.checkerboardOrientations[1]);

  function open(initial = OT.NONE) {
    orientation.value = initial;
    [cbOriA.value, cbOriB.value] = pixels.checkerboardOrientations;
    show.value = true;
  }

  function close() {
    show.value = false;
  }

  function apply() {
    const ori = orientation.value;
    if (ori === 'checkerboard') {
      pixels.setCheckerboardOrientations(cbOriA.value, cbOriB.value);
    }
    const ids = nodeTree.selectedLayerIds;
    for (const id of ids) {
      const map = pixels.get(id);
      if (map) {
        pixels.override(id, map.keys(), ori);
      }
    }
    close();
  }

  return { show, orientation, cbOriA, cbOriB, open, close, apply };
});
