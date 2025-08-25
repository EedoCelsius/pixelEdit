<template>
  <div ref="viewportEl" class="relative flex-1 min-h-0 p-2 overflow-hidden touch-none"
       @wheel.prevent="onWheel"
       @pointerdown="onViewportPointerDown"
       @pointermove="onViewportPointerMove"
       @pointerup="onViewportPointerUp"
       @pointercancel="onViewportPointerCancel">
    <div id="stage" ref="stageEl" class="absolute rounded-lg shadow-inner ring-1 ring-white/10 select-none touch-none"
         :style="{
           width: stageStore.pixelWidth+'px',
           height: stageStore.pixelHeight+'px',
           cursor: stageService.cursor,
           transform: `translate(${offset.x}px, ${offset.y}px)`
         }"
         @pointerdown="onPointerDown"
         @pointermove="onPointerMove"
         @pointerleave="onPointerLeave"
         @pointerup="onPointerUp"
         @pointercancel="onPointerCancel"
         @contextmenu.prevent>
      <!-- 체커보드 -->
      <svg class="absolute top-0 left-0 pointer-events-none block rounded-lg" :viewBox="stageStore.viewBox" preserveAspectRatio="xMidYMid meet" :style="{ width: stageStore.pixelWidth+'px', height: stageStore.pixelHeight+'px' }" style="image-rendering:pixelated">
        <rect x="0" y="0" :width="stageStore.canvas.width" :height="stageStore.canvas.height" :fill="patternUrl"/>
      </svg>
      <!-- 원본 -->
      <img v-show="stageStore.display==='original'" class="absolute top-0 left-0 pointer-events-none block rounded-lg" :src="stageStore.imageSrc" :style="{ width: stageStore.pixelWidth+'px', height: stageStore.pixelHeight+'px' }" alt="source image" style="image-rendering:pixelated" @load="onImageLoad" />
      <!-- 결과 레이어 -->
      <svg v-show="stageStore.display==='result'" class="absolute top-0 left-0 pointer-events-none block rounded-lg" :viewBox="stageStore.viewBox" preserveAspectRatio="xMidYMid meet" :style="{ width: stageStore.pixelWidth+'px', height: stageStore.pixelHeight+'px' }" style="image-rendering:pixelated">
        <g>
            <path v-for="props in layers.getProperties(layers.idsBottomToTop)" :key="'pix-'+props.id" :d="layers.pathOf(props.id)" fill-rule="evenodd" shape-rendering="crispEdges" :fill="rgbaCssU32(props.color)" :visibility="props.visible?'visible':'hidden'"></path>
        </g>
      </svg>
      <!-- 그리드 -->
      <svg class="absolute top-0 left-0 pointer-events-none block rounded-lg" :viewBox="stageStore.viewBox" preserveAspectRatio="xMidYMid meet" :style="{ width: stageStore.pixelWidth+'px', height: stageStore.pixelHeight+'px' }" style="image-rendering:pixelated">
        <g :stroke="GRID_STROKE_COLOR" :stroke-width="1/Math.max(1,stageStore.canvas.scale)">
          <path v-for="x in (stageStore.canvas.width+1)" :key="'gx'+x" :d="'M '+(x-1)+' 0 V '+stageStore.canvas.height"></path>
          <path v-for="y in (stageStore.canvas.height+1)" :key="'gy'+y" :d="'M 0 '+(y-1)+' H '+stageStore.canvas.width"></path>
        </g>
      </svg>
      <!-- 오버레이 (선택, 추가, 제거, 마퀴) -->
      <svg class="absolute top-0 left-0 pointer-events-none block rounded-lg" :viewBox="stageStore.viewBox" preserveAspectRatio="xMidYMid meet" :style="{ width: stageStore.pixelWidth+'px', height: stageStore.pixelHeight+'px' }" style="image-rendering:pixelated">
          <!-- 1. 기본 선택 윤곽 (하늘색) -->
          <path id="selectionOutline"
                v-if="layers.selectionExists"
                :d="selectionPath"
                :fill="OVERLAY_CONFIG.SELECTED.FILL_COLOR"
                :stroke="OVERLAY_CONFIG.SELECTED.STROKE_COLOR"
                :stroke-width="OVERLAY_CONFIG.SELECTED.STROKE_WIDTH_SCALE / Math.max(1, stageStore.canvas.scale)"
                shape-rendering="crispEdges" />

          <!-- 2. 마퀴 사각형 (노란색) -->
          <rect id="marqueeRect"
                :x="marquee.x" :y="marquee.y"
                :width="marquee.w" :height="marquee.h"
                :visibility="marquee.visible ? 'visible' : 'hidden'"
                :fill="OVERLAY_CONFIG.MARQUEE.FILL_COLOR"
                :stroke="OVERLAY_CONFIG.MARQUEE.STROKE_COLOR"
                :stroke-width="OVERLAY_CONFIG.MARQUEE.STROKE_WIDTH_SCALE / Math.max(1, stageStore.canvas.scale)"
                shape-rendering="crispEdges" />

        <!-- 3. 선택/호버 오버레이 -->
        <path v-if="toolStore.isSelect || toolStore.pointer.status === 'cut'"
              :d="helperOverlay.path"
              :fill="helperOverlay.FILL_COLOR"
              :stroke="helperOverlay.STROKE_COLOR"
              :stroke-width="helperOverlay.STROKE_WIDTH_SCALE / Math.max(1, stageStore.canvas.scale)"
              fill-rule="evenodd"
              shape-rendering="crispEdges" />
      </svg>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, watch } from 'vue';
import { useStore } from '../stores';
import { useService } from '../services';
import { rgbaCssU32, rgbaCssObj, calcMarquee } from '../utils';
import { OVERLAY_CONFIG, GRID_STROKE_COLOR } from '@/constants';

const { stage: stageStore, tool: toolStore, layers, input, stageEvent: stageEvents } = useStore();
const { stage: stageService, overlay, layers: layerSvc, select: selectSvc, pixel: pixelSvc, viewport } = useService();
const viewportEl = ref(null);
const stageEl = ref(null);
const marquee = reactive({ visible: false, x: 0, y: 0, w: 0, h: 0 });
const offset = viewport.offset;

    const updateHover = (event) => {
        const pixel = stageService.clientToPixel(event);
        if (!pixel) {
            stageStore.updatePixelInfo('-');
            overlay.clearHover();
            return;
        }
        if (stageStore.display === 'original' && input.isLoaded) {
            const colorObject = input.readPixel(pixel.x, pixel.y);
            stageStore.updatePixelInfo(`[${pixel.x},${pixel.y}] ${rgbaCssObj(colorObject)}`);
        } else {
            const colorU32 = layers.compositeColorAt(pixel.x, pixel.y);
            stageStore.updatePixelInfo(`[${pixel.x},${pixel.y}] ${rgbaCssU32(colorU32)}`);
        }
        if (toolStore.isSelect) {
            overlay.setHover(layers.topVisibleIdAt(pixel.x, pixel.y));
        } else {
            overlay.clearHover();
        }
    };

const updateMarquee = (e) => {
    if (toolStore.shape !== 'rect' || toolStore.pointer.status === 'idle' || !toolStore.pointer.start || !e) {
        Object.assign(marquee, { visible: false, x: 0, y: 0, w: 0, h: 0 });
        return;
    }
    Object.assign(marquee, calcMarquee(toolStore.pointer.start, { x: e.clientX, y: e.clientY }, stageStore.canvas));
};
  
const onViewportPointerDown = viewport.onViewportPointerDown;
const onViewportPointerMove = viewport.onViewportPointerMove;
const onViewportPointerUp = viewport.onViewportPointerUp;
const onViewportPointerCancel = viewport.onViewportPointerCancel;

const onPointerDown = (e) => {
  stageEvents.addPointerDown(e);
};

const onPointerMove = (e) => {
  stageEvents.setPointerMove(e);
};

const onPointerUp = (e) => {
  stageEvents.setPointerUp(e);
};

const onPointerCancel = (e) => {
  stageEvents.setPointerUp(e);
};

    const onPointerLeave = (e) => {
        if (e.pointerType === 'touch') return;
        overlay.clearHover();
        stageStore.updatePixelInfo('-');
    };

const onWheel = (e) => {
  stageEvents.setWheel(e);
};

watch(() => stageEvents.lastPointerDown, (e) => {
  if (!e || e.pointerType === 'touch') return;
  updateMarquee(e);
  if (toolStore.isSelect) selectSvc.toolStart(e);
  else pixelSvc.toolStart(e);
});

watch(() => stageEvents.pointer.move, (e) => {
  if (!e || e.pointerType === 'touch') return;
  updateHover(e);
  updateMarquee(e);
  if (toolStore.isSelect) selectSvc.toolMove(e);
  else pixelSvc.toolMove(e);
});

watch(() => stageEvents.pointer.up, (e) => {
  if (!e || e.pointerType === 'touch') return;
  updateMarquee(e);
  if (e.type === 'pointercancel') {
    if (toolStore.isSelect) selectSvc.cancel(e);
    else pixelSvc.cancel(e);
  } else {
    if (toolStore.isSelect) selectSvc.toolFinish(e);
    else pixelSvc.toolFinish(e);
  }
});

watch(() => stageEvents.wheel, (e) => {
  if (!e) return;
  viewport.onWheel(e);
});

const selectionPath = computed(() => layerSvc.selectionPath());
const helperOverlay = computed(() => {
    let path;
    let style;

    if (toolStore.pointer.status !== 'idle') {
        path = overlay.selectOverlayPath;
        style = toolStore.pointer.status === 'remove'
            ? OVERLAY_CONFIG.REMOVE
            : OVERLAY_CONFIG.ADD;
    } else {
        path = overlay.hoverOverlayPath;
        if (overlay.hoverLayerId) {
            const isRemoving = toolStore.shiftHeld && layers.isSelected(overlay.hoverLayerId);
            style = isRemoving ? OVERLAY_CONFIG.REMOVE : OVERLAY_CONFIG.ADD;
        }
    }

    return {
        path,
        FILL_COLOR: style?.FILL_COLOR,
        STROKE_COLOR: style?.STROKE_COLOR,
        STROKE_WIDTH_SCALE: style?.STROKE_WIDTH_SCALE,
    };
});

const patternUrl = computed(() => `url(#${stageService.ensureCheckerboardPattern(document.body)})`);

const positionStage = (center = false) => viewport.positionStage(center);
const updateCanvasPosition = () => viewport.updateCanvasPosition();

let prevOffsetWidth = 0;
let prevOffsetHeight = 0;
let prevClientWidth = 0;
let prevClientHeight = 0;

const onDomResize = () => {
    const el = viewport.element;
    const { offsetWidth, offsetHeight, clientWidth, clientHeight } = el;
    const sizeChanged = offsetWidth !== prevOffsetWidth || offsetHeight !== prevOffsetHeight;
    const scrollChanged = !sizeChanged && (clientWidth !== prevClientWidth || clientHeight !== prevClientHeight);
    prevOffsetWidth = offsetWidth;
    prevOffsetHeight = offsetHeight;
    prevClientWidth = clientWidth;
    prevClientHeight = clientHeight;
    if (scrollChanged) return;
    stageService.recalcMinScale(el);
    stageStore.setScale(stageStore.canvas.containScale);
    positionStage(true);
    updateCanvasPosition();
};

const onImageLoad = () => {
    stageService.recalcMinScale(viewport.element);
    stageStore.setScale(stageStore.canvas.containScale);
    positionStage(true);
    updateCanvasPosition();
};

const resizeObserver = new ResizeObserver(onDomResize);
onMounted(() => {
    viewport.setElement(viewportEl.value);
    stageService.setElement(stageEl.value);
    requestAnimationFrame(onDomResize);
    resizeObserver.observe(viewport.element);
});
onUnmounted(resizeObserver.disconnect);
</script>