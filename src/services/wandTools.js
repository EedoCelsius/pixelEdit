import { defineStore } from 'pinia';
import { watch, computed } from 'vue';
import { useToolSelectionService } from './toolSelection';
import { useHamiltonianService } from './hamiltonian';
import { useLayerQueryService } from './layerQuery';
import { useNodeQueryService } from './nodeQuery';
import { useStore } from '../stores';
import { CURSOR_STYLE } from '@/constants';
import { coordToIndex, indexToCoord, groupConnectedPixels } from '../utils';

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

export const useRelayToolService = defineStore('relayToolService', () => {
    const tool = useToolSelectionService();
    const { nodeTree, nodes, pixels: pixelStore } = useStore();
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
        if (p !== 'relay') return;
        if (!usable.value) return;

        const selected = nodeTree.layerOrder.filter(id => nodeTree.selectedLayerIds.includes(id));
        const len = selected.length;
        const cache = new Map();
        const getAvg = (id) => {
            if (!cache.has(id)) cache.set(id, averageOf(id));
            return cache.get(id);
        };

        const orientationMap = new Map();

        for (let i = 0; i < len; i++) {
            const id = selected[i];
            let orientation = null;
            for (let dist = 1; dist < len; dist++) {
                const topAvg = getAvg(selected[(i - dist + len) % len]);
                const bottomAvg = getAvg(selected[(i + dist) % len]);
                if (!topAvg || !bottomAvg) continue;
                const dx = bottomAvg[0] - topAvg[0];
                const dy = bottomAvg[1] - topAvg[1];
                if (Math.abs(dx) === Math.abs(dy)) continue;
                orientation = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical';
                if (dist >= 2) orientation = orientation === 'horizontal' ? 'vertical' : 'horizontal';
                break;
            }
            if (!orientation) continue;
            const pixels = pixelStore.get(id);
            if (pixels.length) pixelStore.set(id, pixels, orientation);
            orientationMap.set(id, orientation);
        }

        const mergedSelection = new Set(nodeTree.selectedLayerIds);
        let changed = true;
        while (changed) {
            changed = false;
            const current = nodeTree.layerOrder.filter(id => mergedSelection.has(id));
            const clen = current.length;
            for (let i = 0; i < clen; i++) {
                const baseId = current[i];
                const nextId = current[(i + 1) % clen];
                if (baseId === nextId) continue;
                const orient = orientationMap.get(baseId);
                if (!orient || orientationMap.get(nextId) !== orient) continue;
                const union = [...new Set([...pixelStore.get(baseId), ...pixelStore.get(nextId)])];
                if (groupConnectedPixels(union).length > 1) continue;
                const px = pixelStore.get(nextId);
                if (px.length) pixelStore.addPixels(baseId, px, orient);
                const removed = nodeTree.remove([nextId]);
                nodes.remove(removed);
                pixelStore.remove(removed);
                orientationMap.delete(nextId);
                mergedSelection.delete(nextId);
                changed = true;
                break;
            }
        }
        nodeTree.replaceSelection([...mergedSelection]);

        tool.setShape('stroke');
        tool.useRecent();
    });

    return { usable };
});

export const useExpandToolService = defineStore('expandToolService', () => {
    const tool = useToolSelectionService();
    const nodeQuery = useNodeQueryService();
    const { nodeTree, nodes, pixels: pixelStore, viewport: viewportStore } = useStore();
    const usable = computed(() => tool.shape === 'wand' && nodeTree.selectedLayerCount > 0);

    watch(() => tool.current, (p) => {
        if (p !== 'expand') return;
        if (!usable.value) return;

        const width = viewportStore.stage.width;
        const height = viewportStore.stage.height;

        const selected = new Map();
        for (const id of nodeTree.selectedLayerIds) {
            pixelStore.get(id).forEach(px => selected.set(px, id));
        }

        const expansion = new Set();
        for (const pixel of selected.keys()) {
            const [x, y] = indexToCoord(pixel);
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    if (dx === 0 && dy === 0) continue;
                    const nx = x + dx;
                    const ny = y + dy;
                    if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
                    const ni = coordToIndex(nx, ny);
                    if (!selected.has(ni)) expansion.add(ni);
                }
            }
        }

        if (expansion.size) {
            const colorGroups = new Map();
            for (const pixel of expansion) {
                const [x, y] = indexToCoord(pixel);
                let layerId = null;
                const neighbors = [
                    [x - 1, y],
                    [x + 1, y],
                    [x, y - 1],
                    [x, y + 1]
                ];
                for (const [nx, ny] of neighbors) {
                    const ni = coordToIndex(nx, ny);
                    if (selected.has(ni)) {
                        layerId = selected.get(ni);
                        break;
                    }
                }
                if (!layerId) {
                    for (let dy = -1; dy <= 1 && !layerId; dy++) {
                        for (let dx = -1; dx <= 1; dx++) {
                            if (dx === 0 && dy === 0) continue;
                            const ni = coordToIndex(x + dx, y + dy);
                            if (selected.has(ni)) {
                                layerId = selected.get(ni);
                                break;
                            }
                        }
                    }
                }
                if (!layerId) continue;
                const color = nodes.getProperty(layerId, 'color');
                const name = nodes.getProperty(layerId, 'name');
                let group = colorGroups.get(color);
                if (!group) {
                    group = { name, color, pixels: [] };
                    colorGroups.set(color, group);
                }
                group.pixels.push(pixel);
            }

            const topId = nodeQuery.uppermost(nodeTree.selectedIds);
            const newLayerIds = [];
            for (const { name, color, pixels } of colorGroups.values()) {
                const components = groupConnectedPixels(pixels);
                for (const comp of components) {
                    const id = nodes.createLayer({ name, color });
                    pixelStore.set(id, comp);
                    newLayerIds.push(id);
                }
            }
            if (newLayerIds.length) {
                nodeTree.insert(newLayerIds, topId, false);
                nodeTree.replaceSelection(newLayerIds);
            }
        }

        tool.setShape('stroke');
        tool.useRecent();
    });

    return { usable };
});
