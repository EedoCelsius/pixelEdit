import { useInputStore } from './input';
import { useNodeTreeStore } from './nodeTree';
import { useNodeStore } from './nodes';
import { usePixelStore } from './pixels';
import { usePreviewStore } from './preview';
import { useOutputStore } from './output';
import { useViewportStore } from './viewport';
import { useViewportEventStore } from './viewportEvent';
import { useKeyboardEventStore } from './keyboardEvent';
import { useContextMenuStore } from './contextMenu';
import { useToolbarStore } from './toolbar';
import { useFileSystemStore } from './fileSystem';

export {
    useInputStore,
    useNodeTreeStore,
    useNodeStore,
    usePixelStore,
    usePreviewStore,
    useOutputStore,
    useViewportStore,
    useViewportEventStore,
    useKeyboardEventStore,
    useContextMenuStore,
    useToolbarStore,
    useFileSystemStore
};

export const useStore = () => ({
    input: useInputStore(),
    nodeTree: useNodeTreeStore(),
    nodes: useNodeStore(),
    pixels: usePixelStore(),
    preview: usePreviewStore(),
    output: useOutputStore(),
    viewport: useViewportStore(),
    viewportEvent: useViewportEventStore(),
    keyboardEvent: useKeyboardEventStore(),
    contextMenu: useContextMenuStore(),
    toolbar: useToolbarStore(),
    fileSystem: useFileSystemStore()
});
