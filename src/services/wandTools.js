import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import { useHamiltonianService } from './hamiltonian';
import { useLayerQueryService } from './layerQuery';
import { useToolSelectionService } from './toolSelection';
import { useStore } from '../stores';
import { CURSOR_STYLE } from '@/constants';

export const usePathToolService = defineStore('pathToolService', () => {
  const hamiltonian = useHamiltonianService();
  const layerQuery = useLayerQueryService();
  const tool = useToolSelectionService();
  const { nodeTree, nodes, pixels: pixelStore } = useStore();

  async function apply() {
    const prevCursorState = tool.getCursorState();
    const previousCursor = document.body.style.cursor;
    tool.setCursor({ stroke: CURSOR_STYLE.WAIT, rect: CURSOR_STYLE.WAIT });
    document.body.style.cursor = CURSOR_STYLE.WAIT;
    try {
      if (nodeTree.selectedLayerCount !== 1) return;
      const layerId = nodeTree.selectedLayerIds[0];
      const allPixels = pixelStore.get(layerId);
      if (!allPixels.length) return;

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
      tool.setCursor(prevCursorState);
      document.body.style.cursor = previousCursor || '';
      tool.setPrepared('done');
    }
  }

  return { apply };
});

export const useWandToolsService = defineStore('wandToolsService', () => {
  const tool = useToolSelectionService();
  const pending = ref(null);
  const previous = ref({ shape: null, tool: null });

  function request(action) {
    previous.value = { shape: tool.shape, tool: tool.prepared };
    pending.value = action;
    tool.setShape('wand');
    tool.setPrepared('waiting');
  }

  watch(
    () => tool.prepared,
    async (val) => {
      if (val === 'waiting' && tool.shape === 'wand' && pending.value) {
        const action = pending.value;
        pending.value = null;
        await action();
      } else if (val === 'done') {
        const { shape, tool: prevTool } = previous.value;
        if (shape !== null) tool.setShape(shape);
        if (prevTool !== null) tool.setPrepared(prevTool);
        previous.value = { shape: null, tool: null };
      }
    }
  );

  return { request };
});
