import { useLayerPanelService } from './layerPanel';
import { useLayerToolService } from './layerTool';
import { useOverlayService } from './overlay';
import { useQueryService } from './query';
import { useDrawToolService, useEraseToolService, useGlobalEraseToolService, useCutToolService, useSelectService } from './tools';
import { useToolSelectionService } from './toolSelection';
import { useViewportService } from './viewport';

export {
    useLayerPanelService,
    useLayerToolService,
    useOverlayService,
    useQueryService,
    useSelectService,
    useDrawToolService,
    useEraseToolService,
    useGlobalEraseToolService,
    useCutToolService,
    useToolSelectionService,
    useViewportService
};

export const useService = () => ({
    layerPanel: useLayerPanelService(),
    layerTool: useLayerToolService(),
    overlay: useOverlayService(),
    query: useQueryService(),
    select: useSelectService(),
    tools: {
        draw: useDrawToolService(),
        erase: useEraseToolService(),
        globalErase: useGlobalEraseToolService(),
        cut: useCutToolService(),
    },
    toolSelection: useToolSelectionService(),
    viewport: useViewportService()
});
