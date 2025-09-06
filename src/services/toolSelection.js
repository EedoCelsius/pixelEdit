import { defineStore } from 'pinia';
import { ref, reactive, computed, watch } from 'vue';
import { useStore } from '../stores';
import { coordToIndex, indexToCoord } from '../utils';

export const useToolSelectionService = defineStore('toolSelectionService', () => {
    const { viewport: viewportStore, viewportEvent: viewportEvents, output } = useStore();

    const active = ref(false)
    const prepared = ref([]);
    const index = ref(0);
    const recent = ref(null);
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
    const currentTool = computed(() => prepared.value[index.value]);
    const current = computed(() => currentTool.value?.type);
    const waitingTool = { type: 'waiting', name: 'Waiting', usable: computed(() => shape.value === 'wand') };

    function addPrepared(t, recordRollback = true) {
        prepared.value.push(t);
        if (recordRollback && shape.value === 'wand' && t !== waitingTool)
            output.setRollbackPoint();
        findUsable();
    }
    function findUsable() {
        if (active.value) return;
        recent.value = current.value === 'waiting' ? prepared.value[index.value - 1] : currentTool.value;
        for (let i = prepared.value.length - 1; i >= 0; i--) {
            const tool = prepared.value[i];
            if (tool?.usable?.value) {
                index.value = i;
                return;
            }
        }
        index.value = prepared.value.length - 1;
    }
    function useRecent() {
        if (current.value === recent.value) findUsable();
        else addPrepared(recent.value, false);
        if (output.hasPendingRollback) output.commit();
    }
    function setShape(s) {
        if (active.value) nextShape = s;
        else {
            shape.value = s;
            if (s === 'wand') addPrepared(waitingTool);
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
            pointer = e.pointerId;
            nextShape = shape.value;
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
        findUsable();
        prepared.value = prepared.value.slice(-5);
        index.value = prepared.value.length - 1;
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
        findUsable();
        if (shape.value !== nextShape) shape.value = nextShape;
        marquee.visible = false;
        previewPixels.value = [];
        affectedPixels.value = [];
    });

    watch(() => currentTool.value?.usable?.value, (u) => {
        if (u === false) findUsable();
    });

    return {
        prepared,
        index,
        current,
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
        addPrepared,
        findUsable,
        useRecent,
        setShape,
        setCursor,
        getCursor,
    };
});
