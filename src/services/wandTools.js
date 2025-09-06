import { defineStore } from 'pinia';
import { watch, computed } from 'vue';
import { useToolSelectionService } from './toolSelection';
import { useHamiltonianService } from './hamiltonian';
import { useLayerQueryService } from './layerQuery';
import { useStore } from '../stores';
import { CURSOR_STYLE } from '@/constants';
import { indexToCoord } from '../utils';

export const usePathToolService = defineStore('pathToolService', () => {
    const tool = useToolSelectionService();
    const hamiltonian = useHamiltonianService();
    const layerQuery = useLayerQueryService();
    const { nodeTree, nodes, pixels: pixelStore } = useStore();
    const usable = computed(() => tool.shape === 'wand' && nodeTree.selectedLayerCount === 1);

    watch(() => tool.current, async (p) => {
        if (p !== 'path') return;
        if (!usable.value) return;

        tool.setCursor({ wand: CURSOR_STYLE.WAIT });

        const layerId = nodeTree.selectedLayerIds[0];
        const allPixels = pixelStore.get(layerId);
        const paths = await hamiltonian.traverseFree(allPixels);

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

        tool.setShape("stroke");
        tool.useRecent();
    });

    return { usable };
});

export const useConnectToolService = defineStore('connectToolService', () => {
    const tool = useToolSelectionService();
    const { nodeTree, pixels: pixelStore } = useStore();
    const usable = computed(() => tool.shape === 'wand' && nodeTree.selectedLayerCount > 2);

    function average(id) {
        const pixels = pixelStore.get(id);
        if (!pixels.length) return null;
        let sx = 0, sy = 0;
        for (const p of pixels) {
            const [x, y] = indexToCoord(p);
            sx += x;
            sy += y;
        }
        return { x: sx / pixels.length, y: sy / pixels.length };
    }

    watch(() => tool.current, (p) => {
        if (p !== 'connect') return;
        if (!usable.value) return;

        tool.setCursor({ wand: CURSOR_STYLE.WAIT });

        const ids = nodeTree.selectedLayerIds.slice();
        const n = ids.length;
        const averages = new Map();
        ids.forEach(id => averages.set(id, average(id)));

        for (let i = 0; i < n; i++) {
            const id = ids[i];
            const pixels = pixelStore.get(id);
            if (!pixels.length) continue;
            let range = 1;
            let direction = null;
            while (range <= Math.floor(n / 2)) {
                const upperId = ids[(i - range + n) % n];
                const lowerId = ids[(i + range) % n];
                const upAvg = averages.get(upperId);
                const lowAvg = averages.get(lowerId);
                if (!upAvg || !lowAvg) {
                    range++;
                    continue;
                }
                const dx = Math.abs(upAvg.x - lowAvg.x);
                const dy = Math.abs(upAvg.y - lowAvg.y);
                if (dx === dy) {
                    range++;
                    continue;
                }
                direction = dx > dy ? 'horizontal' : 'vertical';
                break;
            }
            if (direction) {
                pixelStore.addPixels(id, pixels, direction);
            }
        }

        tool.setShape('stroke');
        tool.useRecent();
    });

    return { usable };
});

