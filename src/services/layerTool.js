import { defineStore } from 'pinia';
import { useStore } from '../stores';
import { useLayerQueryService } from './layerQuery';
import { findPixelComponents, getPixelUnion, averageColorU32 } from '../utils';

export const useLayerToolService = defineStore('layerToolService', () => {
    const { nodeTree, nodes } = useStore();
    const layerQuery = useLayerQueryService();

    function mergeSelected() {
        if (nodeTree.selectedLayerCount < 2) return;
        const pixelUnion = getPixelUnion(nodes.getProperties(nodeTree.selectedLayerIds));

        const colors = [];
        if (pixelUnion.length) {
            for (const coord of pixelUnion) {
                colors.push(nodes.compositeColorAt(coord));
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
        if (newPixels.length) nodes.addPixelsToLayer(newLayerId, newPixels);
        nodeTree.insert([newLayerId], layerQuery.lowermost(nodeTree.selectedLayerIds), true);
        const ids = nodeTree.selectedLayerIds;
        nodes.remove(ids);
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
            const pixels = [...layer.pixels];
            const attrs = layer.attributes;
            const newLayerId = nodes.createLayer({
                name: `Copy of ${layer.name}`,
                color: layer.color,
                visibility: layer.visibility,
                pixels,
                attributes: attrs,
            });
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
            const pixels = nodes.getProperty(layerId, 'pixels');
            if (pixels.length < 2) continue;

            const components = findPixelComponents(pixels);
            if (components.length <= 1) continue;

            const originalLayer = nodes.getProperties(layerId);
            const originalName = originalLayer.name;
            const originalColor = originalLayer.color;
            const originalVisibility = originalLayer.visibility;
            const originalAttrs = originalLayer.attributes;
            const originalIndex = nodeTree.indexOfLayer(layerId);

            const newIds = components.reverse().map((componentPixels, index) => {
                return nodes.createLayer({
                    name: `${originalName} #${components.length - index}`,
                    color: originalColor,
                    visibility: originalVisibility,
                    pixels: componentPixels,
                    attributes: originalAttrs,
                });
            });

            nodes.remove([layerId]);

            const target = nodeTree.layerIdsBottomToTop[originalIndex];
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

