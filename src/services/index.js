import { useLayerPanelService } from './layerPanel';
import { useLayerToolService } from './layerTool';
import { useOverlayService } from './overlay';
import { usePixelService } from './pixel';
import { useQueryService } from './query';
import { useSelectService } from './select';
import { useStageToolService } from './stageTool';
import { useViewportService } from './viewport';

export {
    useLayerPanelService,
    useLayerToolService,
    useOverlayService,
    usePixelService,
    useQueryService,
    useSelectService,
    useStageToolService,
    useViewportService
};

export const useService = () => ({
    layerPanel: useLayerPanelService(),
    layerTool: useLayerToolService(),
    overlay: useOverlayService(),
    pixel: usePixelService(),
    query: useQueryService(),
    select: useSelectService(),
    stageTool: useStageToolService(),
    viewport: useViewportService()
});
