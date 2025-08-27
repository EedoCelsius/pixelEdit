import { defineStore } from 'pinia';
import { ref, reactive, computed, watch } from 'vue';
import { useStore } from '../stores';
import { useOverlayService } from './overlay';
import { TOOL_MODIFIERS, OVERLAY_CONFIG } from '@/constants';

export const useToolSelectionService = defineStore('toolSelectionService', () => {
    const { viewport: viewportStore, viewportEvent: viewportEvents, output } = useStore();
    const overlay = useOverlayService();

    const prepared = ref('draw');
    const shape = ref('stroke');
    const marquee = reactive({ visible: false, x: 0, y: 0, w: 0, h: 0 });
    const cursor = reactive({ stroke: 'default', rect: 'default' });
    const previewPixels = ref([]);
    const affectedPixels = ref([]);
    let pointer;

    const active = computed(() => {
        let tool = prepared.value;
        for (const { key, map } of TOOL_MODIFIERS) {
            if (!viewportEvents.isPressed(key)) continue;
            tool = map[tool] ?? map.default ?? tool;
            break;
        }
        return tool;
    });

    const isStroke = computed(() => shape.value === 'stroke');
    const isRect = computed(() => shape.value === 'rect');

    function setPrepared(t) { prepared.value = t; }
    function setShape(s) { shape.value = s === 'rect' ? 'rect' : 'stroke'; }
    function setCursor({ stroke, rect }) { cursor.stroke = stroke; cursor.rect = rect; }
    function getCursor() { return cursor[shape.value] || 'default'; }

    function updateMarquee(currentEvent) {
        let props;
        if (shape.value !== 'rect' || !pointer || !viewportEvents.isDragging(pointer)) {
            props = { visible: false, x: 0, y: 0, w: 0, h: 0 };
        }
        else {
            const startEvent = viewportEvents.get('pointerdown', pointer);
            const startCoord = viewportStore.clientToCoord(startEvent);
            let currentCoord = viewportStore.clientToCoord(currentEvent);
            if (!currentCoord) {
                const rect = viewportStore.element.getBoundingClientRect();
                const style = getComputedStyle(viewportStore.element);
                const left = rect.left + parseFloat(style.paddingLeft) + viewportStore.stage.offset.x;
                const top = rect.top + parseFloat(style.paddingTop) + viewportStore.stage.offset.y;
                let x = Math.floor((currentEvent.clientX - left) / viewportStore.stage.scale);
                let y = Math.floor((currentEvent.clientY - top) / viewportStore.stage.scale);
                x = Math.min(Math.max(x, 0), viewportStore.stage.width - 1);
                y = Math.min(Math.max(y, 0), viewportStore.stage.height - 1);
                currentCoord = [x, y];
            }
            const minX = Math.min(startCoord[0], currentCoord[0]);
            const maxX = Math.max(startCoord[0], currentCoord[0]);
            const minY = Math.min(startCoord[1], currentCoord[1]);
            const maxY = Math.max(startCoord[1], currentCoord[1]);
            props = {
                visible: true,
                x: minX,
                y: minY,
                w: maxX - minX + 1,
                h: maxY - minY + 1,
            };
        }
        Object.assign(marquee, props);
    }
    function getPixelsInsideMarquee() {
        const pixels = [];
        for (let yy = marquee.y; yy < marquee.y + marquee.h; yy++)
            for (let xx = marquee.x; xx < marquee.x + marquee.w; xx++) pixels.push([xx, yy]);
        return pixels;
    }


    watch(() => viewportEvents.recent.pointer.down, (downs) => {
        for (const e of downs) {
            if (e.button !== 0 || viewportEvents.pinchIds) continue;
            updateMarquee(e);

            output.setRollbackPoint();
            try { e.target.setPointerCapture?.(e.pointerId); } catch {}
            
            const pixel = viewportStore.clientToCoord(e);
            if (pixel) previewPixels.value = [pixel];

            pointer = e.pointerId;
            continue;
        }
    });

    watch(() => viewportEvents.recent.pointer.move, (moves) => {
        if (!pointer) {
            const e = moves[0];
            const pixel = viewportStore.clientToCoord(e);
            if (pixel) previewPixels.value = [pixel];
            else previewPixels.value = [];
            return;
        }
        if (!moves.find(e => e.pointerId === pointer)) return;

        const e = viewportEvents.get('pointermove', pointer);
        if (!e || viewportEvents.pinchIds) return;
        updateMarquee(e);
        
        if (shape.value === 'rect') {
            previewPixels.value = getPixelsInsideMarquee();
        }
        else if (shape.value === 'stroke') {
            const pixel = viewportStore.clientToCoord(e);
            if (!pixel) return;
            if (!previewPixels.value.find(p => p[0] === pixel[0] && p[1] === pixel[1])) previewPixels.value = [...previewPixels.value, pixel];
        }
    });

    watch(() => viewportEvents.recent.pointer.up, (ups) => {
        if (!pointer || !ups.find(e => e.pointerId === pointer)) return;
        
        const e = viewportEvents.get('pointerup', pointer);
        if (!e || viewportEvents.pinchIds) return;
        updateMarquee(e);
        affectedPixels.value = previewPixels.value;
        previewPixels.value = [];

        output.commit();
        try { e.target.releasePointerCapture?.(pointer); } catch {}

        pointer = null;
    });

    watch(() => [ viewportEvents.pinchIds, viewportEvents.recent.pointer.cancel ], ([pinches, cancels]) => {
        if (!pinches.includes(pointer) || !cancels.includes(pointer)) return;
        output.rollbackPending();
        const startEvent = viewportEvents.get('pointerdown', pointer);
        try { startEvent?.target?.releasePointerCapture?.(pointer); } catch {}
        pointer = null;
        updateMarquee();
        previewPixels.value = [];
        affectedPixels.value = [];
        overlay.helper.clear();
        overlay.helper.config = OVERLAY_CONFIG.ADD;
    });

    return {
        prepared,
        shape,
        marquee,
        previewPixels,
        affectedPixels,
        active,
        isStroke,
        isRect,
        setPrepared,
        setShape,
        setCursor,
        getCursor,
    };
});
