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

export const useStore = () => ({
    input: useInputStore(),
    layers: useLayerStore(),
    layerGroups: useLayerGroupStore(),
    output: useOutputStore(),
    viewport: useViewportStore(),
    viewportEvent: useViewportEventStore()
});
