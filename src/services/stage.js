import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useStore } from '../stores';
import { SVG_NAMESPACE, CHECKERBOARD_CONFIG, MIN_SCALE_RATIO } from '@/constants';

export const useStageService = defineStore('stageService', () => {
    // stores
    const { stage: stageStore } = useStore();
    // stage element reference
    const element = ref(null);

    function setElement(el) {
        element.value = el;
    }

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


    return {
        element,
        setElement,
        // methods
        recalcMinScale,
        clientToCoord,
        // utils for components
        ensureCheckerboardPattern,
    };
});
