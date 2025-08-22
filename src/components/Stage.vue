<template>
  <div ref="containerEl" class="relative flex-1 min-h-0 p-2 flex items-center justify-center">
    <div id="stage" ref="stageEl" class="relative rounded-lg shadow-inner ring-1 ring-white/10" :style="{ width: stageStore.pixelWidth+'px', height: stageStore.pixelHeight+'px', cursor: stageService.cursor }"
         @pointerdown="onPointerDown" @pointermove="onPointerMove" @pointerup="onPointerUp" @pointercancel="onPointerCancel" @contextmenu.prevent>
      <!-- 체커보드 -->
      <svg class="absolute top-0 left-0 pointer-events-none block rounded-lg" :viewBox="stageStore.viewBox" preserveAspectRatio="xMidYMid meet" :style="{ width: stageStore.pixelWidth+'px', height: stageStore.pixelHeight+'px' }" style="image-rendering:pixelated">
        <rect x="0" y="0" :width="stageStore.canvas.width" :height="stageStore.canvas.height" :fill="patternUrl"/>
      </svg>
      <!-- 원본 -->
      <img v-show="stageStore.display==='original'" class="absolute top-0 left-0 pointer-events-none block rounded-lg" :src="stageStore.imageSrc" :style="{ width: stageStore.pixelWidth+'px', height: stageStore.pixelHeight+'px' }" alt="source image" style="image-rendering:pixelated" />
      <!-- 결과 레이어 -->
      <svg v-show="stageStore.display==='result'" class="absolute top-0 left-0 pointer-events-none block rounded-lg" :viewBox="stageStore.viewBox" preserveAspectRatio="xMidYMid meet" :style="{ width: stageStore.pixelWidth+'px', height: stageStore.pixelHeight+'px' }" style="image-rendering:pixelated">
        <g>
          <path v-for="id in layerSvc.idsBottomToTop" :key="'pix-'+id" :d="layerSvc.pathOf(id)" fill-rule="evenodd" shape-rendering="crispEdges" :fill="rgbaCssU32(layerSvc.colorOf(id))" :visibility="layerSvc.visibleOf(id)?'visible':'hidden'"></path>
        </g>
      </svg>
      <!-- 그리드 -->
      <svg class="absolute top-0 left-0 pointer-events-none block rounded-lg" :viewBox="stageStore.viewBox" preserveAspectRatio="xMidYMid meet" :style="{ width: stageStore.pixelWidth+'px', height: stageStore.pixelHeight+'px' }" style="image-rendering:pixelated">
        <g :stroke="'rgba(0,0,0,.18)'" :stroke-width="1/Math.max(1,stageStore.canvas.scale)">
          <path v-for="x in (stageStore.canvas.width+1)" :key="'gx'+x" :d="'M '+(x-1)+' 0 V '+stageStore.canvas.height"></path>
          <path v-for="y in (stageStore.canvas.height+1)" :key="'gy'+y" :d="'M 0 '+(y-1)+' H '+stageStore.canvas.width"></path>
        </g>
      </svg>
      <!-- 오버레이 (선택, 추가, 제거, 마퀴) -->
      <svg class="absolute top-0 left-0 pointer-events-none block rounded-lg" :viewBox="stageStore.viewBox" preserveAspectRatio="xMidYMid meet" :style="{ width: stageStore.pixelWidth+'px', height: stageStore.pixelHeight+'px' }" style="image-rendering:pixelated">
          <!-- 1. 기본 선택 윤곽 (하늘색) -->
          <path id="selectionOutline"
                v-if="selection.exists"
                :d="selectionPath"
                :fill="OVERLAY_CONFIG.SELECTED.FILL_COLOR"
                :stroke="OVERLAY_CONFIG.SELECTED.STROKE_COLOR"
                :stroke-width="OVERLAY_CONFIG.SELECTED.STROKE_WIDTH_SCALE / Math.max(1, stageStore.canvas.scale)"
                shape-rendering="crispEdges" />

          <!-- 2. 마퀴 사각형 (노란색) -->
          <rect id="marqueeRect"
                :x="stageService.marquee.x" :y="stageService.marquee.y"
                :width="stageService.marquee.w" :height="stageService.marquee.h"
                :visibility="stageService.marquee.visible ? 'visible' : 'hidden'"
                :fill="OVERLAY_CONFIG.MARQUEE.FILL_COLOR"
                :stroke="OVERLAY_CONFIG.MARQUEE.STROKE_COLOR"
                :stroke-width="OVERLAY_CONFIG.MARQUEE.STROKE_WIDTH_SCALE / Math.max(1, stageStore.canvas.scale)"
                shape-rendering="crispEdges" />

          <!-- 3. 추가 오버레이 (초록색) - 드래그 시 -->
          <path v-if="stageService.isDragging"
                :d="stageService.addOverlayPath"
                :fill="OVERLAY_CONFIG.ADD.FILL_COLOR"
                :stroke="OVERLAY_CONFIG.ADD.STROKE_COLOR"
                :stroke-width="OVERLAY_CONFIG.ADD.STROKE_WIDTH_SCALE / Math.max(1, stageStore.canvas.scale)"
                fill-rule="evenodd"
                shape-rendering="crispEdges" />

          <!-- 4. 제거 오버레이 (빨간색) - 드래그 시 -->
          <path v-if="stageService.isDragging"
                :d="stageService.removeOverlayPath"
                :fill="OVERLAY_CONFIG.REMOVE.FILL_COLOR"
                :stroke="OVERLAY_CONFIG.REMOVE.STROKE_COLOR"
                :stroke-width="OVERLAY_CONFIG.REMOVE.STROKE_WIDTH_SCALE / Math.max(1, stageStore.canvas.scale)"
                fill-rule="evenodd"
                shape-rendering="crispEdges" />

          <!-- 5. 호버 오버레이 (초록/빨강) - 클릭/호버 시 -->
          <path v-if="!stageService.isDragging && stageStore.isSelect"
                :d="layerSvc.pathOf(stageService.hoverLayerId)"
                :fill="hoverStyle.FILL_COLOR"
                :stroke="hoverStyle.STROKE_COLOR"
                :stroke-width="hoverStyle.STROKE_WIDTH_SCALE / Math.max(1, stageStore.canvas.scale)"
                fill-rule="evenodd"
                shape-rendering="crispEdges" />
      </svg>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useStageStore } from '../stores/stage';
import { useStageService } from '../services/stage';
import { useLayerService } from '../services/layers';
import { useSelectionStore } from '../stores/selection';
import { rgbaCssU32 } from '../utils';
import { OVERLAY_CONFIG } from '../constants';

const stageStore = useStageStore();
const stageService = useStageService();
const layerSvc = useLayerService();
const selection = useSelectionStore();
const containerEl = ref(null);
const stageEl = ref(null);

const updateCanvasPosition = () => {
    const rect = stageEl.value?.getBoundingClientRect();
    if (rect) stageStore.setCanvasPosition(rect.left, rect.top);
};

const onPointerDown = (e) => {
    updateCanvasPosition();
    stageService.pointerDown(e);
};
const onPointerMove = (e) => {
    updateCanvasPosition();
    stageService.pointerMove(e);
};
const onPointerUp = (e) => {
    updateCanvasPosition();
    stageService.pointerUp(e);
};
const onPointerCancel = (e) => stageService.pointerCancel(e);

const selectionPath = computed(() => layerSvc.selectionPath());
const hoverStyle = computed(() => {
    if (!stageService.hoverLayerId) return {};
    const isRemoving = stageStore.shiftHeld && selection.has(stageService.hoverLayerId);
    return isRemoving ? OVERLAY_CONFIG.REMOVE : OVERLAY_CONFIG.ADD;
});

const patternUrl = computed(() => `url(#${stageService.ensureCheckerboardPattern(document.body)})`);

const resizeObserver = new ResizeObserver(() => {
    stageService.recalcScale(containerEl.value);
    updateCanvasPosition();
});
onMounted(() => {
    stageService.ensureStagePointerStyles();
    stageService.recalcScale(containerEl.value);
    updateCanvasPosition();
    resizeObserver.observe(containerEl.value);
});
onUnmounted(() => resizeObserver.disconnect());

</script>
