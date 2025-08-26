<template>
  <div ref="viewportEl" class="relative flex-1 min-h-0 p-2 overflow-hidden touch-none"
       @wheel.prevent="onWheel"
       @pointerdown="onViewportPointerDown"
       @pointermove="onViewportPointerMove"
       @pointerup="onViewportPointerUp"
       @pointercancel="onViewportPointerCancel">
    <div id="stage" class="absolute rounded-lg shadow-inner ring-1 ring-white/10 select-none touch-none"
         :style="{
           width: viewportStore.stage.width+'px',
           height: viewportStore.stage.height+'px',
           cursor: stageToolService.cursor,
           transform: `translate(${offset.x}px, ${offset.y}px) scale(${viewportStore.stage.scale})`,
           transformOrigin: 'top left'
         }"
         @pointerdown="onPointerDown"
         @pointermove="onPointerMove"
         @pointerleave="onPointerLeave"
         @pointerup="onPointerUp"
         @pointercancel="onPointerCancel"
         @contextmenu.prevent>
      <!-- 체커보드 -->
      <svg class="absolute top-0 left-0 pointer-events-none block rounded-lg" :viewBox="viewportStore.viewBox" preserveAspectRatio="xMidYMid meet" :style="{ width: '100%', height: '100%' }" style="image-rendering:pixelated">
        <rect x="0" y="0" :width="viewportStore.stage.width" :height="viewportStore.stage.height" :fill="patternUrl"/>
      </svg>
      <!-- 원본 -->
      <img v-show="viewportStore.display==='original'" class="absolute top-0 left-0 pointer-events-none block rounded-lg" :src="viewportStore.imageSrc" :style="{ width: '100%', height: '100%' }" alt="source image" style="image-rendering:pixelated" @load="onImageLoad" />
      <!-- 결과 레이어 -->
      <svg v-show="viewportStore.display==='result'" class="absolute top-0 left-0 pointer-events-none block rounded-lg" :viewBox="viewportStore.viewBox" preserveAspectRatio="xMidYMid meet" :style="{ width: '100%', height: '100%' }" style="image-rendering:pixelated">
        <g>
            <path v-for="props in layers.getProperties(layers.idsBottomToTop)" :key="'pix-'+props.id" :d="layers.pathOf(props.id)" fill-rule="evenodd" shape-rendering="crispEdges" :fill="rgbaCssU32(props.color)" :visibility="props.visible?'visible':'hidden'"></path>
        </g>
      </svg>
      <!-- 그리드 -->
      <svg class="absolute top-0 left-0 pointer-events-none block rounded-lg" :viewBox="viewportStore.viewBox" preserveAspectRatio="xMidYMid meet" :style="{ width: '100%', height: '100%' }" style="image-rendering:pixelated">
        <g :stroke="GRID_STROKE_COLOR" :stroke-width="1/Math.max(1,viewportStore.stage.scale)">
          <path v-for="x in (viewportStore.stage.width+1)" :key="'gx'+x" :d="'M '+(x-1)+' 0 V '+viewportStore.stage.height"></path>
          <path v-for="y in (viewportStore.stage.height+1)" :key="'gy'+y" :d="'M 0 '+(y-1)+' H '+viewportStore.stage.width"></path>
        </g>
      </svg>
      <!-- 오버레이 (선택, 추가, 제거, 마퀴) -->
      <svg class="absolute top-0 left-0 pointer-events-none block rounded-lg" :viewBox="viewportStore.viewBox" preserveAspectRatio="xMidYMid meet" :style="{ width: '100%', height: '100%' }" style="image-rendering:pixelated">
          <!-- Selection overlay (sky blue) -->
          <path id="selectionOverlay"
                v-if="layers.selectionExists"
                :d="overlay.selection.path"
                :fill="OVERLAY_CONFIG.SELECTED.FILL_COLOR"
                :stroke="OVERLAY_CONFIG.SELECTED.STROKE_COLOR"
                :stroke-width="OVERLAY_CONFIG.SELECTED.STROKE_WIDTH_SCALE / Math.max(1, viewportStore.stage.scale)"
                shape-rendering="crispEdges" />

          <!-- 2. 마퀴 사각형 (노란색) -->
          <rect id="marqueeRect"
                :x="marquee.x" :y="marquee.y"
                :width="marquee.w" :height="marquee.h"
                :visibility="marquee.visible ? 'visible' : 'hidden'"
                :fill="OVERLAY_CONFIG.MARQUEE.FILL_COLOR"
                :stroke="OVERLAY_CONFIG.MARQUEE.STROKE_COLOR"
                :stroke-width="OVERLAY_CONFIG.MARQUEE.STROKE_WIDTH_SCALE / Math.max(1, viewportStore.stage.scale)"
                shape-rendering="crispEdges" />

        <!-- Helper overlay -->
        <path v-if="stageToolService.isSelect || stageToolService.pointer.status === 'cut'"
              :d="helperOverlay.path"
              :fill="helperOverlay.FILL_COLOR"
              :stroke="helperOverlay.STROKE_COLOR"
              :stroke-width="helperOverlay.STROKE_WIDTH_SCALE / Math.max(1, viewportStore.stage.scale)"
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
import { rgbaCssU32, ensureCheckerboardPattern } from '../utils';

const { viewport: viewportStore, layers, viewportEvent: viewportEvents } = useStore();
const { overlay, stageTool: stageToolService, viewport } = useService();
const viewportEl = ref(null);
const marquee = stageToolService.marquee;
const offset = viewportStore.stage.offset;

const onViewportPointerDown = (e) => {
  if (e.pointerType === 'touch') e.preventDefault();
  viewportEvents.setPointerDown(e);
};

const onViewportPointerMove = (e) => {
  viewportEvents.setPointerMove(e);
};

const onViewportPointerUp = (e) => {
  viewportEvents.setPointerUp(e);
};

const onViewportPointerCancel = (e) => {
  viewportEvents.setPointerUp(e);
};

const onPointerDown = (e) => {
  viewportEvents.setPointerDown(e);
};

const onPointerMove = (e) => {
  viewportEvents.setPointerMove(e);
};

const onPointerUp = (e) => {
  viewportEvents.setPointerUp(e);
};

const onPointerCancel = (e) => {
  viewportEvents.setPointerUp(e);
};

    const onPointerLeave = (e) => {
        if (e.pointerType === 'touch') return;
        overlay.helper.clear();
        overlay.helper.mode = 'add';
        viewportStore.updatePixelInfo('-');
    };

const onWheel = (e) => {
  viewportEvents.setWheel(e);
};

const helperOverlay = computed(() => {
    const path = overlay.helper.path;
    if (!path) return { path }; // no style when empty

    const mode = stageToolService.pointer.status === 'remove'
        ? 'remove'
        : stageToolService.pointer.status === 'idle'
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

const patternUrl = computed(() => `url(#${ensureCheckerboardPattern(document.body)})`);

const posSoftInterpolation = (center = false) => viewport.posSoftInterpolation(center);

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
    viewportStore.recalcScales();
    viewportStore.setScale(viewportStore.stage.containScale);
    posSoftInterpolation(true);
};

const onImageLoad = () => {
    viewportStore.recalcScales();
    viewportStore.setScale(viewportStore.stage.containScale);
    posSoftInterpolation(true);
};

const resizeObserver = new ResizeObserver(onDomResize);
onMounted(() => {
    viewport.setElement(viewportEl.value);
    requestAnimationFrame(onDomResize);
    resizeObserver.observe(viewport.element);
});
onUnmounted(resizeObserver.disconnect);
</script>