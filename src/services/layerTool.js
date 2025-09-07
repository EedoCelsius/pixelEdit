import { defineStore } from 'pinia';
import { useStore } from '../stores';
import { useLayerQueryService } from './layerQuery';
import { findPixelComponents, getPixelUnion, averageColorU32 } from '../utils';

export const useLayerToolService = defineStore('layerToolService', () => {
    const { nodeTree, nodes, pixels } = useStore();
    const layerQuery = useLayerQueryService();

    function mergeSelected() {
        if (nodeTree.selectedLayerCount < 2 && nodeTree.selectedGroupCount === 0) return;
        const pixelUnion = getPixelUnion(pixels.getProperties(nodeTree.selectedLayerIds));

        const colors = [];
        if (pixelUnion.length) {
            for (const pixel of pixelUnion) {
                const id = layerQuery.topVisibleAt(pixel, nodeTree.selectedLayerIds);
                colors.push(id ? nodes.getProperty(id, 'color') : 0);
            }
        } else {
            for (const id of nodeTree.selectedLayerIds) {
                colors.push(nodes.getProperty(id, 'color'));
            }
        }
        const colorU32 = averageColorU32(colors);

        const baseId = nodeTree.selectedLayerIds[0] || nodeTree.selectedGroupIds[0];
        const maintainedName = nodes.getProperty(baseId, 'name') || 'Merged';
        const maintainedAttrs = nodes.getProperty(baseId, 'attributes');
        const newLayerId = nodes.createLayer({
            name: `Merged ${maintainedName}`,
            color: colorU32,
            attributes: maintainedAttrs,
        });
        const newPixels = pixelUnion;
        if (newPixels.length) pixels.addPixels(newLayerId, newPixels);
        nodeTree.insert([newLayerId], nodeTree.orderedSelection[0], true);
        const removed = nodeTree.remove(nodeTree.selectedNodeIds);
        nodes.remove(removed);
        pixels.remove(removed);
        return newLayerId;
    }

    function copySelected() {
        const selected = nodeTree.selectedIds;
        if (!selected.length) return [];

        const copyInto = (srcId, parentId = null, prefix = true) => {
            const props = nodes.getProperties(srcId);
            const name = prefix ? `Copy of ${props.name}` : props.name;
            let newId;
            if (props.type === 'layer') {
                newId = nodes.createLayer({
                    name,
                    color: props.color,
                    visibility: props.visibility,
                    attributes: props.attributes,
                });
                const px = pixels.get(srcId);
                if (px.length) pixels.set(newId, px);
                if (parentId == null) nodeTree.insert([newId], srcId, false);
                else nodeTree.append([newId], parentId, false);
            } else if (props.type === 'group') {
                newId = nodes.createGroup({
                    name,
                    color: props.color,
                    visibility: props.visibility,
                    attributes: props.attributes,
                });
                if (parentId == null) nodeTree.insert([newId], srcId, false);
                else nodeTree.append([newId], parentId, false);
                const info = nodeTree._findNode(srcId);
                const children = info?.node.children || [];
                for (const child of children) copyInto(child.id, newId, false);
            }
            return newId;
        };

        const newIds = [];
        for (const id of selected) {
            const nid = copyInto(id);
            if (nid != null) newIds.push(nid);
        }
        return newIds;
    }

    function splitSelected() {
        if (!nodeTree.selectedLayerCount) return [];

        const selected = nodeTree.selectedLayerIds;
        const newSelection = [];
        const splitedLayers = [];

        for (const layerId of selected) {
            const components = findPixelComponents(pixels.get(layerId));
            if (components.length <= 1) {
                newSelection.push(layerId)
                continue;
            }

            const original = nodes.getProperties(layerId);
            const newIds = components.reverse().map((componentPixels, index) => {
                const newId = nodes.createLayer({
                    name: `${original.name} #${components.length - index}`,
                    color: original.color,
                    visibility: original.visibility,
                    attributes: original.attributes,
                });
                pixels.set(newId, componentPixels);
                return newId;
            });

            nodeTree.insert(newIds, layerId, true);
            
            const removed = nodeTree.remove([layerId]);
            nodes.remove(removed);
            pixels.remove(removed);

            newSelection.push(...newIds);
            splitedLayers.push(...newIds);
        }

        nodeTree.replaceSelection(newSelection);
        return splitedLayers;
    }

    function groupSelected() {
        const selected = nodeTree.selectedIds;
        const id = nodes.createGroup({});
        if (selected.length === 0) {
            nodeTree.append([id], null, false);
        } else {
            const lowermost = selected[0];
            nodeTree.insert([id], lowermost, true);
            nodeTree.append(selected, id, true);
        }
        nodeTree.replaceSelection([id]);
        return id;
    }

    function ungroupSelected() {
        const groupIds = nodeTree.selectedIds.filter(id => nodes.getProperty(id, 'type') === 'group');
        const newSelection = [];
        for (const groupId of groupIds) {
            const childrenIds = nodeTree._findNode(groupId).node.children.map(c => c.id);
            newSelection.push(...childrenIds);
            nodeTree.insert(childrenIds, groupId, true);
            nodeTree.remove([groupId]);
            nodes.remove([groupId]);
        }
        nodeTree.replaceSelection(newSelection);
        return groupIds;
    }

    function flipOrderSelected() {
        const selected = nodeTree.selectedIds;
        if (selected.length === 1 && nodes.getProperty(selected[0], 'type') === 'group') {
            const info = nodeTree._findNode(selected[0]);
            if (info?.node.children) info.node.children.reverse();
            return;
        }
        if (selected.length < 2) return;
        const infos = selected.map(id => nodeTree._findNode(id)).filter(Boolean);
        if (!infos.length) return;
        const parent = infos[0].parent ?? null;
        if (!infos.every(info => (info.parent ?? null) === parent)) return;
        const parentArr = parent ? parent.children : nodeTree._tree;
        const sorted = infos.slice().sort((a, b) => a.index - b.index);
        const nodesReversed = sorted.map(info => info.node).reverse();
        sorted.forEach((info, idx) => {
            parentArr[info.index] = nodesReversed[idx];
        });
    }

    return {
        mergeSelected,
        copySelected,
        splitSelected,
        groupSelected,
        ungroupSelected,
        flipOrderSelected,
    };
});

