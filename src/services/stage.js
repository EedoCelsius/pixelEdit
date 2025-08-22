import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import { useStageStore } from '../stores/stage';
import { useToolStore } from '../stores/tool';
import { useSelectionStore } from '../stores/selection';
import { useLayerService } from './layers';
import { useInputStore } from '../stores/input';
import { coordsToKey, keyToCoords, pixelsToUnionPath, clamp, rgbaCssObj, rgbaCssU32 } from '../utils';
import { CURSOR_CONFIG } from '../constants';

export const useStageService = defineStore('stageService', () => {
    // stores
    const stageStore = useStageStore();
    const toolStore = useToolStore();
    const selection = useSelectionStore();
    const layerSvc = useLayerService();
    const input = useInputStore();

    // --- Interaction State ---
    const hoverLayerId = ref(null);

    // --- Keyboard State & Handlers ---
    let ctrlKeyDownTimestamp = 0;
    const KEY_TAP_MS = 200;

    function ctrlKeyDown() {
        if (!toolStore.ctrlHeld) {
            ctrlKeyDownTimestamp = performance.now();
            toolStore.setCtrlHeld(true);
        }
    }
    function ctrlKeyUp() {
        if (performance.now() - ctrlKeyDownTimestamp < KEY_TAP_MS) {
            if (toolStore.currentMode === 'single') {
                if (toolStore.tool === 'draw' || toolStore.tool === 'erase') {
                    toolStore.setTool(toolStore.tool === 'draw' ? 'erase' : 'draw');
                }
            } else { // multi mode
                if (toolStore.tool === 'select' || toolStore.tool === 'globalErase') {
                    toolStore.setTool(toolStore.tool === 'select' ? 'globalErase' : 'select');
                }
            }
        }
        toolStore.setCtrlHeld(false);
        ctrlKeyDownTimestamp = 0;
    }
    function shiftKeyDown() { toolStore.setShiftHeld(true); }
    function shiftKeyUp() { toolStore.setShiftHeld(false); }

    // --- Auto-tool switching on mode change ---
    watch(() => toolStore.currentMode, (newMode) => {
        if (newMode === 'single') {
            if (toolStore.tool === 'select' || toolStore.tool === 'globalErase') {
                toolStore.setTool('draw');
            }
        } else { // multi
            if (toolStore.tool === 'draw' || toolStore.tool === 'erase') {
                toolStore.setTool('select');
            }
        }
    }, { immediate: true });

    // --- Overlay Paths ---
    const addOverlayPath = computed(() => {
        if (!toolStore.addOverlayLayerIds.size) return '';
        const pixelUnionSet = new Set();
        for (const id of toolStore.addOverlayLayerIds) {
            layerSvc.layerById(id)?.forEachPixel((x, y) => pixelUnionSet.add(coordsToKey(x, y)));
        }
        return pixelsToUnionPath(pixelUnionSet);
    });
    const removeOverlayPath = computed(() => {
        if (!toolStore.removeOverlayLayerIds.size) return '';
        const pixelUnionSet = new Set();
        for (const id of toolStore.removeOverlayLayerIds) {
            layerSvc.layerById(id)?.forEachPixel((x, y) => pixelUnionSet.add(coordsToKey(x, y)));
        }
        return pixelsToUnionPath(pixelUnionSet);
    });

    // --- Canvas Utilities ---
    function recalcScale(wrapperElement) {
        if (!wrapperElement) return;
        const padding = 20;
        const maxW = (wrapperElement.clientWidth || 0) - padding;
        const maxH = (wrapperElement.clientHeight || 0) - padding - 60;
        const newScale = Math.floor(Math.min(maxW / Math.max(1, stageStore.canvas.width), maxH / Math.max(1, stageStore.canvas.height))) || 16;
        stageStore.setScale(Math.max(1, newScale));
    }
    
    const patternId = ref('chk');
    const colorA = ref('#0a1f33');
    const colorB = ref('#0c2742');
    const checkerRepeat = ref(1);

    function ensureCheckerboardPattern(target = document.body) {
        const id = patternId.value;
        if (document.getElementById(id)) return id;
        const svgNamespace = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(svgNamespace, 'svg');
        svg.setAttribute('width', '0');
        svg.setAttribute('height', '0');
        svg.style.position = 'absolute';
        svg.style.left = '-9999px';
        const defs = document.createElementNS(svgNamespace, 'defs');
        const pattern = document.createElementNS(svgNamespace, 'pattern');
        pattern.setAttribute('id', id);
        const repeatSize = checkerRepeat.value
        pattern.setAttribute('width', String(repeatSize));
        pattern.setAttribute('height', String(repeatSize));
        pattern.setAttribute('patternUnits', 'userSpaceOnUse');
        const r00 = document.createElementNS(svgNamespace, 'rect');
        r00.setAttribute('x', '0');
        r00.setAttribute('y', '0');
        r00.setAttribute('width', String(repeatSize / 2));
        r00.setAttribute('height', String(repeatSize / 2));
        r00.setAttribute('fill', colorA.value);
        const r11 = document.createElementNS(svgNamespace, 'rect');
        r11.setAttribute('x', String(repeatSize / 2));
        r11.setAttribute('y', String(repeatSize / 2));
        r11.setAttribute('width', String(repeatSize / 2));
        r11.setAttribute('height', String(repeatSize / 2));
        r11.setAttribute('fill', colorA.value);
        const r10 = document.createElementNS(svgNamespace, 'rect');
        r10.setAttribute('x', String(repeatSize / 2));
        r10.setAttribute('y', '0');
        r10.setAttribute('width', String(repeatSize / 2));
        r10.setAttribute('height', String(repeatSize / 2));
        r10.setAttribute('fill', colorB.value);
        const r01 = document.createElementNS(svgNamespace, 'rect');
        r01.setAttribute('x', '0');
        r01.setAttribute('y', String(repeatSize / 2));
        r01.setAttribute('width', String(repeatSize / 2));
        r01.setAttribute('height', String(repeatSize / 2));
        r01.setAttribute('fill', colorB.value);
        pattern.appendChild(r00);
        pattern.appendChild(r11);
        pattern.appendChild(r10);
        pattern.appendChild(r01);
        defs.appendChild(pattern);
        svg.appendChild(defs);
        target.appendChild(svg);
        return id;
    }

    function bresenhamLine(x0, y0, x1, y1) {
        const points = [];
        let deltaX = Math.abs(x1 - x0),
            stepX = x0 < x1 ? 1 : -1;
        let deltaY = -Math.abs(y1 - y0),
            stepY = y0 < y1 ? 1 : -1;
        let error = deltaX + deltaY;
        while (true) {
            points.push([x0, y0]);
            if (x0 === x1 && y0 === y1) break;
            const error2 = 2 * error;
            if (error2 >= deltaY) {
                error += deltaY;
                x0 += stepX;
            }
            if (error2 <= deltaX) {
                error += deltaX;
                y0 += stepY;
            }
        }
        return points;
    }

    function ensureStagePointerStyles() {
        if (document.getElementById('stage-style-fix')) return;
        const style = document.createElement('style');
        style.id = 'stage-style-fix';
        style.textContent = `#stage{touch-action:none;-webkit-user-select:none;user-select:none;}
      #stage .svg-layer{pointer-events:none;}
      #stage .display-img{image-rendering:pixelated;}
    `;
        document.head.appendChild(style);
    }

    function clientToPixel(event) {
        const x = Math.floor((event.clientX - stageStore.canvas.x) / stageStore.canvas.scale);
        const y = Math.floor((event.clientY - stageStore.canvas.y) / stageStore.canvas.scale);
        if (x < 0 || y < 0 || x >= stageStore.canvas.width || y >= stageStore.canvas.height) return null;
        return { x, y };
    }

    function updateHover(event) {
        const pixel = clientToPixel(event);
        if (!pixel) {
            stageStore.updatePixelInfo('-');
            hoverLayerId.value = null;
            return;
        }
        if (stageStore.display === 'original' && input.hasImage) {
            const colorObject = input.getPixel(pixel.x, pixel.y);
            stageStore.updatePixelInfo(`[${pixel.x},${pixel.y}] ${rgbaCssObj(colorObject)}`);
        } else {
            const colorU32 = layerSvc.compositeColorAt(pixel.x, pixel.y);
            stageStore.updatePixelInfo(`[${pixel.x},${pixel.y}] ${rgbaCssU32(colorU32)}`);
        }
        if (toolStore.isSelect) {
            hoverLayerId.value = layerSvc.topVisibleLayerIdAt(pixel.x, pixel.y);
        } else {
            hoverLayerId.value = null;
        }
    }

    function getPixelsFromInteraction(event) {
        const toolState = toolStore.state;
        let pixels = [];
        if (toolState.status === 'rect') {
            const left = Math.min(toolState.startPoint.x, event.clientX) - stageStore.canvas.x;
            const top = Math.min(toolState.startPoint.y, event.clientY) - stageStore.canvas.y;
            const right = Math.max(toolState.startPoint.x, event.clientX) - stageStore.canvas.x;
            const bottom = Math.max(toolState.startPoint.y, event.clientY) - stageStore.canvas.y;
            const minX = Math.floor(left / stageStore.canvas.scale),
                maxX = Math.floor((right - 1) / stageStore.canvas.scale);
            const minY = Math.floor(top / stageStore.canvas.scale),
                maxY = Math.floor((bottom - 1) / stageStore.canvas.scale);

            if (minX > maxX || minY > maxY) {
                const p = clientToPixel(event);
                if (p) pixels.push([p.x, p.y]);
            } else {
                const minx = clamp(minX, 0, stageStore.canvas.width - 1),
                    maxx = clamp(maxX, 0, stageStore.canvas.width - 1);
                const miny = clamp(minY, 0, stageStore.canvas.height - 1),
                    maxy = clamp(maxY, 0, stageStore.canvas.height - 1);
                for (let yy = miny; yy <= maxy; yy++)
                    for (let xx = minx; xx <= maxx; xx++) pixels.push([xx, yy]);
            }
        } else if (toolState.status === 'stroke') {
            toolStore.visited.forEach(key => pixels.push(keyToCoords(key)));
        }
        return pixels;
    }


    const cursor = computed(() => {
        const tool = toolStore.effectiveTool;
        const shape = toolStore.toolShape;

        if (tool === 'select') {
            const isRemoving = toolStore.shiftHeld && selection.has(hoverLayerId.value);
            if (shape === 'stroke') {
                return isRemoving ? CURSOR_CONFIG.REMOVE_STROKE : CURSOR_CONFIG.ADD_STROKE;
            }
            if (shape === 'rect') {
                return isRemoving ? CURSOR_CONFIG.REMOVE_RECT : CURSOR_CONFIG.ADD_RECT;
            }
        }

        if (tool === 'draw' && shape === 'stroke') return CURSOR_CONFIG.DRAW_STROKE;
        if (tool === 'draw' && shape === 'rect') return CURSOR_CONFIG.DRAW_RECT;
        if (tool === 'erase' && shape === 'stroke') return CURSOR_CONFIG.ERASE_STROKE;
        if (tool === 'erase' && shape === 'rect') return CURSOR_CONFIG.ERASE_RECT;
        if (tool === 'globalErase' && shape === 'stroke') return CURSOR_CONFIG.GLOBAL_ERASE_STROKE;
        if (tool === 'globalErase' && shape === 'rect') return CURSOR_CONFIG.GLOBAL_ERASE_RECT;
        return 'default';
    });

    return {
        // interaction state
        hoverLayerId,
        addOverlayPath,
        removeOverlayPath,
        isDragging: computed(() => toolStore.state.isDragging),
        cursor,
        // methods
        recalcScale,
        updateHover,
        clientToPixel,
        getPixelsFromInteraction,
        bresenhamLine,
        // keyboard handlers
        ctrlKeyDown,
        ctrlKeyUp,
        shiftKeyDown,
        shiftKeyUp,
        // utils for components
        ensureCheckerboardPattern,
        ensureStagePointerStyles,
    };
});
