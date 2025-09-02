import { useLayerPanelService } from './layerPanel';
import { useLayerToolService } from './layerTool';
import { useOverlayService } from './overlay';
import { useLayerQueryService } from './layerQuery';
import { useNodeQueryService } from './nodeQuery';
import { useDrawToolService, useEraseToolService, useTopToolService, useGlobalEraseToolService, useCutToolService, useSelectService, useDirectionToolService, usePathToolService } from './tools';
import { useToolSelectionService } from './toolSelection';
import { useViewportService } from './viewport';
import { useStageResizeService } from './stageResize';
import { useHamiltonianService } from './hamiltonian';
import { useImageLoadService } from './imageLoad';
import { useSettingsService } from './settings';
import { useShortcutService } from './shortcut';

export {
    useLayerPanelService,
    useLayerToolService,
    useOverlayService,
    useLayerQueryService,
    useNodeQueryService,
    useSelectService,
    useDrawToolService,
    useEraseToolService,
    useTopToolService,
    useDirectionToolService,
    usePathToolService,
    useGlobalEraseToolService,
    useCutToolService,
    useToolSelectionService,
    useViewportService,
    useStageResizeService,
    useHamiltonianService,
    useImageLoadService,
    useSettingsService,
    useShortcutService
};

export const useService = () => ({
    layerPanel: useLayerPanelService(),
    layerTool: useLayerToolService(),
    overlay: useOverlayService(),
    layerQuery: useLayerQueryService(),
    nodeQuery: useNodeQueryService(),
    select: useSelectService(),
    tools: {
        draw: useDrawToolService(),
        erase: useEraseToolService(),
        globalErase: useGlobalEraseToolService(),
        direction: useDirectionToolService(),
        cut: useCutToolService(),
        top: useTopToolService(),
        path: usePathToolService(),
    },
    toolSelection: useToolSelectionService(),
    viewport: useViewportService(),
    stageResize: useStageResizeService(),
    hamiltonian: useHamiltonianService(),
    imageLoad: useImageLoadService(),
    settings: useSettingsService(),
    shortcut: useShortcutService()
});
