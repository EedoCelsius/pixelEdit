import { defineStore } from 'pinia';
import { useStore } from '.';
import { useLayerPanelService } from '../services/layerPanel';
import { watch } from 'vue';

export const useOutputStore = defineStore('output', {
    state: () => ({
        _stack: [],
        _pointer: -1,
        _lastSnapshot: null,
        _lastHash: 0,
        _beforeSnapshot: null,
        _changed: false,
        _tickScheduled: false,
        _ignoreChanges: false,
        _commitVersion: 0
    }),
    getters: {
        commitVersion: (state) => state._commitVersion
    },
    actions: {
        _calcHash() {
            const { nodeTree, nodes, pixels } = useStore();
            return nodeTree._hash.tree.hash ^ nodes._hash.all ^ pixels._hash.all;
        },
        _apply(snapshot) {
            const { nodeTree, nodes, pixels, viewport } = useStore();
            const layerPanel = useLayerPanelService();
            const parsed = JSON.parse(snapshot);
            this._ignoreChanges = true;
            nodeTree.applySerialized(parsed.nodeTreeState);
            nodes.applySerialized(parsed.nodeState);
            pixels.applySerialized(parsed.pixelState);
            layerPanel.applySerialized(parsed.layerPanelState);
            viewport.applySerialized(parsed.viewportState);
            this._ignoreChanges = false;
            this._lastSnapshot = snapshot;
            this._lastHash = this._calcHash();
            this._commitVersion++; // ← Undo/Redo 시에도 썸네일 갱신
        },
        _record() {
            this._tickScheduled = false;
            if (!this._changed) return;
            const after = this.currentSnap();
            const hash = this._calcHash();
            if (hash !== this._lastHash) {
                this._stack = this._stack.slice(0, this._pointer + 1);
                this._stack.push({ before: this._beforeSnapshot, after });
                this._pointer = this._stack.length - 1;
                this._lastSnapshot = after;
                this._lastHash = hash;
                this._commitVersion++;
            }
            this._changed = false;
        },
        _scheduleRecord() {
            if (this._tickScheduled) return;
            this._tickScheduled = true;
            requestAnimationFrame(() => this._record());
        },
        _onStoreChanged() {
            if (this._ignoreChanges) return;
            if (!this._changed) {
                this._beforeSnapshot = this._lastSnapshot;
                this._changed = true;
            }
            this._scheduleRecord();
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
        listen() {
            if (this._lastSnapshot === null) {
                this._lastSnapshot = this.currentSnap();
                this._lastHash = this._calcHash();
            }
            const { nodeTree, nodes, pixels } = useStore();
            watch(() => [nodeTree._hash.tree.hash, nodes._hash.all, pixels._hash.all], () => this._onStoreChanged());
        },
        undo() {
            if (this._pointer < 0) return;
            const cur = this._stack[this._pointer];
            this._apply(cur.before);
            this._pointer--;
        },
        redo() {
            if (this._pointer + 1 >= this._stack.length) return;
            const next = this._stack[this._pointer + 1];
            this._apply(next.after);
            this._pointer++;
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
