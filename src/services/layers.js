import { defineStore } from 'pinia';
import { useLayerStore } from '../stores/layers';
import { useSelectionStore } from '../stores/selection';
import { keyToCoords, buildOutline, findPixelComponents, getPixelUnionSet } from '../utils';

export const useLayerService = defineStore('layerService', () => {
    const layers = useLayerStore();
    const selection = useSelectionStore();

    function forEachSelected(fn) {
        for (const id of selection.ids) {
            const layer = layers.getLayer(id);
            if (layer) fn(layer, id);
        }
    }

    function setColorForSelectedU32(colorU32) {
        for (const id of selection.ids) {
            layers.updateLayer(id, { colorU32 });
        }
    }

    function setVisibilityForSelected(isVisible) {
        for (const id of selection.ids) {
            layers.updateLayer(id, { visible: isVisible });
        }
    }

    function deleteSelected() {
        const ids = selection.ids;
        layers.deleteLayers(ids);
        selection.removeMany(ids);
    }

    function reorderGroup(selIds, targetId, placeBelow = true) {
        layers.reorderLayers(selIds, targetId, placeBelow);
        const newAnchorId = selection.anchorId;
        selection.replace(selIds, newAnchorId, newAnchorId);
    }

    function mergeSelected() {
        if (selection.count < 2) return;
        const pixelUnionSet = getPixelUnionSet(layers.getLayers(selection.ids));

        let r = 0, g = 0, b = 0;
        if (pixelUnionSet.size) {
            for (const pixelKey of pixelUnionSet) {
                const [x, y] = keyToCoords(pixelKey);
                const colorU32 = layers.compositeColorAt(x, y);
                r += (colorU32 >>> 24) & 255;
                g += (colorU32 >>> 16) & 255;
                b += (colorU32 >>> 8) & 255;
            }
            r = Math.round(r / pixelUnionSet.size);
            g = Math.round(g / pixelUnionSet.size);
            b = Math.round(b / pixelUnionSet.size);
        } else {
            forEachSelected(L => {
                const colorU32 = L.getColorU32();
                r += (colorU32 >>> 24) & 255;
                g += (colorU32 >>> 16) & 255;
                b += (colorU32 >>> 8) & 255;
            });
            r = Math.round(r / selection.count);
            g = Math.round(g / selection.count);
            b = Math.round(b / selection.count);
        }
        const colorU32 = (((r & 255) << 24) | ((g & 255) << 16) | ((b & 255) << 8) | 255) >>> 0;

        const anchorName = layers.nameOf(selection.anchorId) || 'Merged';
        const newLayerId = layers.createLayer({ name: `Merged ${anchorName}`, colorU32 });
        const layer = layers.getLayer(newLayerId);
        for (const k of pixelUnionSet) layer.addPixels([keyToCoords(k)]);
        layers.reorderLayers([newLayerId], layers.lowermostIdOf(selection.ids), true);
        deleteSelected();
        return newLayerId;
    }

    function copySelected() {
        if (!selection.count) return [];
        const newLayerIds = [];
        forEachSelected((layer, id) => {
            const newLayerId = layers.createLayer({
                name: `Copy of ${layer.name}`,
                colorU32: layer.getColorU32(),
                visible: layer.visible,
                pixels: layer.snapshotPixels()
            }, id);
            newLayerIds.push(newLayerId);
        });
        return newLayerIds;
    }

    function selectionPath() {
        if (!selection.count) return '';
        const pixelUnionSet = getPixelUnionSet(layers.getLayers(selection.ids));
        const groups = buildOutline(pixelUnionSet);
        const pathData = [];
        for (const group of groups)
            for (const [[x0, y0], [x1, y1]] of group)
                pathData.push(`M ${x0} ${y0} L ${x1} ${y1}`);
        return pathData.join(' ');
    }

    function selectEmptyLayers() {
        const ids = layers.order.filter(layerId => layers.pixelCountOf(layerId) === 0);
        if (ids.length) selection.replace(ids, ids[0], ids[0]);
    }

    function splitLayer(layerId) {
        if (layerId == null) return;
        const layer = layers.getLayer(layerId);
        if (!layer || layer.pixelCount < 2) return;

        const pixels = layer.snapshotPixels();
        const components = findPixelComponents(pixels);
        if (components.length <= 1) return;

        const originalName = layers.nameOf(layerId);
        const originalColor = layer.getColorU32();
        const originalVisibility = layer.visible;
        const originalIndex = layers.indexOfLayer(layerId);

        const newIds = components.reverse().map((componentPixels, index) => (
            layers.createLayer({
                name: `${originalName} #${components.length - index}`,
                colorU32: originalColor,
                visible: originalVisibility,
                pixels: componentPixels
            })
        ));

        layers.deleteLayers([layerId]);

        const currentOrder = layers.idsBottomToTop.slice();
        const orderWithoutNew = currentOrder.filter(i => !newIds.includes(i));
        orderWithoutNew.splice(originalIndex, 0, ...newIds.reverse());
        layers._order = orderWithoutNew;

        selection.replace(newIds, newIds[0], newIds[0]);
    }

    function selectDisconnectedLayers(id) {
        const idsToSelect = layers.order.filter(layerId => layers.disconnectedCountOf(layerId) > 1);
        if (idsToSelect.length) selection.replace(idsToSelect, id, id);
    }

    function selectByDisconnectedCount(id) {
        const targetLayer = layers.getLayer(id);
        if (!targetLayer) return;
        const targetCount = targetLayer.disconnectedCount;
        if (targetCount <= 1) {
            selection.selectOne(id);
            return;
        }
        const idsToSelect = layers.order.filter(layerId => layers.disconnectedCountOf(layerId) === targetCount);
        if (idsToSelect.length) selection.replace(idsToSelect, id, id);
    }

    function selectByPixelCount(id) {
        const targetLayer = layers.getLayer(id);
        if (!targetLayer) return;
        const targetCount = targetLayer.pixelCount;
        if (targetCount === 0) {
            selection.selectOne(id);
            return;
        }
        const idsToSelect = layers.order.filter(layerId => layers.pixelCountOf(layerId) === targetCount);
        if (idsToSelect.length) selection.replace(idsToSelect, id, id);
    }

    function selectByColor(id) {
        const targetLayer = layers.getLayer(id);
        if (!targetLayer) return;
        const targetColor = targetLayer.getColorU32();
        const idsToSelect = layers.order.filter(layerId => layers.colorOf(layerId) === targetColor);
        if (idsToSelect.length) selection.replace(idsToSelect, id, id);
    }

    return {
        forEachSelected,
        setColorForSelectedU32,
        setVisibilityForSelected,
        deleteSelected,
        reorderGroup,
        mergeSelected,
        copySelected,
        selectionPath,
        selectEmptyLayers,
        splitLayer,
        selectByPixelCount,
        selectByColor,
        selectDisconnectedLayers,
        selectByDisconnectedCount
    };
});

