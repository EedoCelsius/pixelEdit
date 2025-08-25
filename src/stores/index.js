import { useInputStore } from './input';
import { useLayerStore } from './layers';
import { useOutputStore } from './output';
import { useStageStore } from './stage';
import { useViewportEventStore } from './viewportEvent';

export {
    useInputStore,
    useLayerStore,
    useOutputStore,
    useStageStore,
    useViewportEventStore
};

export const useStore = () => ({
    input: useInputStore(),
    layers: useLayerStore(),
    output: useOutputStore(),
    stage: useStageStore(),
    viewportEvent: useViewportEventStore()
});
