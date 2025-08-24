import { defineStore } from 'pinia';
import { useLayerStore } from '../stores/layers';
import { useLayerPanelStore } from '../stores/layerPanel';

export const useRangeSelectionService = defineStore('rangeSelectionService', () => {
    const layers = useLayerStore();
    const layerPanel = useLayerPanelStore();

    function replaceSelection(ids = [], anchorId = null, tailId = null) {
        layers.replaceSelection(ids);
        layerPanel.setRange(anchorId, tailId);
    }

    function selectOne(id = null) {
        if (id === null) {
            replaceSelection([], null, null);
        } else {
            replaceSelection([id], id, id);
        }
    }

    function clearSelection() {
        replaceSelection([], null, null);
    }

    function toggleSelection(id = null) {
        if (id == null) return;
        const current = layers.selectedIds;
        if (layers.isSelected(id)) {
            replaceSelection(current.filter(i => i !== id), layerPanel.anchorId, layerPanel.anchorId);
        } else {
            const newAnchor = layerPanel.anchorId ?? id;
            replaceSelection([...current, id], newAnchor, id);
        }
    }

    function selectRange(anchorId, tailId) {
        const anchorIndex = layers.idsTopToBottom.indexOf(anchorId);
        const tailIndex = layers.idsTopToBottom.indexOf(tailId);
        const slice = layers.idsTopToBottom.slice(
            Math.min(anchorIndex, tailIndex),
            Math.max(anchorIndex, tailIndex) + 1
        );
        replaceSelection(slice, anchorId, tailId);
    }

    return { replaceSelection, selectOne, clearSelection, toggleSelection, selectRange };
});
