import { defineStore } from 'pinia';
import { watch } from 'vue';
import { useStore } from '../stores';
import { useLayerPanelService } from './layerPanel';
import { useLayerToolService } from './layerTool';
import { useNodeQueryService } from './nodeQuery';
import { useToolSelectionService } from './toolSelection';
import { useToolbarStore } from '../stores/toolbar';
import { useClipboardService } from './clipboard';
import { usePathToolService } from './wandTools';
import { useMoveToolService } from './multiLayerTools';
import { TOOL_MODIFIERS } from '@/constants';

export const useShortcutService = defineStore('shortcutService', () => {
    const { keyboardEvent: keyboardEvents, nodeTree, nodes, pixels: pixelStore, output } = useStore();
    const layerPanel = useLayerPanelService();
    const layerSvc = useLayerToolService();
    const nodeQuery = useNodeQueryService();
    const toolSelectionService = useToolSelectionService();
    const toolbar = useToolbarStore();
    const clipboard = useClipboardService();
    const pathToolService = usePathToolService();
    const moveTool = useMoveToolService();

    function deleteSelection() {
        if (!nodeTree.selectedNodeCount) return;
        const ids = nodeTree.selectedIds;
        const lowermostTarget = nodeQuery.lowermost(ids);
        const parentId = nodeQuery.parentOf(lowermostTarget);
        const belowId = nodeQuery.below(lowermostTarget);
        const removed = nodeTree.remove(ids);
        nodes.remove(removed);
        pixelStore.removeLayer(removed);
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
    }

    watch(() => keyboardEvents.recent.down, (downs) => {
        for (const e of downs) {
            const key = e.key;
            const ctrl = e.ctrlKey || e.metaKey;
            const shift = e.shiftKey;

            if (ctrl) {
                const lower = key.toLowerCase();
                if (lower === 's') {
                    e.preventDefault();
                    if (shift) output.saveAs();
                    else output.quickSave();
                    continue;
                }
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
                const changeType = map[toolSelectionService.current] ?? map.default;
                if (changeType) {
                    const tool = toolbar.tools.find(t => t.type === changeType);
                    if (tool) toolSelectionService.addPrepared(tool);
                    break;
                }
            }

            switch (key) {
                case 'm':
                case 'M': {
                    e.preventDefault();
                    const id = layerSvc.mergeSelected();
                    if (id != null) {
                        nodeTree.replaceSelection([id]);
                        layerPanel.setScrollRule({ type: 'follow', target: id });
                    }
                    break;
                }
                case 'r':
                case 'R': {
                    e.preventDefault();
                    toolSelectionService.setShape('wand');
                    toolSelectionService.addPrepared({ type: 'path', name: 'Path', usable: pathToolService.usable });
                    break;
                }
                case 'ArrowUp':
                    e.preventDefault();
                    if (toolSelectionService.current === 'move') {
                        moveTool.shift(0, -1);
                    } else {
                        layerPanel.onArrowUp(shift, ctrl);
                    }
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    if (toolSelectionService.current === 'move') {
                        moveTool.shift(0, 1);
                    } else {
                        layerPanel.onArrowDown(shift, ctrl);
                    }
                    break;
                case 'ArrowLeft':
                    if (toolSelectionService.current === 'move') {
                        e.preventDefault();
                        moveTool.shift(-1, 0);
                    }
                    break;
                case 'ArrowRight':
                    if (toolSelectionService.current === 'move') {
                        e.preventDefault();
                        moveTool.shift(1, 0);
                    }
                    break;
                case 'Delete':
                case 'Backspace':
                    e.preventDefault();
                    deleteSelection();
                    break;
                case 'Enter':
                    e.preventDefault();
                    layerPanel.onEnter(e)
                    break;
                case 'Escape':
                    nodeTree.clearSelection();
                    break;
            }

            if (ctrl) {
                const lower = key.toLowerCase();
                if (lower === 'a') {
                    e.preventDefault();
                    layerPanel.selectAll();
                } else if (lower === 'g') {
                    e.preventDefault();
                    const ordered = nodeTree.orderedSelection;
                    nodeTree.replaceSelection(ordered);
                    const id = layerSvc.groupSelected();
                    layerPanel.setRange(id, id);
                    layerPanel.setScrollRule({ type: 'follow', target: id });
                }
            }
        }
    });

    watch(() => keyboardEvents.recent.up, (ups) => {
        for (const e of ups) {
            if (e.key === 'Shift') {
                toolSelectionService.useRecent();
                break;
            }
            if (e.key === 'Control' || e.key === 'Meta') {
                const down = keyboardEvents.get('keydown', e.key);
                if (!down || !down.repeat) continue;
                toolSelectionService.useRecent();
                break;
            }
        }
    });

    return {};
});
