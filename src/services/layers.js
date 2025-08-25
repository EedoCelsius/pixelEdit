import { defineStore } from 'pinia';
import { useStore } from '../stores';
import { useLayerPanelService } from './layerPanel';
import { useQueryService } from './query';
import { keyToCoords, buildOutline, findPixelComponents, getPixelUnionSet, averageColorU32 } from '../utils';

export const useLayerService = defineStore('layerService', () => {
    const { layers } = useStore();
    const layerPanel = useLayerPanelService();
    const query = useQueryService();

    function mergeSelected() {
        if (layers.selectionCount < 2) return;
        const pixelUnionSet = getPixelUnionSet(layers.getProperties(layers.selectedIds));

        const colors = [];
        if (pixelUnionSet.size) {
            for (const pixelKey of pixelUnionSet) {
                const [x, y] = keyToCoords(pixelKey);
                colors.push(layers.compositeColorAt(x, y));
            }
        } else {
            for (const id of layers.selectedIds) {
                colors.push(layers.getProperty(id, 'color'));
            }
        }
        const colorU32 = averageColorU32(colors);

        const anchorName = layers.getProperty(layerPanel.anchorId, 'name') || 'Merged';
        const newLayerId = layers.createLayer({ name: `Merged ${anchorName}`, color: colorU32 });
        const newPixels = [...pixelUnionSet].map(keyToCoords);
        if (newPixels.length) layers.addPixels(newLayerId, newPixels);
        layers.reorderLayers([newLayerId], query.lowermost(layers.selectedIds), true);
        const ids = layers.selectedIds;
        layers.deleteLayers(ids);
        layers.removeFromSelection(ids);
        return newLayerId;
    }

    function copySelected() {
        if (!layers.selectionCount) return [];
        const newLayerIds = [];
        for (const id of layers.selectedIds) {
            const layer = layers.getProperties(id);
            const pixels = [...layer.pixels];
            const newLayerId = layers.createLayer({
                name: `Copy of ${layer.name}`,
                color: layer.color,
                visible: layer.visible,
                pixels
            }, id);
            newLayerIds.push(newLayerId);
        }
        return newLayerIds;
    }

    function selectionPath() {
        if (!layers.selectionCount) return '';
        const pixelUnionSet = getPixelUnionSet(layers.getProperties(layers.selectedIds));
        const groups = buildOutline(pixelUnionSet);
        const pathData = [];
        for (const group of groups)
            for (const [[x0, y0], [x1, y1]] of group)
                pathData.push(`M ${x0} ${y0} L ${x1} ${y1}`);
        return pathData.join(' ');
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
        const originalVisibility = originalLayer.visible;
        const originalIndex = layers.indexOfLayer(layerId);

        const newIds = components.reverse().map((componentPixels, index) => (
            layers.createLayer({
                name: `${originalName} #${components.length - index}`,
                color: originalColor,
                visible: originalVisibility,
                pixels: componentPixels
            })
        ));

        layers.deleteLayers([layerId]);

        const currentOrder = layers.idsBottomToTop.slice();
        const orderWithoutNew = currentOrder.filter(i => !newIds.includes(i));
        orderWithoutNew.splice(originalIndex, 0, ...newIds.reverse());
        layers._order = orderWithoutNew;

        layers.replaceSelection(newIds);
        return newIds;
    }

    return {
        mergeSelected,
        copySelected,
        selectionPath,
        splitLayer,
    };
});

