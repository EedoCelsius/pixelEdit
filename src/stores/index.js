import { useInputStore } from './input';
import { useLayerStore } from './layers';
import { useOutputStore } from './output';
import { useStageStore } from './stage';
import { useStageEventStore } from './stageEvent';

export {
    useInputStore,
    useLayerStore,
    useOutputStore,
    useStageStore,
    useStageEventStore
};

export const useStore = () => ({
    input: useInputStore(),
    layers: useLayerStore(),
    output: useOutputStore(),
    stage: useStageStore(),
    stageEvent: useStageEventStore()
});
