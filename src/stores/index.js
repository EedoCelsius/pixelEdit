import { useInputStore } from './input';
import { useLayerStore } from './layers';
import { useLayerGroupStore } from './layerGroups';
import { useOutputStore } from './output';
import { useViewportStore } from './viewport';
import { useViewportEventStore } from './viewportEvent';

export {
    useInputStore,
    useLayerStore,
    useLayerGroupStore,
    useOutputStore,
    useViewportStore,
    useViewportEventStore
};

export const useStore = () => {
    const input = useInputStore();
    const layers = useLayerStore();
    const layerGroups = useLayerGroupStore();
    layerGroups.initFromLayers();
    const output = useOutputStore();
    const viewport = useViewportStore();
    const viewportEvent = useViewportEventStore();
    return { input, layers, layerGroups, output, viewport, viewportEvent };
};
