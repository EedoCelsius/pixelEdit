import { defineStore } from 'pinia';
import { nextTick, watch } from 'vue';
import { useStore } from '.';
import { useLayerPanelService } from '../services/layerPanel';
import { rgbaToHexU32, alphaU32 } from '../utils';
import { indexToCoord, buildStarPath } from '../utils/pixels.js';
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
            const state = JSON.parse(this.currentSnap());
            if (state.history) delete state.history;
            return JSON.stringify({
                input: { src: input.src || '', size: { w: input.width || 0, h: input.height || 0 } },
                state
            });
        },
        async importFromJSON(json) {
            let parsed;
            try {
                parsed = JSON.parse(json);
            } catch (e) {
                console.error('Invalid JSON', e);
                return;
            }
            const { input } = useStore();
            if (parsed.input && parsed.input.src) {
                await input.load(parsed.input.src);
            }
            if (parsed.state) {
                const snapshot = typeof parsed.state === 'string' ? parsed.state : JSON.stringify(parsed.state);
                this._apply(snapshot);
                this._stack = [];
                this._pointer = -1;
            }
        },
        exportToSVG() {
            const { nodeTree, nodes, pixels, viewport } = useStore();
            const sanitizeId = (name) => String(name).replace(/[^A-Za-z0-9_-]/g, '_');
            let lastOrientationEnd = null;
            const serialize = (tree) => {
                let result = '';
                for (const node of tree) {
                    const props = nodes.getProperties(node.id);
                    const attributes = { ...props.attributes, visibility: props.visibility ? 'visible' : 'hidden' };
                    const attrStr = Object.entries(attributes).map(([key, value]) => `${key}="${value}"`).join(' ');
                    if (node.children && node.children.length) {
                        const children = serialize(node.children);
                        result += `<g id="${sanitizeId(props.name)}" ${attrStr}>${children}</g>`;
                    } else {
                        let path = pixels.pathOf(node.id);
                        // temp corner removal
                        if (attributes.tl || attributes.tr || attributes.bl || attributes.br) {
                            const removals = [];
                            for (const idx of attributes.tl || []) {
                                const [x, y] = indexToCoord(idx);
                                removals.push([x + 1, y + 1]);
                            }
                            for (const idx of attributes.tr || []) {
                                const [x, y] = indexToCoord(idx);
                                removals.push([x, y + 1]);
                            }
                            for (const idx of attributes.bl || []) {
                                const [x, y] = indexToCoord(idx);
                                removals.push([x + 1, y]);
                            }
                            for (const idx of attributes.br || []) {
                                const [x, y] = indexToCoord(idx);
                                removals.push([x, y]);
                            }
                            for (const [x, y] of removals) {
                                const re = new RegExp(`([ML]) ${x} ${y}(?:\\s|$)`, 'g');
                                path = path.replace(re, ' ');
                            }
                            path = path.replace(/(^|Z)\s*L/g, '$1 M').trim().replace(/\s+/g, ' ');
                        }

                        // temp orientation satin rung
                        const map = pixels.get(node.id) || new Map();
                        const overflow = 0.025;
                        const segments = [];
                        const starReference = lastOrientationEnd;
                        for (const [idx, ori] of map) {
                            if (ori === OT.NONE) continue;
                            const [x, y] = indexToCoord(idx);
                            if (ori === OT.STAR) {
                                const corners = [
                                    [x, y],
                                    [x + 1, y],
                                    [x + 1, y + 1],
                                    [x, y + 1]
                                ];
                                let startCornerIndex = 0;
                                if (starReference) {
                                    let minDist = Infinity;
                                    for (let i = 0; i < corners.length; i++) {
                                        const [cx, cy] = corners[i];
                                        const dx = starReference[0] - cx;
                                        const dy = starReference[1] - cy;
                                        const dist = dx * dx + dy * dy;
                                        if (dist < minDist) {
                                            minDist = dist;
                                            startCornerIndex = i;
                                        }
                                    }
                                }
                                const d = buildStarPath(x, y, 1, startCornerIndex);
                                if (d) {
                                    segments.push({ d, isStar: true });
                                    lastOrientationEnd = corners[startCornerIndex];
                                }
                            } else {
                                let start;
                                let end;
                                if (ori === OT.VERTICAL) {
                                    start = [x - overflow, y + 0.5];
                                    end = [x + 1 + overflow, y + 0.5];
                                } else if (ori === OT.HORIZONTAL) {
                                    start = [x + 0.5, y - overflow];
                                    end = [x + 0.5, y + 1 + overflow];
                                } else if (ori === OT.DOWNSLOPE) {
                                    start = [x - overflow, y + 1 + overflow];
                                    end = [x + 1 + overflow, y - overflow];
                                } else if (ori === OT.UPSLOPE) {
                                    start = [x - overflow, y - overflow];
                                    end = [x + 1 + overflow, y + 1 + overflow];
                                } else {
                                    continue;
                                }
                                segments.push({ d: `M ${start[0]} ${start[1]} L ${end[0]} ${end[1]}`, isStar: false });
                                lastOrientationEnd = end;
                            }
                        }
                        
                        const color = rgbaToHexU32(props.color);
                        const opacity = alphaU32(props.color);
                        let orientationPaths = '';
                        for (const { d, isStar } of segments) {
                            if (!isStar) orientationPaths += `<path d="${d}" stroke="#000" stroke-width="0.02" fill="none"/>`;
                            else orientationPaths += `<path d="${d}" stroke="${color}" opacity="${opacity}" stroke-width="0.02" fill="none"/>`;
                        }

                        if (segments.length === 1 && segments[0].isStar) result += `<g id="${sanitizeId(props.name)}">${orientationPaths}</g>`;
                        else result += `<g id="${sanitizeId(props.name)}"><path d="${path}" fill="${color}" opacity="${opacity}" ${attrStr} fill-rule="evenodd" shape-rendering="crispEdges"/>${orientationPaths}</g>`;
                    }
                }
                return result;
            };
            const { stage, viewBox } = viewport;
            return `<svg xmlns="http://www.w3.org/2000/svg" width="${stage.width}" height="${stage.height}" viewBox="${viewBox}">${serialize(nodeTree.tree)}</svg>`;
        }
    }
});
