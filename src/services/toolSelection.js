import { defineStore } from 'pinia';
import { ref, reactive, computed, watch } from 'vue';
import { useStore } from '../stores';
import { useOverlayService } from './overlay';

export const useToolSelectionService = defineStore('toolSelectionService', () => {
    const { viewport: viewportStore, viewportEvent: viewportEvents, output } = useStore();
    const overlay = useOverlayService();

    const active = ref(false)
    const prepared = ref(null);
    const shape = ref(null);
    const cursor = reactive({ stroke: 'default', rect: 'default' });
    const hoverPixel = ref(null);
    const dragPixel = ref(null);
    const previewPixels = ref([]);
    const affectedPixels = ref([]);
    const marquee = reactive({ visible: false, anchorEvent: null, tailEvent: null });
    let pointer = null, nextTool = null, nextShape = null;

    const isStroke = computed(() => shape.value === 'stroke');
    const isRect = computed(() => shape.value === 'rect');

    function setPrepared(t) {
        console.log(t)
        if (active.value) nextTool = t;
        else prepared.value = t;
    }
    function setShape(s) {
        if (active.value) nextShape = s;
        else shape.value = s;
    }
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

            active.value = true;
            pointer = e.pointerId, nextTool = prepared.value, nextShape = shape.value;
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
            const pixel = viewportStore.clientToCoord(moves[0]);
            if (hoverPixel.value?.[0] !== pixel?.[0] || hoverPixel.value?.[1] !== pixel?.[1]) hoverPixel.value = pixel;
            return;
        }
        if (!moves.find(e => e.pointerId === pointer)) return;

        const e = viewportEvents.get('pointermove', pointer);
        if (!e || viewportEvents.pinchIds) return;
        
        const pixel = viewportStore.clientToCoord(e);
        if (hoverPixel.value !== null) hoverPixel.value = null;
        if (dragPixel.value?.[0] !== pixel?.[0] || dragPixel.value?.[1] !== pixel?.[1]) dragPixel.value = pixel;

        if (shape.value === 'stroke') {
            if (!pixel || previewPixels.value.find(p => p[0] === pixel[0] && p[1] === pixel[1])) return;
            previewPixels.value = [...previewPixels.value, pixel];
        }
        else if (shape.value === 'rect') {
            const previousTailCoord = viewportStore.clientToCoord(marquee.tailEvent, { allowViewport: true });
            const currentCoord = viewportStore.clientToCoord(e, { allowViewport: true });
            marquee.tailEvent = e;
            if (previousTailCoord[0] !== currentCoord[0] || previousTailCoord[1] !== currentCoord[1])
                previewPixels.value = getPixelsInsideMarquee();
        }
    });

    watch(() => viewportEvents.recent.pointer.up, (ups) => {
        if (!pointer || !ups.find(e => e.pointerId === pointer)) return;
        
        const e = viewportEvents.get('pointerup', pointer);
        if (!e || viewportEvents.pinchIds) return;
        
        const pixel = viewportStore.clientToCoord(e);
        if (dragPixel.value !== null) dragPixel.value = null;
        if (hoverPixel.value?.[0] !== pixel?.[0] || hoverPixel.value?.[1] !== pixel?.[1]) hoverPixel.value = pixel;
        if (previewPixels.value.length) {
            affectedPixels.value = previewPixels.value;
            previewPixels.value = [];
        }

        output.commit();
        try { e.target.releasePointerCapture?.(pointer); } catch {}

        active.value = false;
        pointer = null;
        if (prepared.value !== nextTool) prepared.value = nextTool;
        if (shape.value !== nextShape) shape.value = nextShape;
        marquee.visible = false;
    });

    watch(() => [ viewportEvents.pinchIds, viewportEvents.recent.pointer.cancel ], ([pinches, cancels]) => {
        if (!pinches?.includes(pointer) || !cancels.includes(pointer)) return;
        output.rollbackPending();
        const startEvent = viewportEvents.get('pointerdown', pointer);
        try { startEvent?.target?.releasePointerCapture?.(pointer); } catch {}
        
        active.value = false;
        pointer = null;
        if (prepared.value !== nextTool) prepared.value = nextTool;
        if (shape.value !== nextShape) shape.value = nextShape;
        marquee.visible = false;
        previewPixels.value = [];
        affectedPixels.value = [];
        overlay.helper.clear();
    });

    return {
        prepared,
        shape,
        marquee,
        hoverPixel,
        dragPixel,
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
