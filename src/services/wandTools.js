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
    const { nodeTree, pixels: pixelStore, nodes } = useStore();
    const usable = computed(() => tool.shape === 'wand' && nodeTree.selectedLayerCount > 1);

    const averageOf = (id) => {
        const pixels = pixelStore.get(id);
        if (!pixels.length) return null;
        let sx = 0, sy = 0;
        for (const p of pixels) {
            const [x, y] = indexToCoord(p);
            sx += x;
            sy += y;
        }
        return [sx / pixels.length, sy / pixels.length];
    };

    watch(() => tool.current, (p) => {
        if (p !== 'connect') return;
        if (!usable.value) return;

        tool.setCursor({ wand: CURSOR_STYLE.WAIT });

        const selected = nodeTree.layerOrder.filter(id => nodeTree.selectedLayerIds.includes(id));
        const len = selected.length;
        const cache = new Map();
        const getAvg = (id) => {
            if (!cache.has(id)) cache.set(id, averageOf(id));
            return cache.get(id);
        };

        const orientations = new Array(len).fill(null);

        for (let i = 0; i < len; i++) {
            const id = selected[i];
            let orientation = null;
            for (let dist = 1; dist < len && !orientation; dist++) {
                const topAvg = getAvg(selected[(i - dist + len) % len]);
                const bottomAvg = getAvg(selected[(i + dist) % len]);
                if (!topAvg || !bottomAvg) continue;
                const dx = bottomAvg[0] - topAvg[0];
                const dy = bottomAvg[1] - topAvg[1];
                if (Math.abs(dx) === Math.abs(dy)) continue; // diagonal, expand range
                const horizontalLike = Math.abs(dx) > Math.abs(dy);
                const major = Math.max(Math.abs(dx), Math.abs(dy));
                if (major === 1) orientation = horizontalLike ? 'horizontal' : 'vertical';
                else orientation = horizontalLike ? 'vertical' : 'horizontal';
            }
            orientations[i] = orientation;
            if (!orientation) continue;
            const pixels = pixelStore.get(id);
            if (pixels.length) pixelStore.set(id, pixels, orientation);
        }

        // Merge adjacent layers with same orientation (cyclical)
        let merged = true;
        while (merged && selected.length > 1) {
            merged = false;
            for (let i = 0; i < selected.length; i++) {
                const next = (i + 1) % selected.length;
                if (orientations[i] && orientations[next] && orientations[i] === orientations[next]) {
                    const idCurrent = selected[i];
                    const idNext = selected[next];
                    const pixels = pixelStore.get(idNext);
                    if (pixels.length) pixelStore.addPixels(idCurrent, pixels, orientations[i]);
                    pixelStore.remove([idNext]);
                    nodeTree.remove([idNext]);
                    nodes.remove([idNext]);
                    selected.splice(next, 1);
                    orientations.splice(next, 1);
                    merged = true;
                    break;
                }
            }
        }

        nodeTree.replaceSelection(selected);

        tool.setShape('stroke');
        tool.useRecent();
    });

    return { usable };
});
