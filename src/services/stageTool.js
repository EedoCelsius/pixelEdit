import { defineStore } from 'pinia';
import { ref, reactive, computed, watch } from 'vue';
import { useStore } from '../stores';
import { useOverlayService } from './overlay';
import { useSelectService } from './select';
import { usePixelService } from './pixel';
import { useViewportService } from './viewport';
import { calcMarquee, rgbaCssU32, rgbaCssObj, coordToKey, keyToCoord } from '../utils';
import { CURSOR_CONFIG } from '@/constants';

export const useStageToolService = defineStore('stageToolService', () => {
    const { viewport: viewportStore, layers, input, viewportEvent: viewportEvents, output } = useStore();
    const overlay = useOverlayService();
    const selectSvc = useSelectService();
    const pixelSvc = usePixelService();
    const viewport = useViewportService();

    const prepared = ref('draw');
    const shape = ref('stroke');
    const pointer = reactive({ status: 'idle', id: null });
    const marquee = reactive({ visible: false, x: 0, y: 0, w: 0, h: 0 });
    const previewPixelKeys = reactive(new Set());
    const affectedPixelKeys = reactive(new Set());

    const previewPixels = computed(() => Array.from(previewPixelKeys).map(keyToCoord));
    const affectedPixels = computed(() => Array.from(affectedPixelKeys).map(keyToCoord));

    const active = computed(() => {
        if (pointer.status !== 'idle') {
            const status = pointer.status;
            return (status === 'select' || status === 'add' || status === 'remove')
                ? 'select'
                : status;
        }
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
        if (!coord) {
            viewportStore.updatePixelInfo('-');
            overlay.helper.clear();
            overlay.helper.mode = 'add';
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
        if (pointer.status !== 'idle') {
            overlay.helper.mode = pointer.status === 'remove' ? 'remove' : 'add';
            return;
        }
        if (isSelect.value) {
            const id = layers.topVisibleIdAt(coord);
            overlay.helper.clear();
            overlay.helper.add(id);
            overlay.helper.mode = (id != null && viewportEvents.isPressed('Shift') && layers.isSelected(id)) ? 'remove' : 'add';
        } else {
            overlay.helper.clear();
            overlay.helper.mode = 'add';
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

    function syncPreview() {
        overlay.helper.clear();
        previewPixelKeys.forEach(k => overlay.helper.pixels.add(k));
    }

    function updatePreview(type) {
        const pixels = getPixelsFromInteraction(type);
        if (shape.value === 'rect') previewPixelKeys.clear();
        for (const coord of pixels) previewPixelKeys.add(coordToKey(coord));
        if (pointer.status !== 'idle') syncPreview();
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

    const cursor = computed(() => {
        const tool = active.value;
        const toolShape = shape.value;
        const mode = pointer.status === 'idle'
            ? overlay.helper.mode
            : (pointer.status === 'remove' ? 'remove' : 'add');

        if (tool === 'select') {
            if (toolShape === 'stroke') {
                return mode === 'remove' ? CURSOR_CONFIG.REMOVE_STROKE : CURSOR_CONFIG.ADD_STROKE;
            }
            if (toolShape === 'rect') {
                return mode === 'remove' ? CURSOR_CONFIG.REMOVE_RECT : CURSOR_CONFIG.ADD_RECT;
            }
        }
        if (tool === 'draw' && toolShape === 'stroke') return CURSOR_CONFIG.DRAW_STROKE;
        if (tool === 'draw' && toolShape === 'rect') return CURSOR_CONFIG.DRAW_RECT;
        if (tool === 'erase' && toolShape === 'stroke') return CURSOR_CONFIG.ERASE_STROKE;
        if (tool === 'erase' && toolShape === 'rect') return CURSOR_CONFIG.ERASE_RECT;
        if (tool === 'globalErase' && toolShape === 'stroke') return CURSOR_CONFIG.GLOBAL_ERASE_STROKE;
        if (tool === 'globalErase' && toolShape === 'rect') return CURSOR_CONFIG.GLOBAL_ERASE_RECT;
        if (tool === 'cut' && toolShape === 'stroke') return CURSOR_CONFIG.CUT_STROKE;
        if (tool === 'cut' && toolShape === 'rect') return CURSOR_CONFIG.CUT_RECT;
        return 'default';
    });

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

            previewPixelKeys.clear();
            affectedPixelKeys.clear();
            updatePreview('down');

            if (isSelect.value) {
                const startId = layers.topVisibleIdAt(coord);
                const mode = !viewportEvents.isPressed('Shift')
                    ? 'select'
                    : layers.isSelected(startId)
                        ? 'remove'
                        : 'add';
                pointer.status = mode;
                overlay.helper.mode = mode === 'remove' ? 'remove' : 'add';
                selectSvc.tools.select.start(coord, startId);
            } else {
                pointer.status = active.value;
                pixelSvc.tools[active.value].start();
            }
            updateMarquee(e);
        }
    });

    watch(() => viewportEvents.recent.pointer.move, () => {
        const e = viewportEvents.get('pointermove', pointer.id);
        if (!e || !viewportEvents.isDragging(pointer.id) || viewportEvents.pinchIds) return;
        updateHover(e);
        updateMarquee(e);
        updatePreview('move');
        if (isSelect.value) selectSvc.tools.select.move();
        else pixelSvc.tools[active.value].move();
    });

    watch(() => viewportEvents.recent.pointer.up, () => {
        const e = viewportEvents.get('pointerup', pointer.id);
        if (!e || viewportEvents.isDragging(pointer.id) || viewportEvents.pinchIds) return;
        updateMarquee(e);
        updatePreview('up');
        affectedPixelKeys.clear();
        previewPixelKeys.forEach(k => affectedPixelKeys.add(k));
        if (e.type === 'pointercancel') {
            if (isSelect.value) selectSvc.cancel();
            else pixelSvc.cancel();
            output.rollbackPending();
        } else {
            if (isSelect.value) selectSvc.tools.select.finish();
            else pixelSvc.tools[active.value].finish();
            output.commit();
        }
        try { e.target?.releasePointerCapture?.(pointer.id); } catch {}
        pointer.status = 'idle';
        pointer.id = null;
        previewPixelKeys.clear();
        affectedPixelKeys.clear();
        overlay.helper.clear();
        overlay.helper.mode = 'add';
    });

    watch(() => viewportEvents.pinchIds, (ids) => {
        if (!ids || pointer.status === 'idle') return;
        updateMarquee(null);
        if (isSelect.value) selectSvc.cancel();
        else pixelSvc.cancel();
        output.rollbackPending();
        const startEvent = viewportEvents.get('pointerdown', pointer.id);
        try { startEvent?.target?.releasePointerCapture?.(pointer.id); } catch {}
        pointer.status = 'idle';
        pointer.id = null;
        previewPixelKeys.clear();
        affectedPixelKeys.clear();
        overlay.helper.clear();
        overlay.helper.mode = 'add';
    });

    return {
        prepared,
        shape,
        pointer,
        marquee,
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
        cursor,
        getPixelsFromInteraction,
        previewPixels,
        affectedPixels,
    };
});
