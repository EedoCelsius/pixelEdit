import { defineStore } from 'pinia';
import { ref, reactive, computed, watch } from 'vue';
import { useStore } from '../stores';
import { useOverlayService } from './overlay';
import { rgbaCssU32, rgbaCssObj } from '../utils';
import { TOOL_MODIFIERS, OVERLAY_CONFIG } from '@/constants';

export const useToolSelectionService = defineStore('toolSelectionService', () => {
    const { viewport: viewportStore, layers, input, viewportEvent: viewportEvents, output } = useStore();
    const overlay = useOverlayService();

    const prepared = ref('draw');
    const shape = ref('stroke');
    const pointer = reactive({ status: 'idle', id: null });
    const marquee = reactive({ visible: false, x: 0, y: 0, w: 0, h: 0 });
    const cursor = reactive({ stroke: 'default', rect: 'default' });
    const previewPixels = ref([]);
    const affectedPixels = ref([]);

    const active = computed(() => {
        if (pointer.status !== 'idle') return pointer.status;
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
        let props
        if (shape.value !== 'rect' || pointer.status === 'idle' || !viewportEvents.isDragging(pointer.id)) {
            props = { visible: false, x: 0, y: 0, w: 0, h: 0 };
        }
        else {
            const startEvent = viewportEvents.get('pointerdown', pointer.id);
            const startCoord = viewportStore.clientToCoord(startEvent);
            const currentCoord = viewportStore.clientToCoord(currentEvent);
            const minX = Math.min(startCoord.x, currentCoord.x);
            const maxX = Math.max(startCoord.x, currentCoord.x);
            const minY = Math.min(startCoord.y, currentCoord.y);
            const maxY = Math.max(startCoord.y, currentCoord.y);
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

    watch(() => viewportEvents.recent.pointer.down, (downs) => {
        for (const e of downs) {
            if (e.button !== 0 || viewportEvents.pinchIds) continue;
            updateMarquee(e);

            output.setRollbackPoint();
            try { e.target.setPointerCapture?.(e.pointerId); } catch {}

            pointer.status = active.value;
            pointer.id = e.pointerId;
        }
    });

    watch(() => viewportEvents.recent.pointer.move, (moves) => {
        for (const e of moves) {
            if (viewportEvents.pinchIds) continue;
            if (e.buttons !== 1) {
                const pixel = viewportStore.clientToCoord(e);
                if (pixel) previewPixels.value = [pixel];
                else previewPixels.value = [];
                continue;
            }
            updateMarquee(e);
            
            if (shape.value === 'rect') {
                previewPixels.value = getPixelsInsideMarquee();
            }
            else if (shape.value === 'stroke') {
                const pixel = viewportStore.clientToCoord(e);
                if (!pixel) continue;
                if (!previewPixels.value.find(p => p[0] === pixel[0] && p[1] === pixel[1])) previewPixels.value = [...previewPixels.value, pixel];
            }
        }
    });

    watch(() => viewportEvents.recent.pointer.up, (ups) => {
        for (const e of ups) {
            if (e.button !== 0 || viewportEvents.pinchIds) continue;
            updateMarquee(e);
            
            affectedPixels.value = previewPixels.value;
            previewPixels.value = [];

            output.commit();
            try { e.target.releasePointerCapture?.(pointer.id); } catch {}

            pointer.status = 'idle';
            pointer.id = null;
        }
    });

    watch(() => [ viewportEvents.pinchIds, viewportEvents.recent.pointer.cancel ], ([pinches, cancels]) => {
        if (!pinches.includes(pointer.id) || !cancels.includes(pointer.id)) return;
        output.rollbackPending();
        const startEvent = viewportEvents.get('pointerdown', pointer.id);
        try { startEvent?.target?.releasePointerCapture?.(pointer.id); } catch {}
        pointer.status = 'idle';
        pointer.id = null;
        updateMarquee();
        previewPixels.value = [];
        affectedPixels.value = [];
        overlay.helper.clear();
        overlay.helper.config = OVERLAY_CONFIG.ADD;
    });

    return {
        prepared,
        shape,
        pointer,
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
