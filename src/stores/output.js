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
            const orientationCursor = { point: null };
            const squareDistance = (a, b) => {
                if (!a || !b) return Infinity;
                const dx = a[0] - b[0];
                const dy = a[1] - b[1];
                return dx * dx + dy * dy;
            };
            const buildStarOrientationPath = (x, y, overflow, previousPoint) => {
                const corners = {
                    topLeft: [x - overflow, y - overflow],
                    topRight: [x + 1 + overflow, y - overflow],
                    bottomRight: [x + 1 + overflow, y + 1 + overflow],
                    bottomLeft: [x - overflow, y + 1 + overflow]
                };
                const mids = {
                    top: [x + 0.5, y - overflow],
                    right: [x + 1 + overflow, y + 0.5],
                    bottom: [x + 0.5, y + 1 + overflow],
                    left: [x - overflow, y + 0.5]
                };
                const triangles = [
                    { corners: ['bottomLeft', 'bottomRight'], mid: mids.top },
                    { corners: ['topLeft', 'bottomLeft'], mid: mids.right },
                    { corners: ['topLeft', 'topRight'], mid: mids.bottom },
                    { corners: ['topRight', 'bottomRight'], mid: mids.left }
                ];
                let startCornerName = 'topLeft';
                if (previousPoint) {
                    let minDist = Infinity;
                    for (const [name, point] of Object.entries(corners)) {
                        const dist = squareDistance(point, previousPoint);
                        if (dist < minDist) {
                            minDist = dist;
                            startCornerName = name;
                        }
                    }
                }
                let startIndex = triangles.findIndex(tri => tri.corners.includes(startCornerName));
                if (startIndex === -1) startIndex = 0;
                const ordered = triangles.slice(startIndex).concat(triangles.slice(0, startIndex));
                const parts = [];
                let currentCornerName = startCornerName;
                for (const tri of ordered) {
                    const [c1, c2] = tri.corners;
                    let startName;
                    let endName;
                    if (currentCornerName === c1) {
                        startName = c1;
                        endName = c2;
                    } else if (currentCornerName === c2) {
                        startName = c2;
                        endName = c1;
                    } else {
                        const currentPoint = corners[currentCornerName] || previousPoint;
                        if (currentPoint) {
                            const d1 = squareDistance(corners[c1], currentPoint);
                            const d2 = squareDistance(corners[c2], currentPoint);
                            if (d1 <= d2) {
                                startName = c1;
                                endName = c2;
                            } else {
                                startName = c2;
                                endName = c1;
                            }
                        } else {
                            startName = c1;
                            endName = c2;
                        }
                    }
                    const startPoint = corners[startName];
                    const midPoint = tri.mid;
                    const endPoint = corners[endName];
                    parts.push(`M ${startPoint[0]} ${startPoint[1]} L ${midPoint[0]} ${midPoint[1]} L ${endPoint[0]} ${endPoint[1]} Z`);
                    currentCornerName = endName;
                }
                const endPoint = corners[currentCornerName] || previousPoint || corners[startCornerName];
                return { path: parts.join(' '), endPoint };
            };
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
                        let orientationPaths = '';
                        for (const [idx, ori] of map) {
                            if (ori === OT.NONE) continue;
                            const [x, y] = indexToCoord(idx);
                            if (ori === OT.VERTICAL) {
                                const start = [x - overflow, y + 0.5];
                                const end = [x + 1 + overflow, y + 0.5];
                                orientationPaths += `<path d="M ${start[0]} ${start[1]} L ${end[0]} ${end[1]}" stroke="#000" stroke-width="0.02" fill="none"/>`;
                                orientationCursor.point = end;
                            } else if (ori === OT.HORIZONTAL) {
                                const start = [x + 0.5, y - overflow];
                                const end = [x + 0.5, y + 1 + overflow];
                                orientationPaths += `<path d="M ${start[0]} ${start[1]} L ${end[0]} ${end[1]}" stroke="#000" stroke-width="0.02" fill="none"/>`;
                                orientationCursor.point = end;
                            } else if (ori === OT.DOWNSLOPE) {
                                const start = [x - overflow, y + 1 + overflow];
                                const end = [x + 1 + overflow, y - overflow];
                                orientationPaths += `<path d="M ${start[0]} ${start[1]} L ${end[0]} ${end[1]}" stroke="#000" stroke-width="0.02" fill="none"/>`;
                                orientationCursor.point = end;
                            } else if (ori === OT.UPSLOPE) {
                                const start = [x - overflow, y - overflow];
                                const end = [x + 1 + overflow, y + 1 + overflow];
                                orientationPaths += `<path d="M ${start[0]} ${start[1]} L ${end[0]} ${end[1]}" stroke="#000" stroke-width="0.02" fill="none"/>`;
                                orientationCursor.point = end;
                            } else if (ori === OT.STAR) {
                                const { path: starPath, endPoint } = buildStarOrientationPath(x, y, overflow, orientationCursor.point);
                                orientationPaths += `<path d="${starPath}" stroke="#000" stroke-width="0.02" fill="none"/>`;
                                orientationCursor.point = endPoint;
                            }
                        }

                        const fill = rgbaToHexU32(props.color);
                        const opacity = alphaU32(props.color);
                        result += `<g id="${sanitizeId(props.name)}"><path d="${path}" fill="${fill}" opacity="${opacity}" ${attrStr} fill-rule="evenodd" shape-rendering="crispEdges"/>${orientationPaths}</g>`;
                    }
                }
                return result;
            };
            const { stage, viewBox } = viewport;
            return `<svg xmlns="http://www.w3.org/2000/svg" width="${stage.width}" height="${stage.height}" viewBox="${viewBox}">${serialize(nodeTree.tree)}</svg>`;
        }
    }
});
