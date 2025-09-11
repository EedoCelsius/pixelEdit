import { defineStore } from 'pinia';
import { nextTick, watch } from 'vue';
import { useStore } from '.';
import { useLayerPanelService } from '../services/layerPanel';
import { rgbaToHexU32, alphaU32 } from '../utils';
import { indexToCoord } from '../utils/pixels.js';
import { OT } from '../constants/orientation.js';

export const useOutputStore = defineStore('output', {
    state: () => ({
        _stack: [],
        _pointer: -1,
        _lastSnapshot: null,
        _lastHash: 0,
        _tickScheduled: false
    }),
    actions: {
        _calcHash() {
            const { nodeTree, nodes, pixels } = useStore();
            return nodeTree._hash.tree.hash ^ nodes._hash.all ^ pixels._hash.all;
        },
        _apply(snapshot) {
            const { nodeTree, nodes, pixels, viewport } = useStore();
            const layerPanel = useLayerPanelService();
            const parsed = JSON.parse(snapshot);
            nodeTree.applySerialized(parsed.nodeTreeState);
            nodes.applySerialized(parsed.nodeState);
            pixels.applySerialized(parsed.pixelState);
            layerPanel.applySerialized(parsed.layerPanelState);
            viewport.applySerialized(parsed.viewportState);

            const rule = layerPanel.scrollRule;
            layerPanel.unfoldTo(rule.target);
            nextTick(() => layerPanel.ensureBlockVisibility(rule));

            this._lastSnapshot = snapshot;
            this._lastHash = this._calcHash();
        },
        _schedule() {
            if (this._tickScheduled) return;
            this._tickScheduled = true;
            nextTick(() => {
                this._tickScheduled = false;
                const hash = this._calcHash();
                if (hash === this._lastHash) return;
                const before = this._lastSnapshot;
                const after = this.currentSnap();
                this._stack = this._stack.slice(0, this._pointer + 1);
                this._stack.push({ before, after });
                this._pointer = this._stack.length - 1;
                this._lastSnapshot = after;
                this._lastHash = hash;

                const layerPanel = useLayerPanelService();
                const rule = layerPanel.scrollRule
                layerPanel.unfoldTo(rule.target);
                nextTick(() => layerPanel.ensureBlockVisibility(rule));
            });
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
            const layerPanel = useLayerPanelService();
            watch(() => [nodeTree._hash.selection, layerPanel.anchorId, layerPanel.tailId], () => {
                nextTick(() => {
                    const rule = layerPanel.scrollRule
                    layerPanel.ensureBlockVisibility(rule)
                });
            });
            watch(() => [nodeTree._hash.tree.hash, nodes._hash.all, pixels._hash.all], this._schedule);
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
        },
        exportToSVG() {
            const { nodeTree, nodes, pixels, viewport } = useStore();
            const serialize = (tree) => {
                let result = '';
                for (const node of tree) {
                    const props = nodes.getProperties(node.id);
                    const attrStr = props.attributes.map(a => `${a.name}="${a.value}"`).join(' ');
                    const visibility = props.visibility ? '' : ' visibility="hidden"';
                    if (node.children && node.children.length) {
                        const children = serialize(node.children);
                        result += `<g${attrStr ? ' ' + attrStr : ''}${visibility}>${children}</g>`;
                    } else {
                        const path = pixels.pathOf(node.id);
                        const fill = rgbaToHexU32(props.color);
                        const opacity = alphaU32(props.color);
                        const map = pixels.get(node.id) || new Map();
                        const overflow = 0.01;
                        const segments = {
                            [OT.VERTICAL]: [],
                            [OT.HORIZONTAL]: [],
                            [OT.DOWNSLOPE]: [],
                            [OT.UPSLOPE]: []
                        };
                        for (const [idx, ori] of map) {
                            if (ori === OT.NONE) continue;
                            const [x, y] = indexToCoord(idx);
                            if (ori === OT.VERTICAL) {
                                segments[OT.VERTICAL].push(`M ${x - overflow} ${y + 0.5} L ${x + 1 + overflow} ${y + 0.5}`);
                            } else if (ori === OT.HORIZONTAL) {
                                segments[OT.HORIZONTAL].push(`M ${x + 0.5} ${y - overflow} L ${x + 0.5} ${y + 1 + overflow}`);
                            } else if (ori === OT.DOWNSLOPE) {
                                segments[OT.DOWNSLOPE].push(`M ${x - overflow} ${y + 1 + overflow} L ${x + 1 + overflow} ${y - overflow}`);
                            } else if (ori === OT.UPSLOPE) {
                                segments[OT.UPSLOPE].push(`M ${x - overflow} ${y - overflow} L ${x + 1 + overflow} ${y + 1 + overflow}`);
                            }
                        }
                        let orientationPaths = '';
                        for (const segs of Object.values(segments)) {
                            if (segs.length) {
                                orientationPaths += `<path d="${segs.join(' ')}" stroke="#000" stroke-width="0.02" fill="none"/>`;
                            }
                        }
                        result += `<g${attrStr ? ' ' + attrStr : ''}${visibility}><path d="${path}" fill="${fill}" opacity="${opacity}" fill-rule="evenodd" shape-rendering="crispEdges"/>${orientationPaths}</g>`;
                    }
                }
                return result;
            };
            const { stage, viewBox } = viewport;
            return `<svg xmlns="http://www.w3.org/2000/svg" width="${stage.width}" height="${stage.height}" viewBox="${viewBox}">${serialize(nodeTree.tree)}</svg>`;
        }
    }
});
