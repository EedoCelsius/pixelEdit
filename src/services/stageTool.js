import { defineStore } from 'pinia';
import { ref, reactive, computed, watch } from 'vue';
import { useStore } from '../stores';
import { useOverlayService } from './overlay';
import { useSelectService } from './select';
import { usePixelService } from './pixel';
import { useStageService } from './stage';
import { useViewportService } from './viewport';
import { calcMarquee, rgbaCssU32, rgbaCssObj } from '../utils';
import { CURSOR_CONFIG } from '@/constants';

export const useStageToolService = defineStore('stageToolService', () => {
    const { stage: stageStore, layers, input, stageEvent: stageEvents, output } = useStore();
    const overlay = useOverlayService();
    const selectSvc = useSelectService();
    const pixelSvc = usePixelService();
    const stageSvc = useStageService();
    const viewport = useViewportService();

    const prepared = ref('draw');
    const shape = ref('stroke');
    const pointer = reactive({ status: 'idle', id: null });
    const marquee = reactive({ visible: false, x: 0, y: 0, w: 0, h: 0 });

    const active = computed(() => {
        if (pointer.status !== 'idle') {
            const status = pointer.status;
            return (status === 'select' || status === 'add' || status === 'remove')
                ? 'select'
                : status;
        }
        let tool = prepared.value;
        if (stageEvents.shiftHeld) {
            tool = 'select';
        } else if (stageEvents.ctrlHeld) {
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

    function begin(event, status) {
        if (event.button !== 0) return null;
        const coord = stageSvc.clientToCoord(event);
        if (!coord) return null;

        output.setRollbackPoint();

        pointer.status = status;
        try {
            event.target.setPointerCapture?.(event.pointerId);
            pointer.id = event.pointerId;
        } catch {}

        return coord;
    }

    const updateHover = (event) => {
        const coord = stageSvc.clientToCoord(event);
        if (!coord) {
            stageStore.updatePixelInfo('-');
            overlay.helper.clear();
            overlay.helper.mode = 'add';
            return;
        }
        const [px, py] = coord;
        if (stageStore.display === 'original' && input.isLoaded) {
            const colorObject = input.readPixel(coord);
            stageStore.updatePixelInfo(`[${px},${py}] ${rgbaCssObj(colorObject)}`);
        } else {
            const colorU32 = layers.compositeColorAt(coord);
            stageStore.updatePixelInfo(`[${px},${py}] ${rgbaCssU32(colorU32)}`);
        }
        if (pointer.status !== 'idle') {
            overlay.helper.mode = pointer.status === 'remove' ? 'remove' : 'add';
            return;
        }
        if (isSelect.value) {
            const id = layers.topVisibleIdAt(coord);
            overlay.helper.clear();
            overlay.helper.add(id);
            overlay.helper.mode = (id != null && stageEvents.shiftHeld && layers.isSelected(id)) ? 'remove' : 'add';
        } else {
            overlay.helper.clear();
            overlay.helper.mode = 'add';
        }
    };

    const updateMarquee = (e) => {
        if (shape.value !== 'rect' || pointer.status === 'idle' || !stageEvents.pointer.start || !e) {
            Object.assign(marquee, { visible: false, x: 0, y: 0, w: 0, h: 0 });
            return;
        }
        Object.assign(marquee, calcMarquee(stageEvents.pointer.start, { x: e.clientX, y: e.clientY }, stageStore.canvas));
    };

    function getPixelsFromInteraction(event) {
        const pixels = [];
        if (shape.value === 'rect') {
            const { visible, x, y, w, h } = calcMarquee(stageEvents.pointer.start, { x: event.clientX, y: event.clientY }, stageStore.canvas);
            if (!visible || w === 0 || h === 0) {
                const coord = stageSvc.clientToCoord(event);
                if (coord) pixels.push(coord);
            } else {
                for (let yy = y; yy < y + h; yy++)
                    for (let xx = x; xx < x + w; xx++) pixels.push([xx, yy]);
            }
        } else {
            const coord = stageSvc.clientToCoord(event);
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

    watch(() => stageEvents.lastPointerDown, (e) => {
        if (!e || e.pointerType === 'touch') return;
        updateMarquee(e);
        if (isSelect.value) selectSvc.tools.select.start(e);
        else pixelSvc.tools[active.value].start(e);
    });

    watch(() => stageEvents.pointer.move, (e) => {
        if (!e || e.pointerType === 'touch') return;
        updateHover(e);
        updateMarquee(e);
        if (isSelect.value) selectSvc.tools.select.move(e);
        else pixelSvc.tools[active.value].move(e);
    });

    watch(() => stageEvents.pointer.up, (e) => {
        if (!e || e.pointerType === 'touch') return;
        updateMarquee(e);
        if (e.type === 'pointercancel') {
            if (isSelect.value) selectSvc.cancel(e);
            else pixelSvc.cancel(e);
        } else {
            if (isSelect.value) selectSvc.tools.select.finish(e);
            else pixelSvc.tools[active.value].finish(e);
        }
    });

    watch(() => stageEvents.wheel, (e) => {
        if (!e) return;
        viewport.onWheel(e);
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
        begin,
    };
});
