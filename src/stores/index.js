import { useInputStore } from './input';
import { useLayerStore } from './layers';
import { useOutputStore } from './output';
import { useViewportStore } from './viewport';
import { useViewportEventStore } from './viewportEvent';

export {
    useInputStore,
    useLayerStore,
    useOutputStore,
    useViewportStore,
    useViewportEventStore
};

export const useStore = () => ({
    input: useInputStore(),
    layers: useLayerStore(),
    output: useOutputStore(),
    viewport: useViewportStore(),
    viewportEvent: useViewportEventStore()
});
