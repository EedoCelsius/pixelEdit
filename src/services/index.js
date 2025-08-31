import { useLayerPanelService } from './layerPanel';
import { useLayerToolService } from './layerTool';
import { useOverlayService } from './overlay';
import { useLayerQueryService } from './layerQuery';
import { useDrawToolService, useEraseToolService, useTopToolService, useGlobalEraseToolService, useCutToolService, useSelectService, usePathToolService, useHamStartToolService } from './tools';
import { useToolSelectionService } from './toolSelection';
import { useViewportService } from './viewport';
import { useStageResizeService } from './stageResize';
import { useHamiltonianService } from './hamiltonian';

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
    useGlobalEraseToolService,
    useCutToolService,
    useHamStartToolService,
    useToolSelectionService,
    useViewportService,
    useStageResizeService,
    useHamiltonianService
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
        cut: useCutToolService(),
        top: useTopToolService(),
        hamStart: useHamStartToolService(),
    },
    toolSelection: useToolSelectionService(),
    viewport: useViewportService(),
    stageResize: useStageResizeService(),
    hamiltonian: useHamiltonianService()
});
