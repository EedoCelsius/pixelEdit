import { defineStore } from 'pinia';
import { ref, reactive, computed, watch } from 'vue';
import { useStore } from '../stores';
import { useViewportService } from './viewport';
import { calcMarquee, rgbaCssU32, rgbaCssObj } from '../utils';

export const useToolSelectionService = defineStore('toolSelectionService', () => {
    const { viewport: viewportStore, layers, input, viewportEvent: viewportEvents, output } = useStore();
    const viewport = useViewportService();

    const prepared = ref('draw');
    const shape = ref('stroke');
    const pointer = reactive({ status: 'idle', id: null, event: null });
    const marquee = reactive({ visible: false, x: 0, y: 0, w: 0, h: 0 });
    const previewPixels = ref([]);
    const affectedPixels = ref([]);

    const active = computed(() => {
        if (pointer.status !== 'idle') return pointer.status;
        let tool = prepared.value;
        if (viewportEvents.isPressed('Shift')) {
            tool = 'select';
        } else if (viewportEvents.isPressed('Control') || viewportEvents.isPressed('Meta')) {
            if (tool === 'draw') tool = 'erase';
            else if (tool === 'erase') tool = 'draw';
            else if (tool === 'select') tool = 'globalErase';
            else if (tool === 'globalErase') tool = 'select';
        }
        return tool;
    });

    const isDraw = computed(() => active.value === 'draw');
    const isErase = computed(() => active.value === 'erase');
    const isSelect = computed(() => active.value === 'select');
    const isGlobalErase = computed(() => active.value === 'globalErase');
    const isCut = computed(() => active.value === 'cut');
    const isStroke = computed(() => shape.value === 'stroke');
    const isRect = computed(() => shape.value === 'rect');

    function setPrepared(t) { prepared.value = t; }
    function setShape(s) { shape.value = s === 'rect' ? 'rect' : 'stroke'; }

    const updateHover = (event) => {
        const coord = viewportStore.clientToCoord(event);
        if (pointer.status === 'idle') {
            previewPixels.value = coord ? [coord] : [];
        }
        if (!coord) {
            viewportStore.updatePixelInfo('-');
            return;
        }
        const [px, py] = coord;
        if (viewportStore.display === 'original' && input.isLoaded) {
            const colorObject = input.readPixel(coord);
            viewportStore.updatePixelInfo(`[${px},${py}] ${rgbaCssObj(colorObject)}`);
        } else {
            const colorU32 = layers.compositeColorAt(coord);
            viewportStore.updatePixelInfo(`[${px},${py}] ${rgbaCssU32(colorU32)}`);
        }
    };

    const updateMarquee = (e) => {
        if (shape.value !== 'rect' || pointer.status === 'idle' || !viewportEvents.isDragging(pointer.id) || !e) {
            Object.assign(marquee, { visible: false, x: 0, y: 0, w: 0, h: 0 });
            return;
        }
        const startEvent = viewportEvents.get('pointerdown', pointer.id);
        Object.assign(marquee, calcMarquee(startEvent, e, viewportStore, viewport.element));
    };

    function updatePixels(type) {
        const pixels = getPixelsFromInteraction(type);
        previewPixels.value = pixels;
        if (type === 'up') {
            affectedPixels.value = pixels;
        } else if (shape.value === 'rect') {
            affectedPixels.value = [];
        } else {
            affectedPixels.value = pixels;
        }
    }

    function getPixelsFromInteraction(type) {
        const event = viewportEvents.get('pointer' + type, pointer.id);
        const pixels = [];
        if (!event) return pixels;
        if (shape.value === 'rect') {
            const startEvent = viewportEvents.get('pointerdown', pointer.id);
            const { visible, x, y, w, h } = startEvent ? calcMarquee(startEvent, event, viewportStore, viewport.element) : { visible: false, x:0, y:0, w:0, h:0 };
            if (!visible || w === 0 || h === 0) {
                const coord = viewportStore.clientToCoord(event);
                if (coord) pixels.push(coord);
            } else {
                for (let yy = y; yy < y + h; yy++)
                    for (let xx = x; xx < x + w; xx++) pixels.push([xx, yy]);
            }
        } else {
            const coord = viewportStore.clientToCoord(event);
            if (coord) pixels.push(coord);
        }
        return pixels;
    }

    const cursor = reactive({ stroke: 'default', rect: 'default' });

    function setCursor({ stroke, rect }) {
        if (stroke) cursor.stroke = stroke;
        if (rect) cursor.rect = rect;
    }

    function getCursor() {
        return cursor[shape.value] || 'default';
    }

    watch(() => viewportEvents.recent.pointer.down, (events) => {
        for (const e of events) {
            if (!e || e.button !== 0 || viewportEvents.pinchIds) continue;
            const coord = viewportStore.clientToCoord(e);
            if (!coord) continue;

            output.setRollbackPoint();
            try {
                e.target.setPointerCapture?.(e.pointerId);
                pointer.id = e.pointerId;
            } catch {}

            if (isSelect.value) {
                pointer.status = 'select';
                updatePixels('down');
            } else {
                pointer.status = active.value;
                updatePixels('down');
            }
            updateMarquee(e);
        }
    });

    watch(() => viewportEvents.recent.pointer.move, () => {
        const moves = viewportEvents.recent.pointer.move;
        const e = moves[moves.length - 1];
        if (!e) return;
        updateHover(e);
        if (!viewportEvents.isDragging(pointer.id) || viewportEvents.pinchIds) return;
        updatePixels('move');
        updateMarquee(e);
    });

    watch(() => viewportEvents.recent.pointer.up, () => {
        const e = viewportEvents.get('pointerup', pointer.id);
        if (!e || viewportEvents.isDragging(pointer.id) || viewportEvents.pinchIds) return;
        updatePixels('up');
        updateMarquee(e);
        pointer.event = e.type;
        if (e.type === 'pointercancel') {
            output.rollbackPending();
        } else {
            output.commit();
        }
        try { e.target?.releasePointerCapture?.(pointer.id); } catch {}
        pointer.status = 'idle';
        pointer.id = null;
        previewPixels.value = [];
        affectedPixels.value = [];
    });

    watch(() => viewportEvents.pinchIds, (ids) => {
        if (!ids || pointer.status === 'idle') return;
        updateMarquee(null);
        pointer.event = 'pinch';
        output.rollbackPending();
        const startEvent = viewportEvents.get('pointerdown', pointer.id);
        try { startEvent?.target?.releasePointerCapture?.(pointer.id); } catch {}
        pointer.status = 'idle';
        pointer.id = null;
        previewPixels.value = [];
        affectedPixels.value = [];
    });

    return {
        prepared,
        shape,
        pointer,
        marquee,
        previewPixels,
        affectedPixels,
        active,
        isDraw,
        isErase,
        isSelect,
        isGlobalErase,
        isCut,
        isStroke,
        isRect,
        setPrepared,
        setShape,
        setCursor,
        getCursor,
        getPixelsFromInteraction,
    };
});
