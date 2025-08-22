import { defineStore } from 'pinia';
import { computed } from 'vue';
import { useLayerStore } from '../stores/layers';
import { useSelectionStore } from '../stores/selection';
import { coordsToKey, keyToCoords, buildOutline, findPixelComponents } from '../utils';

export const useLayerService = defineStore('layerService', () => {
    const layers = useLayerStore();
    const selection = useSelectionStore();

    const idsBottomToTop = computed(() => layers.listBottomToTopIds);
    const idsTopToBottom = computed(() => layers.listTopToBottomIds);

    function layerById(id) {
        return layers.get(id);
    }

    // Return U32 composite color at x,y
    function compositeColorAt(x, y) {
        const order = layers.order; // bottom->top
        for (let i = order.length - 1; i >= 0; i--) {
            const layer = layers.layersById[order[i]];
            if (!layer || !layer.visible) continue;
            if (layer.has(x, y)) return layer.getColorU32() >>> 0;
        }
        return 0x00000000 >>> 0;
    }

    function uppermostId() {
        return layers.order[layers.order.length - 1] ?? null;
    }

    function lowermostId() {
        return layers.order[0] ?? null;
    }

    function uppermostIdOf(ids) {
        const idSet = new Set(ids);
        if (!idSet.size) return null;
        const index = Math.max(...layers.order.map((id, idx) => idSet.has(id) ? idx : -1));
        return index >= 0 ? layers.order[index] : null;
    }

    function lowermostIdOf(ids) {
        const idSet = new Set(ids);
        if (!idSet.size) return null;
        const index = Math.min(...layers.order.map((id, idx) => idSet.has(id) ? idx : Infinity));
        return isFinite(index) ? layers.order[index] : null;
    }

    function belowId(id) {
        if (id == null) return null;
        const idx = layers.indexOf(id);
        return layers.order[idx - 1] ?? null;
    }

    function aboveId(id) {
        if (id == null) return null;
        const idx = layers.indexOf(id);
        return layers.order[idx + 1] ?? null;
    }

    function forEachSelected(fn) {
        for (const id of selection.asArray) {
            const layer = layers.get(id);
            if (layer) fn(layer, id);
        }
    }

    function setColorForSelectedU32(colorU32) {
        forEachSelected(L => L.setColorU32(colorU32));
    }

    function setVisibilityForSelected(isVisible) {
        forEachSelected(L => L.visible = isVisible);
    }

    function deleteSelected() {
        layers.remove(selection.asArray);
    }

    function selectRange(anchorId, tailId) {
        const anchorIndex = layers.indexOf(anchorId);
        const tailIndex = layers.indexOf(tailId);
        const slice = layers.order.slice(Math.min(anchorIndex, tailIndex), Math.max(anchorIndex, tailIndex) + 1);
        selection.set(slice, anchorId, tailId);
    }

    function reorderGroup(selIds, targetId, placeBelow = true) {
        layers.reorder(selIds, targetId, placeBelow);
        // keep anchor
        const newAnchorId = selection.anchorId;
        selection.set(selIds, newAnchorId, newAnchorId);
    }

    // Pixel operations
    function addPixelsToSelection(pixels) {
        if (selection.size !== 1) return;
        const id = selection.asArray[0];
        const layer = layers.get(id);
        if (layer) layer.addPixels(pixels);
    }

    function removePixelsFromSelection(pixels) {
        if (selection.size !== 1) return;
        const id = selection.asArray[0];
        const layer = layers.get(id);
        if (layer) layer.removePixels(pixels);
    }

    function togglePointInSelection(x, y) {
        if (selection.size !== 1) return;
        const id = selection.asArray[0];
        const layer = layers.get(id);
        if (layer) layer.togglePixel(x, y);
    }

    function removePixelsFromSelected(pixels) {
        if (!pixels || !pixels.length) return;
        forEachSelected(layer => {
            const pixelsToRemove = [];
            for (const [x, y] of pixels) {
                if (layer.has(x, y)) pixelsToRemove.push([x, y]);
            }
            if (pixelsToRemove.length) layer.removePixels(pixelsToRemove);
        });
    }

    function removePixelsFromAll(pixels) {
        if (!pixels || !pixels.length) return;
        // Remove only if layer actually has the pixel to keep reactivity minimal
        for (const id of layers.order) {
            const layer = layers.layersById[id];
            const pixelsToRemove = [];
            for (const [x, y] of pixels) {
                if (layer.has(x, y)) pixelsToRemove.push([x, y]);
            }
            if (pixelsToRemove.length) layer.removePixels(pixelsToRemove);
        }
    }

    // Complex ops
    function mergeSelected() {
        if (selection.size < 2) return;
        const pixelUnionSet = new Set();
        forEachSelected(L => L.forEachPixel((x, y) => pixelUnionSet.add(coordsToKey(x, y))));

        let r = 0,
            g = 0,
            b = 0;
        if (pixelUnionSet.size) {
            for (const pixelKey of pixelUnionSet) {
                const [x, y] = keyToCoords(pixelKey);
                const colorU32 = compositeColorAt(x, y);
                r += (colorU32 >>> 24) & 255;
                g += (colorU32 >>> 16) & 255;
                b += (colorU32 >>> 8) & 255;
            }
            r = Math.round(r / pixelUnionSet.size), g = Math.round(g / pixelUnionSet.size), b = Math.round(b / pixelUnionSet.size);
        } else {
            forEachSelected(L => {
                const colorU32 = L.getColorU32();
                r += (colorU32 >>> 24) & 255;
                g += (colorU32 >>> 16) & 255;
                b += (colorU32 >>> 8) & 255;
            });
            r = Math.round(r / selection.size), g = Math.round(g / selection.size), b = Math.round(b / selection.size);
        }
        const colorU32 = (((r & 255) << 24) | ((g & 255) << 16) | ((b & 255) << 8) | 255) >>> 0;

        const anchorName = layers.get(selection.anchorId)?.name || 'Merged';
        const newLayerId = layers.create({
            name: `Merged ${anchorName}`,
            colorU32
        });
        const layer = layers.get(newLayerId);
        for (const k of pixelUnionSet) layer.addPixels([keyToCoords(k)]);
        layers.reorder([newLayerId], lowermostIdOf(selection.asArray), true);
        deleteSelected();
        return newLayerId;
    }

    function copySelected() {
        if (!selection.size) return [];
        const newLayerIds = [];
        forEachSelected((layer, id) => {
            const newLayerId = layers.create({
                name: `Copy of ${layer.name}`,
                colorU32: layer.getColorU32(),
                visible: layer.visible,
                pixels: layer.snapshotPixels()
            }, id);
            newLayerIds.push(newLayerId);
        })
        return newLayerIds;
    }

    // Selection helpers
    function selectionPath() {
        if (!selection.size) return '';
        const pixelUnionSet = new Set();
        forEachSelected(L => L.forEachPixel((x, y) => pixelUnionSet.add(coordsToKey(x, y))));
        const groups = buildOutline(pixelUnionSet);
        const pathData = [];
        for (const group of groups)
            for (const [
                    [x0, y0],
                    [x1, y1]
                ] of group) pathData.push(`M ${x0} ${y0} L ${x1} ${y1}`);
        return pathData.join(' ');
    }

    // Small accessors used by templates
    function pathOf(id) {
        return layers.get(id)?.d;
    }

    function colorOf(id) {
        return layers.get(id)?.getColorU32() ?? 0;
    }

    function visibleOf(id) {
        return !!layers.get(id)?.visible;
    }

    function pixelCountOf(id) {
        return layers.get(id)?.pixelCount ?? 0;
    }

    function topVisibleLayerIdAt(x, y) {
        const order = layers.order; // bottom -> top
        for (let i = order.length - 1; i >= 0; i--) {
            const id = order[i];
            const layer = layers.layersById[id];
            if (!layer || !layer.visible) continue;
            if (layer.has(x, y)) return id;
        }
        return null;
    }

    function removeEmptyLayers() {
        const emptyLayerIds = layers.order.filter(id => {
            const layer = layers.get(id);
            return layer && layer.pixelCount === 0;
        });
        if (emptyLayerIds.length > 0) {
            layers.remove(emptyLayerIds);
            selection.clear();
        }
    }

    function splitSelectedLayer() {
        if (selection.size !== 1) return;
        const layerId = selection.asArray[0];
        const layer = layerById(layerId);
        if (!layer || layer.pixelCount < 2) return;

        const pixels = layer.snapshotPixels();
        const components = findPixelComponents(pixels);
        if (components.length <= 1) return;

        const originalName = layer.name;
        const originalColor = layer.getColorU32();
        const originalVisibility = layer.visible;
        const originalIndex = layers.indexOf(layerId);

        const newIds = components.reverse().map((componentPixels, index) => {
            return layers.create({
                name: `${originalName} #${components.length - index}`,
                colorU32: originalColor,
                visible: originalVisibility,
                pixels: componentPixels
            });
        });

        layers.remove([layerId]);

        const currentOrder = layers.listBottomToTopIds();
        const orderWithoutNew = currentOrder.filter(i => !newIds.includes(i));
        orderWithoutNew.splice(originalIndex, 0, ...newIds.reverse());
        layers._order = orderWithoutNew;

        selection.set(newIds, newIds[0], newIds[0]);
    }

    function selectByPixelCount(id) {
        const targetLayer = layerById(id);
        if (!targetLayer) return;
        const targetCount = targetLayer.pixelCount;
        if (targetCount === 0) {
            selection.selectOnly(id);
            return;
        }
        const idsToSelect = layers.order.filter(layerId => {
            const layer = layerById(layerId);
            return layer && layer.pixelCount === targetCount;
        });

        if (idsToSelect.length) {
            selection.set(idsToSelect, id, id);
        }
    }

    return {
        idsBottomToTop,
        idsTopToBottom,
        layerById,
        compositeColorAt,
        uppermostId,
        lowermostId,
        uppermostIdOf,
        lowermostIdOf,
        belowId,
        aboveId,
        forEachSelected,
        setColorForSelectedU32,
        setVisibilityForSelected,
        deleteSelected,
        selectRange,
        reorderGroup,
        addPixelsToSelection,
        removePixelsFromSelection,
        togglePointInSelection,
        removePixelsFromSelected,
        mergeSelected,
        copySelected,
        selectionPath,
        pathOf,
        colorOf,
        visibleOf,
        pixelCountOf,
        topVisibleLayerIdAt,
        removePixelsFromAll,
        removeEmptyLayers,
        splitSelectedLayer,
        selectByPixelCount
    };
});
