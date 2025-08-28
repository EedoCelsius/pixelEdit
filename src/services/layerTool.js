import { defineStore } from 'pinia';
import { useStore } from '../stores';
import { useLayerPanelService } from './layerPanel';
import { useQueryService } from './query';
import { findPixelComponents, getPixelUnion, averageColorU32 } from '../utils';

export const useLayerToolService = defineStore('layerToolService', () => {
    const { layers } = useStore();
    const layerPanel = useLayerPanelService();
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

        const anchorName = layers.getProperty(layerPanel.anchorId, 'name') || 'Merged';
        const newLayerId = layers.createLayer({ name: `Merged ${anchorName}`, color: colorU32 });
        const newPixels = pixelUnion;
        if (newPixels.length) layers.addPixels(newLayerId, newPixels);
        layers.insertLayers([newLayerId], query.lowermost(layers.selectedIds), true);
        const ids = layers.selectedIds;
        layers.deleteLayers(ids);
        layers.removeFromSelection(ids);
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
            const newLayerId = layers.createLayer({
                name: `Copy of ${layer.name}`,
                color: layer.color,
                visibility: layer.visibility,
                pixels
            });
            newLayerIds.push(newLayerId);
        }
        layers.insertLayers(newLayerIds, query.uppermost(sorted), false);
        return newLayerIds;
    }

    function splitLayer(layerId) {
        if (layerId == null) return;
        if (layers.getProperty(layerId, 'pixels').length < 2) return;

        const pixels = layers.getProperty(layerId, 'pixels');
        const components = findPixelComponents(pixels);
        if (components.length <= 1) return;

        const originalLayer = layers.getProperties(layerId);
        const originalName = originalLayer.name;
        const originalColor = originalLayer.color;
        const originalVisibility = originalLayer.visibility;
        const originalIndex = layers.indexOfLayer(layerId);

        const newIds = components.reverse().map((componentPixels, index) => {
            return layers.createLayer({
                name: `${originalName} #${components.length - index}`,
                color: originalColor,
                visibility: originalVisibility,
                pixels: componentPixels
            });
        });

        layers.deleteLayers([layerId]);

        const target = layers.idsBottomToTop[originalIndex];
        layers.insertLayers(newIds, target, true);

        layers.replaceSelection(newIds);
        return newIds;
    }

    return {
        mergeSelected,
        copySelected,
        splitLayer,
    };
});

