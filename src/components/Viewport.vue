<template>
  <div ref="viewportEl" class="relative flex-1 min-h-0 p-2 overflow-hidden touch-none"
       @wheel.prevent="viewportEvents.setWheel"
       @pointerdown="viewportEvents.setPointerDown"
       @pointermove="viewportEvents.setPointerMove"
       @pointerup="viewportEvents.setPointerUp"
       @pointercancel="viewportEvents.setPointerUp">
    <div id="stage" class="absolute shadow-inner select-none touch-none"
         :style="{
           width: stage.width+'px',
           height: stage.height+'px',
           cursor: stageToolService.cursor,
           transform: `translate(${stage.offset.x}px, ${stage.offset.y}px) scale(${stage.scale})`,
           transformOrigin: 'top left'
         }"
         @pointerleave="onStagePointerLeave"
         @contextmenu.prevent>
      <!-- 체커보드 -->
      <svg class="absolute w-full h-full top-0 left-0 pointer-events-none block" :viewBox="viewportStore.viewBox" preserveAspectRatio="xMidYMid meet">
        <rect x="0" y="0" :width="stage.width" :height="stage.height" :fill="patternUrl"/>
      </svg>
      <!-- 원본 -->
      <img v-show="viewportStore.display==='original'" class="absolute w-full h-full top-0 left-0 pointer-events-none block" :src="viewportStore.imageSrc" alt="source image" @load="onImageLoad" />
      <!-- 결과 레이어 -->
      <svg v-show="viewportStore.display==='result'" class="absolute w-full h-full top-0 left-0 pointer-events-none block" :viewBox="viewportStore.viewBox" preserveAspectRatio="xMidYMid meet">
        <g>
            <path v-for="props in layers.getProperties(layers.idsBottomToTop)" :key="'pix-'+props.id" :d="layers.pathOf(props.id)" fill-rule="evenodd" shape-rendering="crispEdges" :fill="rgbaCssU32(props.color)" :visibility="props.visible?'visible':'hidden'"></path>
        </g>
      </svg>
      <!-- 그리드 -->
      <svg class="absolute w-full h-full top-0 left-0 pointer-events-none block" :viewBox="viewportStore.viewBox" preserveAspectRatio="xMidYMid meet">
        <g :stroke="GRID_STROKE_COLOR" :stroke-width="1/Math.max(1,stage.scale)">
          <path v-for="x in (stage.width+1)" :key="'gx'+x" :d="'M '+(x-1)+' 0 V '+stage.height"></path>
          <path v-for="y in (stage.height+1)" :key="'gy'+y" :d="'M 0 '+(y-1)+' H '+stage.width"></path>
        </g>
      </svg>
      <!-- 오버레이 (선택, 추가, 제거, 마퀴) -->
      <svg class="absolute w-full h-full top-0 left-0 pointer-events-none block" :viewBox="viewportStore.viewBox" preserveAspectRatio="xMidYMid meet">
          <!-- Selection overlay (sky blue) -->
          <path id="selectionOverlay"
                v-if="layers.selectionExists"
                :d="overlay.selection.path"
                :fill="OVERLAY_CONFIG.SELECTED.FILL_COLOR"
                :stroke="OVERLAY_CONFIG.SELECTED.STROKE_COLOR"
                :stroke-width="OVERLAY_CONFIG.SELECTED.STROKE_WIDTH_SCALE / Math.max(1, stage.scale)"
                shape-rendering="crispEdges" />

          <!-- 2. 마퀴 사각형 (노란색) -->
          <rect id="marqueeRect"
                :x="marquee.x" :y="marquee.y"
                :width="marquee.w" :height="marquee.h"
                :visibility="marquee.visible ? 'visible' : 'hidden'"
                :fill="OVERLAY_CONFIG.MARQUEE.FILL_COLOR"
                :stroke="OVERLAY_CONFIG.MARQUEE.STROKE_COLOR"
                :stroke-width="OVERLAY_CONFIG.MARQUEE.STROKE_WIDTH_SCALE / Math.max(1, stage.scale)"
                shape-rendering="crispEdges" />

        <!-- Helper overlay -->
        <path v-if="stageToolService.isSelect || stageToolService.pointer.status === 'cut'"
              :d="helperOverlay.path"
              :fill="helperOverlay.FILL_COLOR"
              :stroke="helperOverlay.STROKE_COLOR"
              :stroke-width="helperOverlay.STROKE_WIDTH_SCALE / Math.max(1, stage.scale)"
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
const stage = viewportStore.stage;

const onStagePointerLeave = (e) => {
    if (e.pointerType === 'touch') return;
    overlay.helper.clear();
    overlay.helper.mode = 'add';
    viewportStore.updatePixelInfo('-');
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

let prevOffsetWidth = 0;
let prevOffsetHeight = 0;
let prevClientWidth = 0;
let prevClientHeight = 0;

const onElementResize = () => {
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
    viewportStore.setScale(stage.containScale);
    viewport.interpolatePosition(false);
};

const onImageLoad = () => {
    viewportStore.recalcScales();
    viewportStore.setScale(stage.containScale);
    viewport.interpolatePosition(false);
};

const resizeObserver = new ResizeObserver(onElementResize);
onMounted(() => {
    viewport.setElement(viewportEl.value);
    requestAnimationFrame(onElementResize);
    resizeObserver.observe(viewport.element);
});
onUnmounted(resizeObserver.disconnect);
</script>

<style scoped>
#stage img,
#stage svg {
  image-rendering: pixelated;
}
</style>
