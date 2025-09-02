import { defineStore } from 'pinia';
import { watch } from 'vue';
import { useStore } from '../stores';
import { useLayerPanelService } from './layerPanel';
import { useLayerToolService } from './layerTool';
import { useNodeQueryService } from './nodeQuery';
import { useToolSelectionService } from './toolSelection';
import { useClipboardService } from './clipboard';
import { TOOL_MODIFIERS } from '@/constants';

export const useShortcutService = defineStore('shortcutService', () => {
    const { keyboardEvent: keyboardEvents, nodeTree, nodes, pixels: pixelStore, output } = useStore();
    const layerPanel = useLayerPanelService();
    const layerSvc = useLayerToolService();
    const nodeQuery = useNodeQueryService();
    const toolSelectionService = useToolSelectionService();
    const clipboard = useClipboardService();

    let previousTool = toolSelectionService.prepared;
    let modifierActive = false;

    function deleteSelection() {
        if (!nodeTree.selectedNodeCount) return;
        output.setRollbackPoint();
        const ids = nodeTree.selectedIds;
        const lowermostTarget = nodeQuery.lowermost(ids);
        const parentId = nodeQuery.parentOf(lowermostTarget);
        const belowId = nodeQuery.below(lowermostTarget);
        const removed = nodeTree.remove(ids);
        nodes.remove(removed);
        pixelStore.remove(removed);
        let newSelect = null;
        if (nodeTree.has(belowId)) {
            newSelect = belowId;
        } else {
            const siblings = nodeQuery.childrenOf(parentId);
            const lowermostSibling = nodeQuery.lowermost(siblings);
            if (nodeTree.has(lowermostSibling)) {
                newSelect = lowermostSibling;
            } else if (nodeTree.has(parentId)) {
                newSelect = parentId;
            }
        }
        layerPanel.setRange(newSelect, newSelect);
        if (newSelect) layerPanel.setScrollRule({ type: 'follow', target: newSelect });
        output.commit();
    }

    watch(() => keyboardEvents.recent.down, (downs) => {
        for (const e of downs) {
            const key = e.key;
            const ctrl = e.ctrlKey || e.metaKey;
            const shift = e.shiftKey;

            if (ctrl) {
                const lower = key.toLowerCase();
                if (lower === 'z' && !e.shiftKey) {
                    e.preventDefault();
                    output.undo();
                    continue;
                }
                if (lower === 'y' || (lower === 'z' && e.shiftKey)) {
                    e.preventDefault();
                    output.redo();
                    continue;
                }
                if (lower === 'c') {
                    e.preventDefault();
                    clipboard.copySelection();
                    continue;
                }
                if (lower === 'v') {
                    e.preventDefault();
                    clipboard.paste();
                    continue;
                }
            }

            const map = TOOL_MODIFIERS[key];
            if (map && !e.repeat) {
                const change = map[toolSelectionService.prepared] ?? map.default;
                if (change) {
                    previousTool = toolSelectionService.prepared;
                    modifierActive = true;
                    toolSelectionService.setPrepared(change);
                    break;
                }
            }

            switch (key) {
                case 'ArrowUp':
                    e.preventDefault();
                    layerPanel.onArrowUp(shift, ctrl);
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    layerPanel.onArrowDown(shift, ctrl);
                    break;
                case 'Delete':
                case 'Backspace':
                    e.preventDefault();
                    deleteSelection();
                    break;
                case 'Enter':
                    if (!ctrl && !shift && nodeTree.selectedLayerCount === 1) {
                        const selectedId = nodeTree.selectedLayerIds[0];
                        const row = document.querySelector(`.layer[data-id="${selectedId}"] .nameText`);
                        if (row) {
                            e.preventDefault();
                            row.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
                        }
                    }
                    break;
                case 'Escape':
                    if (output.hasPendingRollback) {
                        e.preventDefault();
                        output.rollbackPending();
                    } else {
                        nodeTree.clearSelection();
                    }
                    break;
            }

            if (ctrl) {
                const lower = key.toLowerCase();
                if (lower === 'a') {
                    e.preventDefault();
                    layerPanel.selectAll();
                } else if (lower === 'g') {
                    e.preventDefault();
                    output.setRollbackPoint();
                    const ordered = nodeTree.orderedSelection;
                    nodeTree.replaceSelection(ordered);
                    const id = layerSvc.groupSelected();
                    layerPanel.setRange(id, id);
                    layerPanel.setScrollRule({ type: 'follow', target: id });
                    output.commit();
                }
            }
        }
    });

    watch(() => keyboardEvents.recent.up, (ups) => {
        for (const e of ups) {
            if (e.key === 'Shift') {
                if (toolSelectionService.prepared !== previousTool) {
                    toolSelectionService.setPrepared(previousTool);
                }
                modifierActive = false;
                break;
            }
            if (e.key === 'Control' || e.key === 'Meta') {
                const down = keyboardEvents.get('keydown', e.key);
                if (!down || !down.repeat) continue;
                if (toolSelectionService.prepared !== previousTool) {
                    toolSelectionService.setPrepared(previousTool);
                }
                modifierActive = false;
                break;
            }
        }
    });

    watch(() => toolSelectionService.prepared, (tool) => {
        if (!modifierActive) previousTool = tool;
    });

    return {};
});
