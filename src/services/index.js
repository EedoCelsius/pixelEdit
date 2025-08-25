import { useLayerPanelService } from './layerPanel';
import { useLayerService } from './layers';
import { useOverlayService } from './overlay';
import { usePixelService } from './pixel';
import { useQueryService } from './query';
import { useSelectService } from './select';
import { useStageService } from './stage';
import { useViewportService } from './viewport';

export {
    useLayerPanelService,
    useLayerService,
    useOverlayService,
    usePixelService,
    useQueryService,
    useSelectService,
    useStageService,
    useViewportService
};

export const useService = () => ({
    layerPanel: useLayerPanelService(),
    layers: useLayerService(),
    overlay: useOverlayService(),
    pixel: usePixelService(),
    query: useQueryService(),
    select: useSelectService(),
    stage: useStageService(),
    viewport: useViewportService()
});
