<template>
  <div ref="containerEl" class="relative flex-1 min-h-0 p-2 overflow-auto touch-none"
       @wheel.prevent="onWheel"
       @pointerdown="onContainerPointerDown"
       @pointermove="onContainerPointerMove"
       @pointerup="onContainerPointerUp"
       @pointercancel="onContainerPointerCancel">
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
          <path v-for="id in layers.idsBottomToTop" :key="'pix-'+id" :d="layers.pathOf(id)" fill-rule="evenodd" shape-rendering="crispEdges" :fill="rgbaCssU32(layers.colorOf(id))" :visibility="layers.visibilityOf(id)?'visible':'hidden'"></path>
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
                :x="marquee.x" :y="marquee.y"
                :width="marquee.w" :height="marquee.h"
                :visibility="marquee.visible ? 'visible' : 'hidden'"
                :fill="OVERLAY_CONFIG.MARQUEE.FILL_COLOR"
                :stroke="OVERLAY_CONFIG.MARQUEE.STROKE_COLOR"
                :stroke-width="OVERLAY_CONFIG.MARQUEE.STROKE_WIDTH_SCALE / Math.max(1, stageStore.canvas.scale)"
                shape-rendering="crispEdges" />

        <!-- 3. 선택/호버 오버레이 -->
        <path v-if="toolStore.isSelect"
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
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue';
import { useStageStore } from '../stores/stage';
import { useToolStore } from '../stores/tool';
import { useStageService } from '../services/stage';
import { useLayerStore } from '../stores/layers';
import { useLayerService } from '../services/layers';
import { useSelectionStore } from '../stores/selection';
import { useInputStore } from '../stores/input';
import { useSelectService } from '../services/select';
import { usePixelService } from '../services/pixel';
import { rgbaCssU32, rgbaCssObj, calcMarquee, clamp } from '../utils';
import { OVERLAY_CONFIG } from '../constants';

const stageStore = useStageStore();
const toolStore = useToolStore();
const stageService = useStageService();
const layers = useLayerStore();
const layerSvc = useLayerService();
const selection = useSelectionStore();
const input = useInputStore();
const selectSvc = useSelectService();
const pixelSvc = usePixelService();
const containerEl = ref(null);
const stageEl = ref(null);
const offset = reactive({ x: 0, y: 0 });
const marquee = reactive({ visible: false, x: 0, y: 0, w: 0, h: 0 });

const updateHover = (event) => {
    const pixel = stageService.clientToPixel(event);
    if (!pixel) {
        stageStore.updatePixelInfo('-');
        toolStore.hoverLayerId = null;
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
        toolStore.hoverLayerId = layers.topVisibleIdAt(pixel.x, pixel.y);
    } else {
        toolStore.hoverLayerId = null;
    }
};

const updateMarquee = (e) => {
    if (toolStore.shape !== 'rect' || toolStore.pointer.status === 'idle' || !toolStore.pointer.start || !e) {
        Object.assign(marquee, { visible: false, x: 0, y: 0, w: 0, h: 0 });
        return;
    }
    Object.assign(marquee, calcMarquee(toolStore.pointer.start, { x: e.clientX, y: e.clientY }, stageStore.canvas));
};
  
const touches = new Map();
let lastTouchDistance = 0;

const onContainerPointerDown = (e) => {
  if (e.pointerType !== 'touch') return;
  e.preventDefault();
  touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  lastTouchDistance = 0;
};

const onContainerPointerMove = (e) => {
  if (e.pointerType !== 'touch') return;
  touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (touches.size === 2) handlePinch();
};

const onContainerPointerUp = (e) => {
  if (e.pointerType !== 'touch') return;
  touches.delete(e.pointerId);
  lastTouchDistance = 0;
};

const onContainerPointerCancel = (e) => {
  if (e.pointerType !== 'touch') return;
  touches.delete(e.pointerId);
  lastTouchDistance = 0;
};

const onPointerDown = (e) => {
  if (e.pointerType === 'touch') return;
  updateMarquee(e);
  if (toolStore.isSelect) selectSvc.toolStart(e);
  else pixelSvc.toolStart(e);
};

const onPointerMove = (e) => {
  if (e.pointerType === 'touch') return;
  updateHover(e);
  updateMarquee(e);
  if (toolStore.isSelect) selectSvc.toolMove(e);
  else pixelSvc.toolMove(e);
};

const onPointerUp = (e) => {
  if (e.pointerType === 'touch') return;
  updateMarquee(e);
  if (toolStore.isSelect) selectSvc.toolFinish(e);
  else pixelSvc.toolFinish(e);
};

const onPointerCancel = (e) => {
    if (e.pointerType === 'touch') return;
    updateMarquee(e);
    if (toolStore.isSelect) selectSvc.cancel(e);
    else pixelSvc.cancel(e);
};

const onPointerLeave = (e) => {
    if (e.pointerType === 'touch') return;
    toolStore.hoverLayerId = null;
    stageStore.updatePixelInfo('-');
};

const onWheel = (e) => {
  if (e.ctrlKey) {
    if (e.deltaY === 0) return;
    const rect = containerEl.value.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const oldScale = stageStore.canvas.scale;
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    const newScale = oldScale * factor;
    const clamped = Math.max(stageStore.canvas.minScale, newScale);
    const ratio = clamped / oldScale;
    offset.x = px - ratio * (px - offset.x);
    offset.y = py - ratio * (py - offset.y);
    stageStore.setScale(clamped);
    if (newScale < oldScale) positionStage();
  } else {
    offset.x -= e.deltaX;
    offset.y -= e.deltaY;
    const el = containerEl.value;
    const style = getComputedStyle(el);
    const width = el.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const height = el.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
    const maxX = width - stageStore.pixelWidth;
    const maxY = height - stageStore.pixelHeight;
    offset.x = clamp(offset.x, maxX, 0);
    offset.y = clamp(offset.y, maxY, 0);
  }
  updateCanvasPosition();
};

const handlePinch = () => {
  const rect = containerEl.value.getBoundingClientRect();
  const [t1, t2] = Array.from(touches.values());
  const cx = (t1.x + t2.x) / 2 - rect.left;
  const cy = (t1.y + t2.y) / 2 - rect.top;
  const dist = Math.hypot(t2.x - t1.x, t2.y - t1.y);
  if (!lastTouchDistance) {
    lastTouchDistance = dist;
    return;
  }
  const oldScale = stageStore.canvas.scale;
  const newScale = oldScale * (dist / lastTouchDistance);
  const clamped = Math.max(stageStore.canvas.minScale, newScale);
  const ratio = clamped / oldScale;
  offset.x = cx - ratio * (cx - offset.x);
  offset.y = cy - ratio * (cy - offset.y);
  stageStore.setScale(clamped);
  lastTouchDistance = dist;
  if (newScale < oldScale) positionStage();
  updateCanvasPosition();
};

const selectionPath = computed(() => layerSvc.selectionPath());
const helperOverlay = computed(() => {
    let path;
    let style;

    if (toolStore.pointer.status !== 'idle') {
        path = stageService.selectOverlayPath;
        style = toolStore.pointer.status === 'remove'
            ? OVERLAY_CONFIG.REMOVE
            : OVERLAY_CONFIG.ADD;
    } else {
        path = layers.pathOf(toolStore.hoverLayerId);
        if (toolStore.hoverLayerId) {
            const isRemoving = toolStore.shiftHeld && selection.isSelected(toolStore.hoverLayerId);
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

const positionStage = (center = false) => {
  const el = containerEl.value;
  const style = getComputedStyle(el);
  const width = el.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  const height = el.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
  const maxX = width - stageStore.pixelWidth;
  const maxY = height - stageStore.pixelHeight;
  const targetX = maxX >= 0 ? maxX / 2 : clamp(offset.x, maxX, 0);
  const targetY = maxY >= 0 ? maxY / 2 : clamp(offset.y, maxY, 0);
  if (center) {
    offset.x = targetX;
    offset.y = targetY;
  } else {
    const strength = (stageStore.canvas.minScale / stageStore.canvas.scale) ** 2;
    offset.x += (targetX - offset.x) * strength;
    offset.y += (targetY - offset.y) * strength;
  }
};
const updateCanvasPosition = () => {
    const el = containerEl.value;
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    const left = rect.left + parseFloat(style.paddingLeft);
    const top = rect.top + parseFloat(style.paddingTop);
    stageStore.setCanvasPosition(left + offset.x, top + offset.y);
};

let prevOffsetWidth = 0;
let prevOffsetHeight = 0;
let prevClientWidth = 0;
let prevClientHeight = 0;

const onDomResize = () => {
    const el = containerEl.value;
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
    stageService.recalcMinScale(containerEl.value);
    stageStore.setScale(stageStore.canvas.containScale);
    positionStage(true);
    updateCanvasPosition();
};

const resizeObserver = new ResizeObserver(onDomResize);
onMounted(() => {
    requestAnimationFrame(onDomResize);
    resizeObserver.observe(containerEl.value);
});
onUnmounted(resizeObserver.disconnect);
</script>
