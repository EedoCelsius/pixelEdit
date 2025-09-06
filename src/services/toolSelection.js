import { defineStore } from 'pinia';
import { ref, reactive, computed, watch } from 'vue';
import { useStore } from '../stores';
import { coordToIndex, indexToCoord } from '../utils';
import { WAND_TOOLS } from '@/constants';

export const useToolSelectionService = defineStore('toolSelectionService', () => {
    const { viewport: viewportStore, viewportEvent: viewportEvents, output } = useStore();

    const active = ref(false)
    const prepared = ref(['draw', 'select']);
    const index = ref(1);
    const shape = ref(null);
    const cursor = reactive({ stroke: 'default', rect: 'default', wand: 'default' });
    const hoverPixel = ref(null);
    const dragPixel = ref(null);
    const previewPixels = ref([]);
    const affectedPixels = ref([]);
    const marquee = reactive({ visible: false, anchorEvent: null, tailEvent: null });
    let pointer = null, nextShape = null;

    const isStroke = computed(() => shape.value === 'stroke');
    const isRect = computed(() => shape.value === 'rect');
    const isWand = computed(() => shape.value === 'wand');
    const wandToolTypes = new Set(WAND_TOOLS.map(t => t.type));

    function findUsable(t) {
        let idx = prepared.value.indexOf(t);
        const last = prepared.value.length - 1;
        if (idx === -1) {
            prepared.value.push(t);
            index.value = prepared.value.length - 1;
            return;
        }
        if (idx === last) {
            index.value = last - 1;
        } else {
            prepared.value.splice(idx, 1);
            prepared.value.push(t);
            index.value = prepared.value.length - 1;
        }
    }
    function setPrepared(t) {
        if (shape.value === 'wand' && !wandToolTypes.has(t) && t !== 'waiting' && t !== 'done') return;
        findUsable(t);
    }
    function useOther() {
        if (index.value > 0) index.value--;
    }
    function setShape(s) {
        if (wandToolTypes.has(prepared.value[index.value])) return;
        if (active.value) nextShape = s;
        else {
            shape.value = s;
            if (s === 'wand') findUsable('waiting');
        }
    }
    function setCursor(c) { Object.assign(cursor, c); }
    function getCursor() { return cursor[shape.value] || 'default'; }

    function getPixelsInsideMarquee() {
        const startPixel = viewportStore.clientToIndex(marquee.anchorEvent, { allowViewport: true });
        const currentPixel = viewportStore.clientToIndex(marquee.tailEvent, { allowViewport: true });

        const [sx, sy] = indexToCoord(startPixel);
        const [cx, cy] = indexToCoord(currentPixel);

        const minX = Math.max(Math.min(sx, cx), 0);
        const maxX = Math.min(Math.max(sx, cx), viewportStore.stage.width - 1);
        const minY = Math.max(Math.min(sy, cy), 0);
        const maxY = Math.min(Math.max(sy, cy), viewportStore.stage.height - 1);

        if (viewportStore.stage.width - 1 < minX || viewportStore.stage.height - 1 < minY || maxX < 0 || maxY < 0) return [];

        const pixels = [];
        for (let yy = minY; yy <= maxY; yy++)
            for (let xx = minX; xx <= maxX; xx++) pixels.push(coordToIndex(xx, yy));
        return pixels;
    }

    watch(() => viewportEvents.recent.pointer.down, (downs) => {
        for (const e of downs) {
            if (e.button !== 0 || viewportEvents.pinchIds) continue;

            output.setRollbackPoint();
            try { e.target.setPointerCapture?.(e.pointerId); } catch {}

            const pixel = viewportStore.clientToIndex(e);
            if (pixel != null) previewPixels.value = [pixel];
            if (hoverPixel.value !== null) hoverPixel.value = null;
            if (pixel !== null) dragPixel.value = pixel;

            active.value = true;
            pointer = e.pointerId, nextShape = shape.value;
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
            const pixel = viewportStore.clientToIndex(moves[0]);
            if (hoverPixel.value !== pixel) hoverPixel.value = pixel;
            return;
        }
        if (!moves.find(e => e.pointerId === pointer)) return;

        const e = viewportEvents.get('pointermove', pointer);
        if (!e || viewportEvents.pinchIds) return;

        const pixel = viewportStore.clientToIndex(e);
        if (dragPixel.value !== pixel) dragPixel.value = pixel;

        if (shape.value === 'stroke') {
            if (pixel == null || previewPixels.value.includes(pixel)) return;
            previewPixels.value = [...previewPixels.value, pixel];
        }
        else if (shape.value === 'rect') {
            const previousTailPixel = viewportStore.clientToIndex(marquee.tailEvent, { allowViewport: true });
            const currentPixel = viewportStore.clientToIndex(e, { allowViewport: true });
            marquee.tailEvent = e;
            if (previousTailPixel !== currentPixel)
                previewPixels.value = getPixelsInsideMarquee();
        }
    });

    watch(() => viewportEvents.recent.pointer.up, (ups) => {
        if (!pointer || !ups.find(e => e.pointerId === pointer)) return;
        
        const e = viewportEvents.get('pointerup', pointer);
        if (!e || viewportEvents.pinchIds) return;

        const pixel = viewportStore.clientToIndex(e);
        if (dragPixel.value !== null) dragPixel.value = null;
        if (pixel !== null) hoverPixel.value = pixel;
        if (previewPixels.value.length) {
            affectedPixels.value = previewPixels.value;
            previewPixels.value = [];
        }

        output.commit();
        try { e.target.releasePointerCapture?.(pointer); } catch {}

        active.value = false;
        pointer = null;
        if (shape.value !== nextShape) shape.value = nextShape;
        marquee.visible = false;
        const overflow = prepared.value.length - 5;
        if (overflow > 0) {
            prepared.value.splice(0, overflow);
            index.value = Math.max(0, index.value - overflow);
        }
    });

    watch(() => [ viewportEvents.pinchIds, viewportEvents.recent.pointer.cancel ], ([pinches, cancels]) => {
        if (!pinches?.includes(pointer) || !cancels.includes(pointer)) return;
        output.rollbackPending();
        const startEvent = viewportEvents.get('pointerdown', pointer);
        try { startEvent?.target?.releasePointerCapture?.(pointer); } catch {}
        
        active.value = false;
        pointer = null;
        if (shape.value !== nextShape) shape.value = nextShape;
        marquee.visible = false;
        const overflow = prepared.value.length - 5;
        if (overflow > 0) {
            prepared.value.splice(0, overflow);
            index.value = Math.max(0, index.value - overflow);
        }
        previewPixels.value = [];
        affectedPixels.value = [];
    });

    return {
        prepared,
        index,
        shape,
        marquee,
        hoverPixel,
        dragPixel,
        previewPixels,
        affectedPixels,
        active,
        isStroke,
        isRect,
        isWand,
        setPrepared,
        findUsable,
        useOther,
        setShape,
        setCursor,
        getCursor,
    };
});
