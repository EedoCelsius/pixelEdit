import { defineStore } from 'pinia';
import { useOverlayService } from './overlay';
import { useStageToolService } from './stageTool';
import { useStore } from '../stores';

export const useToolService = defineStore('toolService', () => {
    const overlay = useOverlayService();
    const stageTool = useStageToolService();
    const { output } = useStore();

    function reset() {
        stageTool.pointer.status = 'idle';
        stageTool.pointer.id = null;
        overlay.helper.clear();
        overlay.helper.mode = 'add';
    }

    function finish(event) {
        try {
            event.target?.releasePointerCapture?.(stageTool.pointer.id);
        } catch {}
        output.commit();
        reset();
    }

    function cancel() {
        if (stageTool.pointer.status === 'idle') return;
        output.rollbackPending();
        reset();
    }

    return { finish, cancel, reset };
});
