import { defineStore } from 'pinia';
import { useLayerStore } from '../stores/layers';
import { useLayerPanelStore } from '../stores/layerPanel';
import { keyToCoords, buildOutline, findPixelComponents, getPixelUnionSet } from '../utils';

export const useLayerService = defineStore('layerService', () => {
    const layers = useLayerStore();
    const layerPanel = useLayerPanelStore();

    function forEachSelected(fn) {
        for (const id of layers.selectedIds) {
            const layer = layers.getLayer(id);
            if (layer) fn(layer, id);
        }
    }

    function setColorForSelectedU32(colorU32) {
        for (const id of layers.selectedIds) {
            if (layers.lockedOf(id)) continue;
            layers.updateLayer(id, { colorU32 });
        }
    }

    function setLockedForSelected(isLocked) {
        for (const id of layers.selectedIds) {
            layers.updateLayer(id, { locked: isLocked });
        }
    }

    function setVisibilityForSelected(isVisible) {
        for (const id of layers.selectedIds) {
            layers.updateLayer(id, { visible: isVisible });
        }
    }

    function deleteSelected() {
        const ids = layers.selectedIds;
        layers.deleteLayers(ids);
        layers.removeFromSelection(ids);
        layerPanel.clearRange();
    }

    function reorderGroup(selIds, targetId, placeBelow = true) {
        layers.reorderLayers(selIds, targetId, placeBelow);
    }

    function mergeSelected() {
        if (layers.selectionCount < 2) return;
        const pixelUnionSet = getPixelUnionSet(layers.getLayers(layers.selectedIds));

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
            r = Math.round(r / layers.selectionCount);
            g = Math.round(g / layers.selectionCount);
            b = Math.round(b / layers.selectionCount);
        }
        const colorU32 = (((r & 255) << 24) | ((g & 255) << 16) | ((b & 255) << 8) | 255) >>> 0;

        const anchorName = layers.nameOf(layerPanel.anchorId) || 'Merged';
        const newLayerId = layers.createLayer({ name: `Merged ${anchorName}`, colorU32 });
        const layer = layers.getLayer(newLayerId);
        for (const k of pixelUnionSet) layer.addPixels([keyToCoords(k)]);
        layers.reorderLayers([newLayerId], layers.lowermostIdOf(layers.selectedIds), true);
        deleteSelected();
        return newLayerId;
    }

    function copySelected() {
        if (!layers.selectionCount) return [];
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
        if (!layers.selectionCount) return '';
        const pixelUnionSet = getPixelUnionSet(layers.getLayers(layers.selectedIds));
        const groups = buildOutline(pixelUnionSet);
        const pathData = [];
        for (const group of groups)
            for (const [[x0, y0], [x1, y1]] of group)
                pathData.push(`M ${x0} ${y0} L ${x1} ${y1}`);
        return pathData.join(' ');
    }

    function selectEmptyLayers() {
        const ids = layers.order.filter(layerId => layers.pixelCountOf(layerId) === 0);
        if (ids.length) {
            layers.replaceSelection(ids);
            layerPanel.setRange(ids[0], ids[0]);
        }
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

        layers.replaceSelection(newIds);
        layerPanel.setRange(newIds[0], newIds[0]);
    }

    function selectDisconnectedLayers(id) {
        const idsToSelect = layers.order.filter(layerId => layers.disconnectedCountOf(layerId) > 1);
        if (idsToSelect.length) {
            layers.replaceSelection(idsToSelect);
            layerPanel.setRange(id, id);
        }
    }

    function selectByDisconnectedCount(id) {
        const targetLayer = layers.getLayer(id);
        if (!targetLayer) return;
        const targetCount = targetLayer.disconnectedCount;
        if (targetCount <= 1) {
            layerPanel.setRange(id, id);
            return;
        }
        const idsToSelect = layers.order.filter(layerId => layers.disconnectedCountOf(layerId) === targetCount);
        if (idsToSelect.length) {
            layers.replaceSelection(idsToSelect);
            layerPanel.setRange(id, id);
        }
    }

    function selectByPixelCount(id) {
        const targetLayer = layers.getLayer(id);
        if (!targetLayer) return;
        const targetCount = targetLayer.pixelCount;
        if (targetCount === 0) {
            layerPanel.setRange(id, id);
            return;
        }
        const idsToSelect = layers.order.filter(layerId => layers.pixelCountOf(layerId) === targetCount);
        if (idsToSelect.length) {
            layers.replaceSelection(idsToSelect);
            layerPanel.setRange(id, id);
        }
    }

    function selectByColor(id) {
        const targetLayer = layers.getLayer(id);
        if (!targetLayer) return;
        const targetColor = targetLayer.getColorU32();
        const idsToSelect = layers.order.filter(layerId => layers.colorOf(layerId) === targetColor);
        if (idsToSelect.length) {
            layers.replaceSelection(idsToSelect);
            layerPanel.setRange(id, id);
        }
    }

    return {
        forEachSelected,
        setColorForSelectedU32,
        setLockedForSelected,
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

