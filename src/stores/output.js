import { defineStore } from 'pinia';
import { nextTick, watch } from 'vue';
import { useStore } from '.';
import { useLayerPanelService } from '../services/layerPanel';
import { useFileSystemStore } from './fileSystem';
import { rgbaToHexU32, alphaU32, unpackRGBA } from '../utils';
import { indexToCoord, buildStarPath } from '../utils/pixels.js';
import { OT, ORIENTATION_OVERFLOW_CONFIG } from '../constants/orientation.js';
import { SVG_EXPORT_CONFIG } from '../constants/svg.js';
import previewOverlaySource from '../image/preview_overlay.svg?raw';

function extractSvgTemplate(svgSource) {
    if (typeof svgSource !== 'string') return null;
    const svgMatch = svgSource.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i);
    if (!svgMatch) return null;
    const svgTagMatch = svgSource.match(/<svg[^>]*>/i);
    const svgTag = svgTagMatch ? svgTagMatch[0] : '';
    const viewBoxMatch = svgTag.match(/viewBox\s*=\s*"([^"]+)"/i);
    const namespaceMatches = [...svgTag.matchAll(/\s(xmlns(?::[^\s=>]+)?)="([^"]+)"/gi)];
    const namespaces = namespaceMatches
        .map(([, name, value]) => ({ name: name.trim(), value: value.trim() }))
        .filter(ns => ns.name && ns.value);
    let width = 1;
    let height = 1;
    if (viewBoxMatch) {
        const parts = viewBoxMatch[1].trim().split(/\s+/).map(Number);
        if (parts.length === 4) {
            width = Math.abs(parts[2]) || 1;
            height = Math.abs(parts[3]) || 1;
        }
    } else {
        const widthMatch = svgTag.match(/width\s*=\s*"([^"]+)"/i);
        const heightMatch = svgTag.match(/height\s*=\s*"([^"]+)"/i);
        width = parseFloat(widthMatch?.[1]) || 1;
        height = parseFloat(heightMatch?.[1]) || 1;
    }
    let inner = svgMatch[1]
        .replace(/<sodipodi:[^>]*?>[\s\S]*?<\/sodipodi:[^>]*?>/gi, '')
        .replace(/<sodipodi:[^>]*?\/>/gi, '')
        .replace(/<metadata[\s\S]*?<\/metadata>/gi, '');
    inner = inner.trim();
    return {
        inner,
        namespaces,
        scaleX: width ? 1 / width : 1,
        scaleY: height ? 1 / height : 1
    };
}

const PREVIEW_OVERLAY_TEMPLATE = extractSvgTemplate(previewOverlaySource);

const EXPORT_FORMAT_META = {
    json: { mime: 'application/json', extension: 'json' },
    svg: { mime: 'image/svg+xml', extension: 'svg' },
    coordinates: { mime: 'application/json', extension: 'coord.json' },
    preview: { mime: 'image/svg+xml', extension: 'preview.svg' }
};

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
                    if (node.children) {
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
                        const overflow = ORIENTATION_OVERFLOW_CONFIG.LINE_PERCENT / 100;
                        const starOverflow = ORIENTATION_OVERFLOW_CONFIG.STAR_PERCENT / 100;
                        const segments = [];
                        const starReference = lastOrientationEnd;
                        for (const [idx, ori] of map) {
                            if (ori === OT.NONE) continue;
                            const [x, y] = indexToCoord(idx);
                            if (ori === OT.STAR) {
                                const starOffset = starOverflow;
                                const corners = [
                                    [x - starOffset, y - starOffset],
                                    [x + 1 + starOffset, y - starOffset],
                                    [x + 1 + starOffset, y + 1 + starOffset],
                                    [x - starOffset, y + 1 + starOffset]
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
                                const d = buildStarPath(x, y, 1, startCornerIndex, starOverflow);
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
                        
                        let isStarLayer = true;
                        let orientationPaths = '';
                        for (const { d, isStar } of segments) {
                            if (isStar)
                                orientationPaths += `<path d="${d}" stroke="${color}" opacity="${opacity}" stroke-width="0.02" fill="none"/>`;
                            else {
                                orientationPaths += `<path d="${d}" stroke="#000" stroke-width="0.02" fill="none"/>`;
                                isStarLayer = false;
                            }
                        }

                        if (isStarLayer) result += `<g id="${sanitizeId(props.name)}">${orientationPaths}</g>`;
                        else result += `<g id="${sanitizeId(props.name)}"><path d="${path}" fill="${color}" opacity="${opacity}" ${attrStr} fill-rule="evenodd" shape-rendering="crispEdges"/>${orientationPaths}</g>`;
                    }
                }
                return result;
            };
            const { stage, viewBox } = viewport;
            const unit = SVG_EXPORT_CONFIG.UNIT;
            const pixelSize = SVG_EXPORT_CONFIG.PIXEL_SIZE;
            const formatSize = value => {
                const scaled = Math.round(value * pixelSize * 1000) / 1000;
                return `${scaled}${unit}`;
            };
            return `<svg xmlns="http://www.w3.org/2000/svg" width="${formatSize(stage.width)}" height="${formatSize(stage.height)}" viewBox="${viewBox}">${serialize(nodeTree.tree)}</svg>`;
        },
        exportToPreview() {
            const { nodes, pixels, viewport } = useStore();
            const stage = viewport.stage;
            const stageWidth = Math.max(1, stage.width | 0);
            const stageHeight = Math.max(1, stage.height | 0);
            const overlayTemplate = PREVIEW_OVERLAY_TEMPLATE;
            const rects = [];
            const overlays = [];
            for (const [idStr, map] of Object.entries(pixels._pixels)) {
                if (!(map instanceof Map) || map.size === 0) continue;
                const id = Number(idStr);
                const props = nodes.getProperties(id);
                if (!props || props.isGroup) continue;
                const fill = rgbaToHexU32(props.color);
                const fillOpacity = Math.round(alphaU32(props.color) * 1000) / 1000;
                for (const [pixelIndex] of map) {
                    const [x, y] = indexToCoord(pixelIndex);
                    rects.push(`<rect x="${x}" y="${y}" width="1" height="1" rx="0.1" ry="0.1" fill="${fill}" fill-opacity="${fillOpacity}"/>`);
                    if (overlayTemplate?.inner) {
                        const transforms = [`translate(${x} ${y})`];
                        if (overlayTemplate.scaleX !== 1 || overlayTemplate.scaleY !== 1) {
                            transforms.push(`scale(${overlayTemplate.scaleX} ${overlayTemplate.scaleY})`);
                        }
                        overlays.push(`<g transform="${transforms.join(' ')}">${overlayTemplate.inner}</g>`);
                    }
                }
            }
            const namespaceAttrs = (overlayTemplate?.namespaces || [])
                .filter(ns => ns.name !== 'xmlns')
                .map(ns => ` ${ns.name}="${ns.value}"`)
                .join('');
            const header = `<svg xmlns="http://www.w3.org/2000/svg"${namespaceAttrs} width="${stageWidth}" height="${stageHeight}" viewBox="0 0 ${stageWidth} ${stageHeight}" shape-rendering="crispEdges">`;
            const pixelsGroup = rects.length ? `<g id="preview-pixels">${rects.join('')}</g>` : '';
            const overlayGroup = overlays.length ? `<g id="preview-overlay">${overlays.join('')}</g>` : '';
            return `${header}${pixelsGroup}${overlayGroup}</svg>`;
        },
        exportToCoordinates() {
            const { nodes, pixels } = useStore();
            const coordinatesByColor = {};
            for (const [idStr, map] of Object.entries(pixels._pixels)) {
                if (!(map instanceof Map) || map.size === 0) continue;
                const id = Number(idStr);
                const props = nodes.getProperties(id);
                if (!props || props.isGroup) continue;
                const colorKey = rgbaToHexU32(props.color || 0);
                if (!coordinatesByColor[colorKey]) {
                    coordinatesByColor[colorKey] = [];
                }
                for (const [pixelIndex] of map) {
                    coordinatesByColor[colorKey].push(indexToCoord(pixelIndex));
                }
            }
            return coordinatesByColor;
        },
        _buildExportPayload(format = 'json') {
            switch (format) {
                case 'svg':
                    return { ...EXPORT_FORMAT_META.svg, content: this.exportToSVG() };
                case 'preview':
                    return { ...EXPORT_FORMAT_META.preview, content: this.exportToPreview() };
                case 'coordinates':
                    return { ...EXPORT_FORMAT_META.coordinates, content: JSON.stringify(this.exportToCoordinates()) };
                case 'json':
                default:
                    return { ...EXPORT_FORMAT_META.json, content: this.exportToJSON() };
            }
        },
        download(format = 'json') {
            const { content, mime, extension } = this._buildExportPayload(format);
            const blob = new Blob([content], { type: mime });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `pixel-edit.${extension}`;
            a.click();
            URL.revokeObjectURL(url);
        },
        async saveToHandle(handle, format = 'json') {
            if (!handle?.createWritable) return false;
            const writable = await handle.createWritable();
            const { content } = this._buildExportPayload(format);
            await writable.write(content);
            await writable.close();
            useFileSystemStore().setSaveContext(handle, format);
            return true;
        },
        async quickSave() {
            const fileSystem = useFileSystemStore();
            if (fileSystem.canQuickSave && window.isSecureContext) {
                try {
                    const success = await this.saveToHandle(fileSystem.saveHandle, fileSystem.lastSaveFormat);
                    if (success) return true;
                } catch (error) {
                    console.error('Failed to write to existing handle', error);
                    fileSystem.clearSaveContext();
                }
            }
            return this.saveAs({ suggestedFormat: fileSystem.lastSaveFormat });
        },
        async saveAs({ suggestedFormat = 'json' } = {}) {
            const fileSystem = useFileSystemStore();
            const defaultFormat = suggestedFormat || fileSystem.lastSaveFormat || 'json';
            if (!window.showSaveFilePicker) {
                this.download(defaultFormat);
                return false;
            }
            try {
                const loadedName = fileSystem.loadHandle?.name || '';
                const baseName = loadedName.replace(/\.[^./\\]+$/, '') || 'pixel-edit';
                const meta = EXPORT_FORMAT_META[defaultFormat] || EXPORT_FORMAT_META.json;
                const suggestedName = `${baseName}.${meta.extension}`;
                const handle = await window.showSaveFilePicker({
                    suggestedName,
                    types: [
                        {
                            description: 'Pixel Edit JSON',
                            accept: { 'application/json': ['.json'] }
                        },
                        {
                            description: 'Layer Coordinates JSON',
                            accept: { 'application/json': ['.coord.json'] }
                        },
                        {
                            description: 'Preview SVG',
                            accept: { 'image/svg+xml': ['.preview.svg'] }
                        },
                        {
                            description: 'Scalable Vector Graphics',
                            accept: { 'image/svg+xml': ['.svg'] }
                        }
                    ]
                });
                const name = handle.name?.toLowerCase?.() || '';
                let format = defaultFormat;
                if (name.endsWith('.preview.svg')) format = 'preview';
                else if (name.endsWith('.svg')) format = 'svg';
                else if (name.endsWith('.coord.json')) format = 'coordinates';
                else if (name.endsWith('.json')) format = 'json';
                return await this.saveToHandle(handle, format);
            } catch (error) {
                if (error?.name !== 'AbortError') console.error('Save As failed', error);
                return false;
            }
        }
    }
});
