import { defineStore } from 'pinia';
import { useLayerStore } from '../stores/layers';
import { useLayerPanelStore } from '../stores/layerPanel';
import { useQueryService } from './query';
import { keyToCoords, buildOutline, findPixelComponents, getPixelUnionSet, averageColorU32 } from '../utils';

export const useLayerService = defineStore('layerService', () => {
    const layers = useLayerStore();
    const layerPanel = useLayerPanelStore();
    const query = useQueryService();

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

        const colors = [];
        if (pixelUnionSet.size) {
            for (const pixelKey of pixelUnionSet) {
                const [x, y] = keyToCoords(pixelKey);
                colors.push(layers.compositeColorAt(x, y));
            }
        } else {
            forEachSelected(L => {
                colors.push(L.getColorU32());
            });
        }
        const colorU32 = averageColorU32(colors);

        const anchorName = layers.nameOf(layerPanel.anchorId) || 'Merged';
        const newLayerId = layers.createLayer({ name: `Merged ${anchorName}`, colorU32 });
        const layer = layers.getLayer(newLayerId);
        for (const k of pixelUnionSet) layer.addPixels([keyToCoords(k)]);
        layers.reorderLayers([newLayerId], query.lowermostIdOf(layers.selectedIds), true);
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

