import { useLayerPanelService } from './layerPanel';
import { useLayerToolService } from './layerTool';
import { useOverlayService } from './overlay';
import { useLayerQueryService } from './layerQuery';
import { useDrawToolService, useEraseToolService, useTopToolService, useGlobalEraseToolService, useCutToolService, useSelectService, usePathToolService, useOneStrokeToolService } from './tools';
import { useToolSelectionService } from './toolSelection';
import { useViewportService } from './viewport';
import { useStageResizeService } from './stageResize';
import { useOneStrokeService } from './oneStroke';

export {
    useLayerPanelService,
    useLayerToolService,
    useOverlayService,
    useLayerQueryService,
    useSelectService,
    useDrawToolService,
    useEraseToolService,
    useTopToolService,
    usePathToolService,
    useOneStrokeToolService,
    useGlobalEraseToolService,
    useCutToolService,
    useToolSelectionService,
    useViewportService,
    useStageResizeService,
    useOneStrokeService
};

export const useService = () => ({
    layerPanel: useLayerPanelService(),
    layerTool: useLayerToolService(),
    overlay: useOverlayService(),
    layerQuery: useLayerQueryService(),
    select: useSelectService(),
    tools: {
        draw: useDrawToolService(),
        erase: useEraseToolService(),
        globalErase: useGlobalEraseToolService(),
        path: usePathToolService(),
        oneStroke: useOneStrokeToolService(),
        cut: useCutToolService(),
        top: useTopToolService(),
    },
    toolSelection: useToolSelectionService(),
    viewport: useViewportService(),
    stageResize: useStageResizeService(),
    oneStroke: useOneStrokeService()
});
