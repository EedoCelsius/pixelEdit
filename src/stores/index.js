import { useInputStore } from './input';
import { useNodeTreeStore } from './nodeTree';
import { useNodeStore } from './nodes';
import { usePixelStore } from './pixels';
import { useOutputStore } from './output';
import { useViewportStore } from './viewport';
import { useViewportEventStore } from './viewportEvent';
import { useKeyboardEventStore } from './keyboardEvent';

export {
    useInputStore,
    useNodeTreeStore,
    useNodeStore,
    usePixelStore,
    useOutputStore,
    useViewportStore,
    useViewportEventStore,
    useKeyboardEventStore
};

export const useStore = () => ({
    input: useInputStore(),
    nodeTree: useNodeTreeStore(),
    nodes: useNodeStore(),
    pixels: usePixelStore(),
    output: useOutputStore(),
    viewport: useViewportStore(),
    viewportEvent: useViewportEventStore(),
    keyboardEvent: useKeyboardEventStore()
});
