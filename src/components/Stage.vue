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
           cursor: toolService.cursor,
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
          <!-- Selection overlay (sky blue) -->
          <path id="selectionOverlay"
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

        <!-- Helper overlay -->
        <path v-if="toolService.isSelect || toolService.pointer.status === 'cut'"
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
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useStore } from '../stores';
import { useService } from '../services';
import { OVERLAY_CONFIG, GRID_STROKE_COLOR } from '@/constants';
import { rgbaCssU32 } from '../utils';

const { stage: stageStore, layers, stageEvent: stageEvents } = useStore();
const { stage: stageService, overlay, tool: toolService, viewport } = useService();
const viewportEl = ref(null);
const stageEl = ref(null);
const marquee = toolService.marquee;
const offset = viewport.offset;

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
        overlay.helper.clear();
        overlay.helper.mode = 'add';
        stageStore.updatePixelInfo('-');
    };

const onWheel = (e) => {
  stageEvents.setWheel(e);
};

const selectionPath = computed(() => overlay.selection.path);
const helperOverlay = computed(() => {
    const path = overlay.helper.path;
    if (!path) return { path }; // no style when empty

    const mode = toolService.pointer.status === 'remove'
        ? 'remove'
        : toolService.pointer.status === 'idle'
            ? overlay.helper.mode
            : 'add';
    const style = mode === 'remove' ? OVERLAY_CONFIG.REMOVE : OVERLAY_CONFIG.ADD;

    return {
        path,
        FILL_COLOR: style.FILL_COLOR,
        STROKE_COLOR: style.STROKE_COLOR,
        STROKE_WIDTH_SCALE: style.STROKE_WIDTH_SCALE,
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