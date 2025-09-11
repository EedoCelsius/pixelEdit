import { defineStore } from 'pinia';
import { watch, computed } from 'vue';
import { useToolSelectionService } from './toolSelection';
import { useHamiltonianService } from './hamiltonian';
import { useLayerQueryService } from './layerQuery';
import { useNodeQueryService } from './nodeQuery';
import { useLayerToolService } from './layerTool';
import { useStore } from '../stores';
import { CURSOR_STYLE } from '@/constants';
import { coordToIndex, indexToCoord, getPixelUnion, groupConnectedPixels } from '../utils/pixels.js';
import { OT } from '../stores/pixels';

async function pathOp(tool, hamiltonian, layerQuery, nodeTree, nodes, pixelStore, nodeQuery) {
    tool.setCursor({ wand: CURSOR_STYLE.WAIT });
    let baseName;
    if (nodeTree.selectedGroupCount > 0 || nodeTree.selectedLayerCount >= 2) {
        const baseId = nodeQuery.lowermost(
            nodeQuery.shallowest(nodeTree.selectedNodeIds)
        );
        baseName = nodes.name(baseId);
        const { mergeSelected } = useLayerToolService();
        const mergedId = mergeSelected();
        nodeTree.replaceSelection([mergedId]);
    } else {
        baseName = nodes.name(nodeTree.selectedLayerIds[0]);
    }
    const target = nodeTree.selectedLayerIds[0];
    const paths = await hamiltonian.traverseFree(pixelStore.get(target));
    const color = nodes.color(target);
    const groupId = nodes.addGroup({ name: `${baseName} Paths` });
    nodeTree.insert([groupId], layerQuery.lowermost([target]), true);
    nodeTree.remove([target]);
    nodes.remove([target]);
    pixelStore.removeLayer([target]);
    paths.forEach((path, idx) => {
        const subGroupId = nodes.addGroup({ name: `Path ${idx + 1}` });
        nodeTree.append([subGroupId], groupId, false);
        const ids = [];
        path.forEach((pixel, j) => {
            const lid = nodes.addLayer({ name: `Pixel ${j + 1}`, color });
            pixelStore.addLayer(lid);
            pixelStore.add(lid, [pixel]);
            ids.push(lid);
        });
        nodeTree.append(ids, subGroupId, false);
    });
    nodeTree.replaceSelection([groupId]);
}

function relayOrientationOp(nodeTree, nodes, pixelStore) {
    const averageOf = (id) => {
        const pixels = pixelStore.get(id);
        if (!pixels.size) return null;
        let sx = 0, sy = 0;
        for (const p of pixels.keys()) {
            const [x, y] = indexToCoord(p);
            sx += x;
            sy += y;
        }
        return [sx / pixels.size, sy / pixels.size];
    };

    const selected = nodeTree.layerOrder.filter(id => nodeTree.selectedLayerIds.includes(id));
    const cache = new Map();
    const getAvg = (id) => {
        if (!cache.has(id)) cache.set(id, averageOf(id));
        return cache.get(id);
    };

    const groups = new Map();
    for (const id of selected) {
        const parent = nodeTree._findNode(id)?.parent?.id ?? null;
        if (!groups.has(parent)) groups.set(parent, []);
        groups.get(parent).push(id);
    }

    for (const group of groups.values()) {
        const len = group.length;
        for (let i = 0; i < len; i++) {
            const id = group[i];
            let orientation = null;
            for (let dist = 1; dist < len; dist++) {
                const topAvg = getAvg(group[(i - dist + len) % len]);
                const bottomAvg = getAvg(group[(i + dist) % len]);
                if (!topAvg || !bottomAvg) continue;
                const dx = bottomAvg[0] - topAvg[0];
                const dy = bottomAvg[1] - topAvg[1];
                if (Math.abs(dx) === Math.abs(dy)) continue;
                orientation = Math.abs(dx) > Math.abs(dy) ? OT.HORIZONTAL : OT.VERTICAL;
                if (dist >= 2) orientation = orientation === OT.HORIZONTAL ? OT.VERTICAL : OT.HORIZONTAL;
                break;
            }
            if (orientation) pixelStore.override(id, pixelStore.get(id).keys(), orientation);
        }
    }
}

function relayMergeOp(nodeTree, nodes, pixelStore) {
    const selected = nodeTree.layerOrder.filter(id => nodeTree.selectedLayerIds.includes(id));
    const layers = new Map();
    for (const id of selected) {
        const pixels = new Set(pixelStore.get(id).keys());
        const first = pixelStore.get(id).values().next();
        const orientation = first.done ? null : first.value;
        layers.set(id, { orientation, pixels });
    }
    const order = selected.slice();
    const removed = [];
    for (let i = 0; order.length > 1 && i < order.length; ) {
        const baseId = order[i];
        const nextIndex = (i + 1) % order.length;
        const nextId = order[nextIndex];
        if (baseId === nextId) break;
        const base = layers.get(baseId);
        const next = layers.get(nextId);
        if (base.orientation && base.orientation === next?.orientation) {
            const union = getPixelUnion([base.pixels, next.pixels]);
            if (groupConnectedPixels(union).length === 1) {
                for (const px of next.pixels) base.pixels.add(px);
                removed.push(nextId);
                layers.delete(nextId);
                order.splice(nextIndex, 1);
                if (nextIndex < i) i--;
                continue;
            }
        }
        i++;
    }
    if (removed.length) {
        const ids = nodeTree.remove(removed);
        nodes.remove(ids);
        pixelStore.removeLayer(ids);
    }
    for (const [id, { orientation, pixels }] of layers) {
        if (orientation) pixelStore.override(id, pixels, orientation);
    }
    nodeTree.replaceSelection([...layers.keys()]);
}

function expandOp(nodeTree, nodes, pixelStore, nodeQuery, viewportStore) {
    const width = viewportStore.stage.width;
    const height = viewportStore.stage.height;

    const selected = new Map();
    for (const id of nodeTree.selectedLayerIds) {
        for (const px of pixelStore.get(id).keys()) selected.set(px, id);
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
            const color = nodes.color(layerId);
            const name = nodes.name(layerId);
            let group = colorGroups.get(color);
            if (!group) {
                group = { name, color, pixels: new Set() };
                colorGroups.set(color, group);
            }
            group.pixels.add(pixel);
        }

        const topId = nodeQuery.uppermost(nodeTree.selectedIds);
        const newLayerIds = [];
        for (const { name, color, pixels } of colorGroups.values()) {
            const components = groupConnectedPixels(pixels);
            for (const comp of components) {
                const id = nodes.addLayer({ name, color });
                pixelStore.addLayer(id);
                pixelStore.add(id, comp);
                newLayerIds.push(id);
            }
        }
        if (newLayerIds.length) {
            nodeTree.insert(newLayerIds, topId, false);
            nodeTree.replaceSelection(newLayerIds);
        }
    }
}
export const usePathToolService = defineStore('pathToolService', () => {
    const tool = useToolSelectionService();
    const hamiltonian = useHamiltonianService();
    const layerQuery = useLayerQueryService();
    const nodeQuery = useNodeQueryService();
    const { nodeTree, nodes, pixels: pixelStore } = useStore();
    const usable = computed(() => tool.shape === 'wand' && nodeTree.selectedLayerCount === 1);

    watch(() => tool.current, async (p) => {
        if (p !== 'path') return;
        await pathOp(tool, hamiltonian, layerQuery, nodeTree, nodes, pixelStore, nodeQuery);
        tool.setShape('stroke');
        tool.useRecent();
    });

  return { usable };
});

export const useRelayToolService = defineStore('relayToolService', () => {
    const tool = useToolSelectionService();
    const { nodeTree, nodes, pixels: pixelStore } = useStore();
    const usable = computed(() => tool.shape === 'wand' && nodeTree.selectedLayerCount > 1);
    watch(() => tool.current, (p) => {
        if (p !== 'relay') return;
        relayOrientationOp(nodeTree, nodes, pixelStore);
        relayMergeOp(nodeTree, nodes, pixelStore);
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
        expandOp(nodeTree, nodes, pixelStore, nodeQuery, viewportStore);
        tool.setShape('stroke');
        tool.useRecent();
    });

    return { usable };
});

export const useBorderToolService = defineStore('borderToolService', () => {
    const tool = useToolSelectionService();
    const hamiltonian = useHamiltonianService();
    const layerQuery = useLayerQueryService();
    const nodeQuery = useNodeQueryService();
    const { nodeTree, nodes, pixels: pixelStore } = useStore();
    const usable = computed(() => tool.shape === 'wand' && nodeTree.selectedLayerCount === 1);

    watch(() => tool.current, async (p) => {
        if (p !== 'border') return;
        await pathOp(tool, hamiltonian, layerQuery, nodeTree, nodes, pixelStore, nodeQuery);
        relayOrientationOp(nodeTree, nodes, pixelStore);
        relayMergeOp(nodeTree, nodes, pixelStore);
        tool.setShape('stroke');
        tool.useRecent();
    });

    return { usable };
});

export const useMarginToolService = defineStore('marginToolService', () => {
    const tool = useToolSelectionService();
    const hamiltonian = useHamiltonianService();
    const layerQuery = useLayerQueryService();
    const nodeQuery = useNodeQueryService();
    const { nodeTree, nodes, pixels: pixelStore, viewport: viewportStore } = useStore();
    const usable = computed(() => tool.shape === 'wand' && nodeTree.selectedLayerCount > 0);

    watch(() => tool.current, async (p) => {
        if (p !== 'margin') return;
        expandOp(nodeTree, nodes, pixelStore, nodeQuery, viewportStore);
        for (const id of nodeTree.selectedLayerIds) {
            nodes.setColor(id, 0xFFFFFFFF);
        }
        await pathOp(tool, hamiltonian, layerQuery, nodeTree, nodes, pixelStore, nodeQuery);
        relayOrientationOp(nodeTree, nodes, pixelStore);
        relayMergeOp(nodeTree, nodes, pixelStore);
        tool.setShape('stroke');
        tool.useRecent();
    });

    return { usable };
});
