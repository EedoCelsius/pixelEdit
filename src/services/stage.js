import { defineStore } from 'pinia';
import { reactive, ref, computed, watch } from 'vue';
import { useStageStore } from '../stores/stage';
import { useSelectionStore } from '../stores/selection';
import { useLayerService } from './layers';
import { useOutputStore } from '../stores/output';
import { useInputStore } from '../stores/input';
import { coordsToKey, keyToCoords, pixelsToUnionPath, clamp, rgbaCssObj, rgbaCssU32 } from '../utils';
import { OVERLAY_CONFIG, CURSOR_CONFIG } from '../constants';

export const useStageService = defineStore('stageService', () => {
    // stores
    const stageStore = useStageStore();
    const selection = useSelectionStore();
    const layerSvc = useLayerService();
    const output = useOutputStore();
    const input = useInputStore();

    // --- Interaction State ---
    const state = reactive({
        status: 'idle', // 'idle' | 'stroke' | 'rect'
        startPoint: null, // {x, y} client coords
        pointerId: null,
        isDragging: false,
        selectionMode: null, // 'add' | 'remove'
    });
    const marquee = reactive({ visible: false, x: 0, y: 0, w: 0, h: 0 });
    const hoverLayerId = ref(null);
    const initialSelectionOnDrag = ref(new Set());
    const addOverlayLayerIds = ref(new Set());
    const removeOverlayLayerIds = ref(new Set());
    const lastPoint = ref(null);
    const visited = ref(new Set());

    // --- Keyboard State & Handlers ---
    let ctrlKeyDownTimestamp = 0;
    const KEY_TAP_MS = 200;

    function ctrlKeyDown() {
        if (!stageStore.ctrlHeld) {
            ctrlKeyDownTimestamp = performance.now();
            stageStore.setCtrlHeld(true);
        }
    }
    function ctrlKeyUp() {
        if (performance.now() - ctrlKeyDownTimestamp < KEY_TAP_MS) {
            if (stageStore.currentMode === 'single') {
                if (stageStore.tool === 'draw' || stageStore.tool === 'erase') {
                    stageStore.setTool(stageStore.tool === 'draw' ? 'erase' : 'draw');
                }
            } else { // multi mode
                if (stageStore.tool === 'select' || stageStore.tool === 'globalErase') {
                    stageStore.setTool(stageStore.tool === 'select' ? 'globalErase' : 'select');
                }
            }
        }
        stageStore.setCtrlHeld(false);
        ctrlKeyDownTimestamp = 0;
    }
    function shiftKeyDown() { stageStore.setShiftHeld(true); }
    function shiftKeyUp() { stageStore.setShiftHeld(false); }

    // --- Auto-tool switching on mode change ---
    watch(() => stageStore.currentMode, (newMode) => {
        if (newMode === 'single') {
            if (stageStore.tool === 'select' || stageStore.tool === 'globalErase') {
                stageStore.setTool('draw');
            }
        } else { // multi
            if (stageStore.tool === 'draw' || stageStore.tool === 'erase') {
                stageStore.setTool('select');
            }
        }
    }, { immediate: true });

    // --- Overlay Paths ---
    const addOverlayPath = computed(() => {
        if (!addOverlayLayerIds.value.size) return '';
        const pixelUnionSet = new Set();
        for (const id of addOverlayLayerIds.value) {
            layerSvc.layerById(id)?.forEachPixel((x, y) => pixelUnionSet.add(coordsToKey(x, y)));
        }
        return pixelsToUnionPath(pixelUnionSet);
    });
    const removeOverlayPath = computed(() => {
        if (!removeOverlayLayerIds.value.size) return '';
        const pixelUnionSet = new Set();
        for (const id of removeOverlayLayerIds.value) {
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
        const newScale = Math.floor(Math.min(maxW / Math.max(1, stageStore.stage.width), maxH / Math.max(1, stageStore.stage.height))) || 16;
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
        const x = Math.floor((event.clientX - stageStore.stage.x) / stageStore.stage.scale);
        const y = Math.floor((event.clientY - stageStore.stage.y) / stageStore.stage.scale);
        if (x < 0 || y < 0 || x >= stageStore.stage.width || y >= stageStore.stage.height) return null;
        return { x, y };
    }

    // --- Pointer Handlers ---
    function pointerDown(event) {
        if (event.button !== 0) return;
        const pixel = clientToPixel(event);
        if (!pixel) return;

        if (stageStore.isSelect) {
            const startId = layerSvc.topVisibleLayerIdAt(pixel.x, pixel.y);
            initialSelectionOnDrag.value = new Set(selection.asArray);
            state.selectionMode = (event.shiftKey && selection.has(startId)) ? 'remove' : 'add';
        }

        if (stageStore.isDraw || stageStore.isErase || stageStore.isSelect || stageStore.isGlobalErase) {
            output.setRollbackPoint();
        }

        state.status = stageStore.toolShape;
        state.startPoint = { x: event.clientX, y: event.clientY };
        state.isDragging = false;

        try {
            event.target.setPointerCapture?.(event.pointerId);
            state.pointerId = event.pointerId;
        } catch {}

        if (state.status === 'rect') {
            marquee.x = pixel.x;
            marquee.y = pixel.y;
            marquee.w = 0;
            marquee.h = 0;
            marquee.visible = true;
        } else if (state.status === 'stroke') {
            lastPoint.value = pixel;
            visited.value.clear();
            visited.value.add(coordsToKey(pixel.x, pixel.y));

            // Handle first pixel
            if (stageStore.isSelect) {
                const id = layerSvc.topVisibleLayerIdAt(pixel.x, pixel.y);
                if (id !== null) {
                    if (state.selectionMode === 'add') {
                        if (!initialSelectionOnDrag.value.has(id)) addOverlayLayerIds.value.add(id);
                    } else { // 'remove'
                        if (initialSelectionOnDrag.value.has(id)) removeOverlayLayerIds.value.add(id);
                    }
                }
            } else if (stageStore.isGlobalErase) {
                if (selection.exists) layerSvc.removePixelsFromSelected([[pixel.x, pixel.y]]);
                else layerSvc.removePixelsFromAll([[pixel.x, pixel.y]]);
            } else if (stageStore.isDraw || stageStore.isErase) {
                if (stageStore.isErase) layerSvc.removePixelsFromSelection([[pixel.x, pixel.y]]);
                else layerSvc.addPixelsToSelection([[pixel.x, pixel.y]]);
            }
        }
    }
    
    function pointerMove(event) {
        const pixel = clientToPixel(event);

        // Update hover info regardless of interaction state
        if (!pixel) {
            stageStore.updatePixelInfo('-');
            hoverLayerId.value = null;
        } else {
            if (stageStore.displayMode === 'original' && input.hasImage) {
                const colorObject = input.getPixel(pixel.x, pixel.y);
                stageStore.updatePixelInfo(`[${pixel.x},${pixel.y}] ${rgbaCssObj(colorObject)}`);
            } else {
                const colorU32 = layerSvc.compositeColorAt(pixel.x, pixel.y);
                stageStore.updatePixelInfo(`[${pixel.x},${pixel.y}] ${rgbaCssU32(colorU32)}`);
            }
            if (stageStore.isSelect) {
                hoverLayerId.value = layerSvc.topVisibleLayerIdAt(pixel.x, pixel.y);
            } else {
                hoverLayerId.value = null;
            }
        }

        if (state.status === 'idle') return;

        if (!state.isDragging && state.startPoint) {
            const dx = Math.abs(event.clientX - state.startPoint.x);
            const dy = Math.abs(event.clientY - state.startPoint.y);
            if (dx > 4 || dy > 4) state.isDragging = true;
        }

        if (state.isDragging) {
            if (state.status === 'rect') {
                const left = Math.min(state.startPoint.x, event.clientX) - stageStore.stage.x;
                const top = Math.min(state.startPoint.y, event.clientY) - stageStore.stage.y;
                const right = Math.max(state.startPoint.x, event.clientX) - stageStore.stage.x;
                const bottom = Math.max(state.startPoint.y, event.clientY) - stageStore.stage.y;
                const minX = Math.floor(left / stageStore.stage.scale),
                    maxX = Math.floor((right - 1) / stageStore.stage.scale);
                const minY = Math.floor(top / stageStore.stage.scale),
                    maxY = Math.floor((bottom - 1) / stageStore.stage.scale);
                const minx = clamp(minX, 0, stageStore.stage.width - 1),
                    maxx = clamp(maxX, 0, stageStore.stage.width - 1);
                const miny = clamp(minY, 0, stageStore.stage.height - 1),
                    maxy = clamp(maxY, 0, stageStore.stage.height - 1);
                marquee.x = minx;
                marquee.y = miny;
                marquee.w = (maxx >= minx) ? (maxx - minx + 1) : 0;
                marquee.h = (maxy >= miny) ? (maxy - miny + 1) : 0;

                if (stageStore.isSelect) {
                    const pixels = [];
                    for (let yy = marquee.y; yy < marquee.y + marquee.h; yy++) {
                        for (let xx = marquee.x; xx < marquee.x + marquee.w; xx++) {
                            pixels.push([xx, yy]);
                        }
                    }
                    const intersectedIds = new Set();
                    if (pixels.length > 0) {
                        for (const [x, y] of pixels) {
                            const id = layerSvc.topVisibleLayerIdAt(x, y);
                            if (id !== null) intersectedIds.add(id);
                        }
                    }
                    addOverlayLayerIds.value.clear();
                    removeOverlayLayerIds.value.clear();
                    if (state.selectionMode === 'add') {
                        for (const id of intersectedIds) {
                            if (!initialSelectionOnDrag.value.has(id)) addOverlayLayerIds.value.add(id);
                        }
                    } else { // 'remove'
                        for (const id of intersectedIds) {
                            if (initialSelectionOnDrag.value.has(id)) removeOverlayLayerIds.value.add(id);
                        }
                    }
                }

            } else if (state.status === 'stroke') {
                if (!pixel || !lastPoint.value) {
                    lastPoint.value = pixel;
                    return;
                }
                const line = bresenhamLine(lastPoint.value.x, lastPoint.value.y, pixel.x, pixel.y);
                const delta = [];
                for (const [x, y] of line) {
                    const k = coordsToKey(x, y);
                    if (!visited.value.has(k)) {
                        visited.value.add(k);
                        delta.push([x, y]);
                    }
                }
                if (delta.length) {
                    if (stageStore.isSelect) {
                        const intersectedIds = new Set();
                        for (const [x, y] of delta) {
                            const id = layerSvc.topVisibleLayerIdAt(x, y);
                            if (id !== null) intersectedIds.add(id);
                        }
                        if (state.selectionMode === 'add') {
                            for (const id of intersectedIds) {
                                if (!initialSelectionOnDrag.value.has(id)) addOverlayLayerIds.value.add(id);
                            }
                        } else { // 'remove'
                            for (const id of intersectedIds) {
                                if (initialSelectionOnDrag.value.has(id)) removeOverlayLayerIds.value.add(id);
                            }
                        }
                    } else if (stageStore.isGlobalErase) {
                        if (selection.exists) layerSvc.removePixelsFromSelected(delta);
                        else layerSvc.removePixelsFromAll(delta);
                    } else if (stageStore.isDraw || stageStore.isErase) {
                        if (stageStore.isErase) layerSvc.removePixelsFromSelection(delta);
                        else layerSvc.addPixelsToSelection(delta);
                    }
                }
                lastPoint.value = pixel;
            }
        }
    }

    function getPixelsFromInteraction(event) {
        let pixels = [];
        if (state.status === 'rect') {
            const left = Math.min(state.startPoint.x, event.clientX) - stageStore.stage.x;
            const top = Math.min(state.startPoint.y, event.clientY) - stageStore.stage.y;
            const right = Math.max(state.startPoint.x, event.clientX) - stageStore.stage.x;
            const bottom = Math.max(state.startPoint.y, event.clientY) - stageStore.stage.y;
            const minX = Math.floor(left / stageStore.stage.scale),
                maxX = Math.floor((right - 1) / stageStore.stage.scale);
            const minY = Math.floor(top / stageStore.stage.scale),
                maxY = Math.floor((bottom - 1) / stageStore.stage.scale);

            if (minX > maxX || minY > maxY) {
                const p = clientToPixel(event);
                if (p) pixels.push([p.x, p.y]);
            } else {
                const minx = clamp(minX, 0, stageStore.stage.width - 1),
                    maxx = clamp(maxX, 0, stageStore.stage.width - 1);
                const miny = clamp(minY, 0, stageStore.stage.height - 1),
                    maxy = clamp(maxY, 0, stageStore.stage.height - 1);
                for (let yy = miny; yy <= maxy; yy++)
                    for (let xx = minx; xx <= maxx; xx++) pixels.push([xx, yy]);
            }
        } else if (state.status === 'stroke') {
            visited.value.forEach(key => pixels.push(keyToCoords(key)));
        }
        return pixels;
    }

    function pointerUp(event) {
        if (state.status === 'idle') return;

        const wasEditing = stageStore.isDraw || stageStore.isErase || stageStore.isGlobalErase;
        const wasSelecting = stageStore.isSelect;

        if (wasSelecting) {
            const pixel = clientToPixel(event);
            if (!state.isDragging && pixel) { // It was a click, not a drag
                const id = layerSvc.topVisibleLayerIdAt(pixel.x, pixel.y);
                if (event.shiftKey) { // Toggle State click
                    selection.toggle(id);
                } else { // Select State click
                    selection.selectOnly(id);
                }
                if (id !== null) {
                    selection.setScrollRule({
                        type: 'follow',
                        target: id
                    });
                }
            } else { // It was a drag
                const pixels = getPixelsFromInteraction(event);
                if (pixels.length > 0) {
                    const intersectedIds = new Set();
                    for (const [x, y] of pixels) {
                        const id = layerSvc.topVisibleLayerIdAt(x, y);
                        if (id !== null) intersectedIds.add(id);
                    }

                    const currentSelection = new Set(selection.asArray);
                    if (state.selectionMode === 'add') {
                        intersectedIds.forEach(id => currentSelection.add(id));
                    } else { // 'remove'
                        intersectedIds.forEach(id => currentSelection.delete(id));
                    }
                    
                    if (event.shiftKey) {
                        selection.set([...currentSelection], selection.anchorId, selection.tailId);
                    } else {
                         selection.set([...currentSelection], null, null);
                    }

                } else if (!event.shiftKey) {
                    selection.clear();
                }
            }
        } else { // Draw/Erase tools
            if (state.status === 'rect') {
                const pixels = getPixelsFromInteraction(event);
                if (pixels.length > 0) {
                    if (stageStore.isGlobalErase) {
                        if (selection.exists) layerSvc.removePixelsFromSelected(pixels);
                        else layerSvc.removePixelsFromAll(pixels);
                    } else if (stageStore.isDraw || stageStore.isErase) {
                        if (stageStore.isErase) layerSvc.removePixelsFromSelection(pixels);
                        else layerSvc.addPixelsToSelection(pixels);
                    }
                }
            }
        }

        try {
            event.target?.releasePointerCapture?.(state.pointerId);
        } catch {}

        // Commit changes and reset state
        if (wasEditing || wasSelecting) {
            output.commit();
        } else {
            output.clearRollbackPoint();
        }
        state.status = 'idle';
        state.pointerId = null;
        state.startPoint = null;
        state.isDragging = false;
        state.selectionMode = null;
        marquee.visible = false;
        lastPoint.value = null;
        visited.value.clear();
        addOverlayLayerIds.value.clear();
        removeOverlayLayerIds.value.clear();
        initialSelectionOnDrag.value.clear();
    }

    function pointerCancel() {
        if (state.status === 'idle') return;

        output.rollbackPending();

        state.status = 'idle';
        state.pointerId = null;
        state.startPoint = null;
        state.isDragging = false;
        state.selectionMode = null;
        marquee.visible = false;
        lastPoint.value = null;
        visited.value.clear();
        hoverLayerId.value = null;
        addOverlayLayerIds.value.clear();
        removeOverlayLayerIds.value.clear();
        initialSelectionOnDrag.value.clear();
    }

    const cursor = computed(() => {
        const tool = stageStore.effectiveTool;
        const shape = stageStore.toolShape;

        if (tool === 'select') {
            const isRemoving = stageStore.shiftHeld && selection.has(hoverLayerId.value);
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
        marquee,
        hoverLayerId,
        addOverlayPath,
        removeOverlayPath,
        isDragging: computed(() => state.isDragging),
        cursor,
        // methods
        recalcScale,
        pointerDown,
        pointerMove,
        pointerUp,
        pointerCancel,
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
