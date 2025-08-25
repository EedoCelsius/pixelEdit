import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useStore } from '../stores';
import { useOverlayService } from './overlay';
import { keyToCoord, getPixelUnion, pixelsToUnionPath, calcMarquee } from '../utils';
import { CURSOR_CONFIG, SVG_NAMESPACE, CHECKERBOARD_CONFIG, MIN_SCALE_RATIO } from '@/constants';

export const useStageService = defineStore('stageService', () => {
    // stores
    const { stage: stageStore, tool: toolStore, layers } = useStore();
    const overlay = useOverlayService();
    // stage element reference
    const element = ref(null);

    function setElement(el) {
        element.value = el;
    }

    // --- Overlay Paths ---
    const selectOverlayPath = computed(() => {
        if (!overlay.selectOverlayLayerIds.size) return '';
        const pixelUnion = getPixelUnion(layers.getProperties([...overlay.selectOverlayLayerIds]));
        return pixelsToUnionPath(pixelUnion);
    });

    // --- Canvas Utilities ---
    function recalcMinScale(viewportEl) {
        const style = getComputedStyle(viewportEl);
        const paddingLeft = parseFloat(style.paddingLeft) || 0;
        const paddingRight = parseFloat(style.paddingRight) || 0;
        const paddingTop = parseFloat(style.paddingTop) || 0;
        const paddingBottom = parseFloat(style.paddingBottom) || 0;
        const width = (viewportEl.clientWidth || 0) - paddingLeft - paddingRight;
        const height = (viewportEl.clientHeight || 0) - paddingTop - paddingBottom;
        const containScale = Math.min(
            width / Math.max(1, stageStore.canvas.width),
            height / Math.max(1, stageStore.canvas.height)
        );
        stageStore.setContainScale(containScale);
        const minScale = Math.max(1, containScale * MIN_SCALE_RATIO);
        stageStore.setMinScale(minScale);
    }
    const { PATTERN_ID, COLOR_A, COLOR_B, REPEAT } = CHECKERBOARD_CONFIG;

    function ensureCheckerboardPattern(target = document.body) {
        const id = PATTERN_ID;
        if (document.getElementById(id)) return id;
        const svg = document.createElementNS(SVG_NAMESPACE, 'svg');
        svg.setAttribute('width', '0');
        svg.setAttribute('height', '0');
        svg.style.position = 'absolute';
        svg.style.left = '-9999px';
        const defs = document.createElementNS(SVG_NAMESPACE, 'defs');
        const pattern = document.createElementNS(SVG_NAMESPACE, 'pattern');
        pattern.setAttribute('id', id);
        const repeatSize = REPEAT;
        pattern.setAttribute('width', String(repeatSize));
        pattern.setAttribute('height', String(repeatSize));
        pattern.setAttribute('patternUnits', 'userSpaceOnUse');
        const r00 = document.createElementNS(SVG_NAMESPACE, 'rect');
        r00.setAttribute('x', '0');
        r00.setAttribute('y', '0');
        r00.setAttribute('width', String(repeatSize / 2));
        r00.setAttribute('height', String(repeatSize / 2));
        r00.setAttribute('fill', COLOR_A);
        const r11 = document.createElementNS(SVG_NAMESPACE, 'rect');
        r11.setAttribute('x', String(repeatSize / 2));
        r11.setAttribute('y', String(repeatSize / 2));
        r11.setAttribute('width', String(repeatSize / 2));
        r11.setAttribute('height', String(repeatSize / 2));
        r11.setAttribute('fill', COLOR_A);
        const r10 = document.createElementNS(SVG_NAMESPACE, 'rect');
        r10.setAttribute('x', String(repeatSize / 2));
        r10.setAttribute('y', '0');
        r10.setAttribute('width', String(repeatSize / 2));
        r10.setAttribute('height', String(repeatSize / 2));
        r10.setAttribute('fill', COLOR_B);
        const r01 = document.createElementNS(SVG_NAMESPACE, 'rect');
        r01.setAttribute('x', '0');
        r01.setAttribute('y', String(repeatSize / 2));
        r01.setAttribute('width', String(repeatSize / 2));
        r01.setAttribute('height', String(repeatSize / 2));
        r01.setAttribute('fill', COLOR_B);
        pattern.appendChild(r00);
        pattern.appendChild(r11);
        pattern.appendChild(r10);
        pattern.appendChild(r01);
        defs.appendChild(pattern);
        svg.appendChild(defs);
        target.appendChild(svg);
        return id;
    }

    function clientToCoord(event) {
        const x = Math.floor((event.clientX - stageStore.canvas.x) / stageStore.canvas.scale);
        const y = Math.floor((event.clientY - stageStore.canvas.y) / stageStore.canvas.scale);
        if (x < 0 || y < 0 || x >= stageStore.canvas.width || y >= stageStore.canvas.height) return null;
        return [x, y];
    }


    function getPixelsFromInteraction(event) {
        const toolState = toolStore.pointer;
        let pixels = [];
        if (toolStore.shape === 'rect') {
            const { visible, x, y, w, h } = calcMarquee(
                toolState.start,
                { x: event.clientX, y: event.clientY },
                stageStore.canvas
            );
            if (!visible || w === 0 || h === 0) {
                const coord = clientToCoord(event);
                if (coord) pixels.push(coord);
            } else {
                for (let yy = y; yy < y + h; yy++)
                    for (let xx = x; xx < x + w; xx++) pixels.push([xx, yy]);
            }
        } else {
            toolStore.visited.forEach(key => pixels.push(keyToCoord(key)));
        }
        return pixels;
    }


    const cursor = computed(() => {
        const tool = toolStore.expected;
        const shape = toolStore.shape;

        if (tool === 'select') {
            const isRemoving = toolStore.shiftHeld && layers.isSelected(overlay.hoverLayerId);
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
        if (tool === 'cut' && shape === 'stroke') return CURSOR_CONFIG.CUT_STROKE;
        if (tool === 'cut' && shape === 'rect') return CURSOR_CONFIG.CUT_RECT;
        return 'default';
    });

    return {
        element,
        setElement,
        // interaction state
        cursor,
        // methods
        recalcMinScale,
        clientToCoord,
        getPixelsFromInteraction,
        // utils for components
        ensureCheckerboardPattern,
    };
});
