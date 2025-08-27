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
    const marquee = reactive({ visible: false, anchorEvent: null, tailEvent: null });
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

    function getPixelsInsideMarquee() {
        const startCoord = viewportStore.clientToCoord(marquee.anchorEvent, { allowViewport: true });
        const currentCoord = viewportStore.clientToCoord(marquee.tailEvent, { allowViewport: true });

        const minX = Math.max(Math.min(startCoord[0], currentCoord[0]), 0);
        const maxX = Math.min(Math.max(startCoord[0], currentCoord[0]), viewportStore.stage.width - 1);
        const minY = Math.max(Math.min(startCoord[1], currentCoord[1]), 0);
        const maxY = Math.min(Math.max(startCoord[1], currentCoord[1]), viewportStore.stage.height - 1);

        if (viewportStore.stage.width - 1 < minX || viewportStore.stage.height - 1 < minY || maxX < 0 || maxY < 0) return [];

        const pixels = [];
        for (let yy = minY; yy <= maxY; yy++)
            for (let xx = minX; xx <= maxX; xx++) pixels.push([xx, yy]);
        return pixels;
    }

    watch(() => viewportEvents.recent.pointer.down, (downs) => {
        for (const e of downs) {
            if (e.button !== 0 || viewportEvents.pinchIds) continue;

            output.setRollbackPoint();
            try { e.target.setPointerCapture?.(e.pointerId); } catch {}

            const pixel = viewportStore.clientToCoord(e);
            if (pixel) previewPixels.value = [pixel];

            pointer = e.pointerId;
            if (shape.value === 'rect') {
                marquee.visible = true;
                marquee.anchorEvent = e;
                marquee.tailEvent = e;
            }
            break;
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
        
        if (shape.value === 'rect') {
            const previousTailCoord = viewportStore.clientToCoord(marquee.tailEvent, { allowViewport: true });
            const currentCoord = viewportStore.clientToCoord(e, { allowViewport: true });
            marquee.tailEvent = e;
            if (previousTailCoord[0] !== currentCoord[0] || previousTailCoord[1] !== currentCoord[1])
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
        
        if (previewPixels.value.length) {
            affectedPixels.value = previewPixels.value;
            previewPixels.value = [];
        }

        output.commit();
        try { e.target.releasePointerCapture?.(pointer); } catch {}

        marquee.visible = false;
        pointer = null;
    });

    watch(() => [ viewportEvents.pinchIds, viewportEvents.recent.pointer.cancel ], ([pinches, cancels]) => {
        if (!pinches?.includes(pointer) || !cancels.includes(pointer)) return;
        output.rollbackPending();
        const startEvent = viewportEvents.get('pointerdown', pointer);
        try { startEvent?.target?.releasePointerCapture?.(pointer); } catch {}
        
        marquee.visible = false;
        pointer = null;
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
