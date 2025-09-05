import { defineStore } from 'pinia';
import { useStore } from '.';
import { useLayerPanelService } from '../services/layerPanel';

export const useOutputStore = defineStore('output', {
    state: () => ({
        _stack: [],
        _pointer: -1,
        _pendingRollback: null,
        _commitScheduled: false,
        _commitVersion: 0
    }),
    getters: {
        hasPendingRollback: (state) => !!state._pendingRollback,
        commitVersion: (state) => state._commitVersion
    },
    actions: {
        _apply(snapshot) {
            const { nodeTree, nodes, pixels, viewport } = useStore();
            const layerPanel = useLayerPanelService();
            const parsed = JSON.parse(snapshot);
            nodeTree.applySerialized(parsed.nodeTreeState);
            nodes.applySerialized(parsed.nodeState);
            pixels.applySerialized(parsed.pixelState);
            layerPanel.applySerialized(parsed.layerPanelState);
            viewport.applySerialized(parsed.viewportState);
            this._commitVersion++; // ← Undo/Redo/롤백 시에도 썸네일 갱신
        },
        commit() {
            if (!this._pendingRollback || this._commitScheduled) return;
            this._commitScheduled = true;
            requestAnimationFrame(() => {
                const before = this._pendingRollback;
                const after = this.currentSnap();
                if (before === after) {
                    this._pendingRollback = null;
                    this._commitScheduled = false;
                    return;
                }
                this._stack = this._stack.slice(0, this._pointer + 1);
                this._stack.push({
                    before,
                    after
                });
                this._pointer = this._stack.length - 1;
                this._pendingRollback = null;
                this._commitScheduled = false;
                this._commitVersion++; // ← 실제 커밋 때 썸네일 갱신 트리거
            })
        },
        currentSnap() {
            const { nodeTree, nodes, pixels, viewport } = useStore();
            const layerPanel = useLayerPanelService();
            return JSON.stringify({
                nodeTreeState: nodeTree.serialize(),
                nodeState: nodes.serialize(),
                pixelState: pixels.serialize(),
                layerPanelState: layerPanel.serialize(),
                viewportState: viewport.serialize()
            });
        },
        setRollbackPoint(snapshot) {
            if (!this._pendingRollback) {
                this._pendingRollback = snapshot || this.currentSnap();
            }
        },
        clearRollbackPoint() {
            this._pendingRollback = null;
        },
        rollbackPending() {
            if (!this._pendingRollback) return;
            this._apply(this._pendingRollback);
            this._pendingRollback = null;
        },
        undo() {
            if (this._pointer < 0) return;
            const cur = this._stack[this._pointer];
            this._apply(cur.before);
            this._pointer--;
            this._pendingRollback = null;
        },
        redo() {
            if (this._pointer + 1 >= this._stack.length) return;
            const next = this._stack[this._pointer + 1];
            this._apply(next.after);
            this._pointer++;
            this._pendingRollback = null;
        },
        exportToJSON() {
            const { input } = useStore();
            return `{
        "input": { "src": "${input.src || ''}", "size": { "w": ${input.width || 0}, "h": ${input.height || 0} } },
        "state": ${this.currentSnap()}
      }`;
        }
    }
});
