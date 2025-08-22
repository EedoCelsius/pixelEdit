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
    const selectOverlayPath = computed(() => {
        if (!toolStore.selectOverlayLayerIds.size) return '';
        const pixelUnionSet = new Set();
        for (const id of toolStore.selectOverlayLayerIds) {
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
            toolStore.hoverLayerId = null;
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
            toolStore.hoverLayerId = layerSvc.topVisibleLayerIdAt(pixel.x, pixel.y);
        } else {
            toolStore.hoverLayerId = null;
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
            const isRemoving = toolStore.shiftHeld && selection.has(toolStore.hoverLayerId);
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
        selectOverlayPath,
        cursor,
        // methods
        recalcScale,
        updateHover,
        clientToPixel,
        getPixelsFromInteraction,
        // utils for components
        ensureCheckerboardPattern,
        ensureStagePointerStyles,
    };
});
