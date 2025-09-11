import { useLayerPanelService } from './layerPanel';
import { useLayerToolService } from './layerTool';
import { useOverlayService } from './overlay';
import { useLayerQueryService } from './layerQuery';
import { useNodeQueryService } from './nodeQuery';
import { useToolSelectionService } from './toolSelection';
import { useToolbarStore } from '../stores/toolbar';
import { useDrawToolService, useEraseToolService, useTopToolService, useCutToolService } from './singleLayerTools';
import { useSelectToolService, useOrientationToolService, useGlobalEraseToolService } from './multiLayerTools';
import { usePathToolService, useRelayToolService, useExpandToolService, useBorderToolService, useMarginToolService } from './wandTools';
import { useViewportService } from './viewport';
import { useStageResizeService } from './stageResize';
import { useHamiltonianService } from './hamiltonian';
import { useImageLoadService } from './imageLoad';
import { useSettingsService } from './settings';
import { useShortcutService } from './shortcut';
import { useClipboardService } from './clipboard';

export {
    useLayerPanelService,
    useLayerToolService,
    useOverlayService,
    useLayerQueryService,
    useNodeQueryService,
    useSelectToolService,
    useDrawToolService,
    useEraseToolService,
    useTopToolService,
    useOrientationToolService,
    usePathToolService,
    useRelayToolService,
    useExpandToolService,
    useBorderToolService,
    useMarginToolService,
    useGlobalEraseToolService,
    useCutToolService,
    useToolSelectionService,
    useViewportService,
    useStageResizeService,
    useHamiltonianService,
    useImageLoadService,
    useSettingsService,
    useShortcutService,
    useClipboardService
};

export const useService = () => {
    // Register single-layer tools before multi-layer ones to ensure toolbar order
    const draw = useDrawToolService();
    const erase = useEraseToolService();
    const cut = useCutToolService();
    const top = useTopToolService();
    const path = usePathToolService();
    const relay = useRelayToolService();
    const expand = useExpandToolService();
    const border = useBorderToolService();
    const margin = useMarginToolService();

    const select = useSelectToolService();
    const globalErase = useGlobalEraseToolService();
    const orientation = useOrientationToolService();

    const toolSelection = useToolSelectionService();
    const toolbar = useToolbarStore();
    toolSelection.addPrepared(toolbar.tools.find(t => t.type === 'draw'));
    toolSelection.addPrepared(toolbar.tools.find(t => t.type === 'select'));

    return {
        layerPanel: useLayerPanelService(),
        layerTool: useLayerToolService(),
        overlay: useOverlayService(),
        layerQuery: useLayerQueryService(),
        nodeQuery: useNodeQueryService(),
        toolSelection,
        tools: {
            draw,
            erase,
            cut,
            top,
            path,
            relay,
            expand,
            border,
            margin,
            select,
            globalErase,
            orientation,
        },
        viewport: useViewportService(),
        stageResize: useStageResizeService(),
        hamiltonian: useHamiltonianService(),
        imageLoad: useImageLoadService(),
        settings: useSettingsService(),
        shortcut: useShortcutService(),
        clipboard: useClipboardService(),
    };
};
