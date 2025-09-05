import { useLayerPanelService } from './layerPanel';
import { useLayerToolService } from './layerTool';
import { useOverlayService } from './overlay';
import { useLayerQueryService } from './layerQuery';
import { useNodeQueryService } from './nodeQuery';
import { useSelectService, useDirectionToolService, useGlobalEraseToolService } from './multiLayerTools';
import { useDrawToolService, useEraseToolService, useTopToolService, useCutToolService } from './singleLayerTools';
import { usePathToolService } from './wandTools';
import { useToolSelectionService } from './toolSelection';
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
    useDirectionToolService,
    useGlobalEraseToolService,
    useSelectService,
    useDrawToolService,
    useEraseToolService,
    useTopToolService,
    useCutToolService,
    usePathToolService,
    useToolSelectionService,
    useViewportService,
    useStageResizeService,
    useHamiltonianService,
    useImageLoadService,
    useSettingsService,
    useShortcutService,
    useClipboardService
};

export const useService = () => ({
    layerPanel: useLayerPanelService(),
    layerTool: useLayerToolService(),
    overlay: useOverlayService(),
    layerQuery: useLayerQueryService(),
    nodeQuery: useNodeQueryService(),
    multiLayerTools: {
        select: useSelectService(),
        direction: useDirectionToolService(),
        globalErase: useGlobalEraseToolService(),
    },
    singleLayerTools: {
        draw: useDrawToolService(),
        erase: useEraseToolService(),
        cut: useCutToolService(),
        top: useTopToolService(),
    },
    wandTools: {
        path: usePathToolService(),
    },
    toolSelection: useToolSelectionService(),
    viewport: useViewportService(),
    stageResize: useStageResizeService(),
    hamiltonian: useHamiltonianService(),
    imageLoad: useImageLoadService(),
    settings: useSettingsService(),
    shortcut: useShortcutService(),
    clipboard: useClipboardService()
});
