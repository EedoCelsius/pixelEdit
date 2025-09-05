import { defineStore } from 'pinia';
import { useHamiltonianService } from './hamiltonian';
import { useLayerQueryService } from './layerQuery';
import { useStore } from '../stores';
import { CURSOR_STYLE } from '@/constants';

export const usePathToolService = defineStore('pathToolService', () => {
  const hamiltonian = useHamiltonianService();
  const layerQuery = useLayerQueryService();
  const { nodeTree, nodes, pixels: pixelStore } = useStore();

  async function apply() {
    if (nodeTree.selectedLayerCount !== 1) return;
    const layerId = nodeTree.selectedLayerIds[0];
    const allPixels = pixelStore.get(layerId);
    if (!allPixels.length) return;

    const previousCursor = document.body.style.cursor;
    document.body.style.cursor = CURSOR_STYLE.WAIT;
    try {
      const paths = await hamiltonian.traverseFree(allPixels);
      if (!paths.length) return;

      const color = nodes.getProperty(layerId, 'color');
      const name = nodes.getProperty(layerId, 'name');
      const groupId = nodes.createGroup({ name: `${name} Paths` });

      nodeTree.insert([groupId], layerQuery.lowermost([layerId]), true);

      nodeTree.remove([layerId]);
      nodes.remove([layerId]);
      pixelStore.remove([layerId]);

      paths.forEach((path, idx) => {
        const subGroupId = nodes.createGroup({ name: `Path ${idx + 1}` });
        nodeTree.append([subGroupId], groupId, false);

        const ids = [];
        path.forEach((pixel, j) => {
          const lid = nodes.createLayer({ name: `Pixel ${j + 1}`, color });
          pixelStore.addPixels(lid, [pixel]);
          ids.push(lid);
        });
        nodeTree.append(ids, subGroupId, false);
      });

      nodeTree.replaceSelection([groupId]);
    } finally {
      document.body.style.cursor = previousCursor || '';
    }
  }

  return { apply };
});
