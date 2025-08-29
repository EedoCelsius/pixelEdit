import { defineStore } from 'pinia';
import { useStore } from '../stores';
import { useLayerQueryService } from './layerQuery';
import { findPixelComponents, getPixelUnion, averageColorU32 } from '../utils';

export const useLayerToolService = defineStore('layerToolService', () => {
    const { nodeTree, nodes, pixels } = useStore();
    const layerQuery = useLayerQueryService();

    function mergeSelected() {
        if (nodeTree.selectedLayerCount < 2) return;
        const pixelUnion = getPixelUnion(pixels.getProperties(nodeTree.selectedLayerIds));

        const colors = [];
        if (pixelUnion.length) {
            for (const coord of pixelUnion) {
                const id = layerQuery.topVisibleAt(coord);
                colors.push(id ? nodes.getProperty(id, 'color') : 0);
            }
        } else {
            for (const id of nodeTree.selectedLayerIds) {
                colors.push(nodes.getProperty(id, 'color'));
            }
        }
        const colorU32 = averageColorU32(colors);

        const firstId = nodeTree.selectedLayerIds[0];
        const maintainedName = nodes.getProperty(firstId, 'name') || 'Merged';
        const maintainedAttrs = nodes.getProperty(firstId, 'attributes');
        const newLayerId = nodes.createLayer({
            name: `Merged ${maintainedName}`,
            color: colorU32,
            attributes: maintainedAttrs,
        });
        const newPixels = pixelUnion;
        if (newPixels.length) pixels.addPixels(newLayerId, newPixels);
        nodeTree.insert([newLayerId], layerQuery.lowermost(nodeTree.selectedLayerIds), true);
        const ids = nodeTree.selectedLayerIds;
        const removed = nodeTree.remove(ids);
        nodes.remove(removed);
        pixels.remove(removed);
        return newLayerId;
    }

    function copySelected() {
        if (!nodeTree.selectedLayerCount) return [];
        const sorted = nodeTree.selectedLayerIds
            .slice()
            .sort((a, b) => nodeTree.indexOfLayer(a) - nodeTree.indexOfLayer(b));
        const newLayerIds = [];
        for (const id of sorted) {
            const layer = nodes.getProperties(id);
            const px = pixels.get(id);
            const attrs = layer.attributes;
            const newLayerId = nodes.createLayer({
                name: `Copy of ${layer.name}`,
                color: layer.color,
                visibility: layer.visibility,
                attributes: attrs,
            });
            if (px.length) pixels.set(newLayerId, px);
            newLayerIds.push(newLayerId);
        }
        nodeTree.insert(newLayerIds, layerQuery.uppermost(sorted), false);
        return newLayerIds;
    }

    function splitSelected() {
        if (!nodeTree.selectedLayerCount) return [];

        const originalSelected = nodeTree.selectedLayerIds.slice();
        const sorted = originalSelected
            .slice()
            .sort((a, b) => nodeTree.indexOfLayer(a) - nodeTree.indexOfLayer(b));
        const newSelection = new Set(originalSelected);
        const allNewIds = [];

        for (const layerId of sorted) {
            const px = pixels.get(layerId);
            if (px.length < 2) continue;

            const components = findPixelComponents(px);
            if (components.length <= 1) continue;

            const originalLayer = nodes.getProperties(layerId);
            const originalName = originalLayer.name;
            const originalColor = originalLayer.color;
            const originalVisibility = originalLayer.visibility;
            const originalAttrs = originalLayer.attributes;
            const originalIndex = nodeTree.indexOfLayer(layerId);

            const newIds = components.reverse().map((componentPixels, index) => {
                const newId = nodes.createLayer({
                    name: `${originalName} #${components.length - index}`,
                    color: originalColor,
                    visibility: originalVisibility,
                    attributes: originalAttrs,
                });
                pixels.set(newId, componentPixels);
                return newId;
            });

            const removed = nodeTree.remove([layerId]);
            const target = nodeTree.layerIdsBottomToTop[originalIndex];
            nodes.remove(removed);
            pixels.remove(removed);
            nodeTree.insert(newIds, target, true);

            newSelection.delete(layerId);
            for (const id of newIds) newSelection.add(id);
            allNewIds.push(...newIds);
        }

        nodeTree.replaceSelection([...newSelection]);
        return allNewIds;
    }

    return {
        mergeSelected,
        copySelected,
        splitSelected,
    };
});

