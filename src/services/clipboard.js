import { defineStore } from 'pinia';
import { useStore } from '../stores';
import { useNodeQueryService } from './nodeQuery';
import { useLayerPanelService } from './layerPanel';

function serializeNode(id, nodeTree, nodes, pixelStore) {
    const props = nodes.getProperties(id);
    const base = {
        name: props.name,
        color: props.color,
        visibility: props.visibility,
        locked: props.locked,
        attributes: props.attributes,
    };
    if (props.isGroup) {
        const info = nodeTree._findNode(id);
        const children = info?.node.children || [];
        return {
            type: 'group',
            ...base,
            children: children.map(child => serializeNode(child.id, nodeTree, nodes, pixelStore)),
        };
    }
    else {
        return {
            type: 'layer',
            ...base,
            pixels: pixelStore.get(id)
        };
    }
}

export const useClipboardService = defineStore('clipboardService', () => {
    const { nodeTree, nodes, pixels: pixelStore } = useStore();
    const nodeQuery = useNodeQueryService();
    const layerPanel = useLayerPanelService();

    let clipboardData = [];

    function copySelection() {
        const ordered = nodeTree.orderedSelection;
        if (!ordered.length) return;
        clipboardData = ordered.map(id => serializeNode(id, nodeTree, nodes, pixelStore));
    }

    function createFrom(data) {
        const base = {
            name: data.name,
            color: data.color,
            visibility: data.visibility,
            locked: data.locked,
            attributes: data.attributes,
        };
        if (data.type === 'group') {
            const id = nodes.addGroup(base);
            const children = (data.children || []).map(c => createFrom(c));
            return { id, children };
        }
        if (data.type === 'layer') {
            const id = nodes.addLayer(base);
            pixelStore.addLayer(id);
            pixelStore.set(id, data.pixels);
            return { id, children: [] };
        }
    }

    function paste() {
        if (!clipboardData.length) return [];

        const infos = clipboardData.map(createFrom);
        const topIds = infos.map(info => info.id);
        const uppermost = nodeQuery.uppermost(nodeTree.selectedIds);
        nodeTree.insert(topIds, uppermost, true);
        const attach = (info) => {
            if (info.children.length) {
                const ids = info.children.map(c => c.id);
                nodeTree.append(ids, info.id);
                info.children.forEach(attach);
            }
        };
        infos.forEach(attach);
        nodeTree.replaceSelection(topIds);
        layerPanel.setRange(topIds[0], topIds[topIds.length - 1]);
        layerPanel.setScrollRule({ type: 'follow', target: topIds[0] });
        return topIds;
    }

    return { copySelection, paste };
});

