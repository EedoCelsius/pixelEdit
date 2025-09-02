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
    if (props.type === 'layer') {
        return {
            type: 'layer',
            ...base,
            pixels: pixelStore.get(id),
        };
    }
    if (props.type === 'group') {
        const info = nodeTree._findNode(id);
        const children = info?.node.children || [];
        return {
            type: 'group',
            ...base,
            children: children.map(child => serializeNode(child.id, nodeTree, nodes, pixelStore)),
        };
    }
    return null;
}

export const useClipboardService = defineStore('clipboardService', () => {
    const { nodeTree, nodes, pixels: pixelStore, output } = useStore();
    const nodeQuery = useNodeQueryService();
    const layerPanel = useLayerPanelService();

    async function copySelection() {
        const ordered = nodeTree.orderedSelection;
        if (!ordered.length) return;
        const data = ordered.map(id => serializeNode(id, nodeTree, nodes, pixelStore));
        try {
            await navigator.clipboard.writeText(JSON.stringify({ type: 'pixedit/layers', data }));
        } catch {
            // ignore clipboard errors
        }
    }

    function createFrom(data) {
        const base = {
            name: data.name,
            color: data.color,
            visibility: data.visibility,
            locked: data.locked,
            attributes: data.attributes,
        };
        if (data.type === 'layer') {
            const id = nodes.createLayer(base);
            if (data.pixels && data.pixels.length) pixelStore.set(id, data.pixels);
            return { id, children: [] };
        }
        if (data.type === 'group') {
            const id = nodes.createGroup(base);
            const children = (data.children || []).map(c => createFrom(c));
            return { id, children };
        }
        return { id: null, children: [] };
    }

    async function paste() {
        let text;
        try {
            text = await navigator.clipboard.readText();
        } catch {
            return [];
        }
        let payload;
        try {
            payload = JSON.parse(text);
        } catch {
            return [];
        }
        if (!payload || payload.type !== 'pixedit/layers' || !Array.isArray(payload.data)) return [];

        output.setRollbackPoint();
        const infos = payload.data.map(createFrom);
        if (!infos.length) {
            output.rollbackPending?.();
            return [];
        }
        const topIds = infos.map(info => info.id);
        const lowermost = nodeQuery.lowermost(nodeTree.selectedIds);
        nodeTree.insert(topIds, lowermost, true);
        const attach = (info) => {
            if (info.children.length) {
                const ids = info.children.map(c => c.id);
                nodeTree.append(ids, info.id, false);
                info.children.forEach(attach);
            }
        };
        infos.forEach(attach);
        nodeTree.replaceSelection(topIds);
        layerPanel.setRange(topIds[0], topIds[topIds.length - 1]);
        layerPanel.setScrollRule({ type: 'follow', target: topIds[0] });
        output.commit();
        return topIds;
    }

    return { copySelection, paste };
});

