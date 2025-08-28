import { defineStore } from 'pinia';
import { useStore } from '../stores';
import { useQueryService } from './query';
import { findPixelComponents, getPixelUnion, averageColorU32 } from '../utils';

export const useLayerToolService = defineStore('layerToolService', () => {
    const { layers } = useStore();
    const query = useQueryService();

    function mergeSelected() {
        if (layers.selectionCount < 2) return;
        const pixelUnion = getPixelUnion(layers.getProperties(layers.selectedIds));

        const colors = [];
        if (pixelUnion.length) {
            for (const coord of pixelUnion) {
                colors.push(layers.compositeColorAt(coord));
            }
        } else {
            for (const id of layers.selectedIds) {
                colors.push(layers.getProperty(id, 'color'));
            }
        }
        const colorU32 = averageColorU32(colors);

        const firstId = layers.selectedIds[0];
        const maintainedName = layers.getProperty(firstId, 'name') || 'Merged';
        const maintainedAttrs = layers.getProperty(firstId, 'attributes');
        const newLayerId = layers.createLayer({
            name: `Merged ${maintainedName}`,
            color: colorU32,
            attributes: maintainedAttrs,
        });
        const newPixels = pixelUnion;
        if (newPixels.length) layers.addPixels(newLayerId, newPixels);
        layers.insertLayers([newLayerId], query.lowermost(layers.selectedIds), true);
        const ids = layers.selectedIds;
        layers.deleteLayers(ids);
        return newLayerId;
    }

    function copySelected() {
        if (!layers.selectionCount) return [];
        const sorted = layers.selectedIds
            .slice()
            .sort((a, b) => layers.indexOfLayer(a) - layers.indexOfLayer(b));
        const newLayerIds = [];
        for (const id of sorted) {
            const layer = layers.getProperties(id);
            const pixels = [...layer.pixels];
            const attrs = layer.attributes;
            const newLayerId = layers.createLayer({
                name: `Copy of ${layer.name}`,
                color: layer.color,
                visibility: layer.visibility,
                pixels,
                attributes: attrs,
            });
            newLayerIds.push(newLayerId);
        }
        layers.insertLayers(newLayerIds, query.uppermost(sorted), false);
        return newLayerIds;
    }

    function splitSelected() {
        if (!layers.selectionCount) return [];

        const originalSelected = layers.selectedIds.slice();
        const sorted = originalSelected
            .slice()
            .sort((a, b) => layers.indexOfLayer(a) - layers.indexOfLayer(b));
        const newSelection = new Set(originalSelected);
        const allNewIds = [];

        for (const layerId of sorted) {
            const pixels = layers.getProperty(layerId, 'pixels');
            if (pixels.length < 2) continue;

            const components = findPixelComponents(pixels);
            if (components.length <= 1) continue;

            const originalLayer = layers.getProperties(layerId);
            const originalName = originalLayer.name;
            const originalColor = originalLayer.color;
            const originalVisibility = originalLayer.visibility;
            const originalAttrs = originalLayer.attributes;
            const originalIndex = layers.indexOfLayer(layerId);

            const newIds = components.reverse().map((componentPixels, index) => {
                return layers.createLayer({
                    name: `${originalName} #${components.length - index}`,
                    color: originalColor,
                    visibility: originalVisibility,
                    pixels: componentPixels,
                    attributes: originalAttrs,
                });
            });

            layers.deleteLayers([layerId]);

            const target = layers.idsBottomToTop[originalIndex];
            layers.insertLayers(newIds, target, true);

            newSelection.delete(layerId);
            for (const id of newIds) newSelection.add(id);
            allNewIds.push(...newIds);
        }

        layers.replaceSelection([...newSelection]);
        return allNewIds;
    }

    return {
        mergeSelected,
        copySelected,
        splitSelected,
    };
});

