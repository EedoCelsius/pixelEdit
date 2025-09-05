<template>
  <div ref="viewportEl" class="relative flex-1 min-h-0 p-2 overflow-hidden touch-none"
       :style="{ cursor: toolSelectionService.getCursor() }"
       @wheel.prevent="viewportEvents.setWheel"
       @pointerdown="viewportEvents.setPointerDown"
       @pointermove="viewportEvents.setPointerMove"
       @pointerup="viewportEvents.setPointerUp"
       @pointercancel="viewportEvents.setPointerUp">
    <div id="stage" class="absolute select-none touch-none"
         :style="stageStyle"
         @contextmenu.prevent>
      <!-- 체커보드 -->
      <svg class="absolute w-full h-full top-0 left-0 pointer-events-none block" :viewBox="viewportStore.viewBox" preserveAspectRatio="xMidYMid meet">
        <rect x="0" y="0" :width="stage.width" :height="stage.height" :fill="patternUrl"/>
      </svg>
      <!-- 원본 -->
      <img v-show="viewportStore.display==='original'"
           class="absolute pointer-events-none block"
           :src="viewportStore.imageSrc"
           alt="source image"
           :style="imageStyle"
           @load="onImageLoad" />
      <!-- 결과 레이어 -->
      <svg v-show="viewportStore.display==='result'" class="absolute w-full h-full top-0 left-0 pointer-events-none block" :viewBox="viewportStore.viewBox" preserveAspectRatio="xMidYMid meet">
        <g>
            <path v-for="props in nodes.getProperties(nodeTree.layerIdsBottomToTop)" :key="'pix-'+props.id" :d="pixelStore.pathOfLayer(props.id)" fill-rule="evenodd" shape-rendering="crispEdges" :fill="rgbaCssU32(props.color)" :visibility="props.visibility?'visible':'hidden'"></path>
        </g>
      </svg>
      <!-- 그리드 -->
      <svg class="absolute w-full h-full top-0 left-0 pointer-events-none block" :viewBox="viewportStore.viewBox" preserveAspectRatio="xMidYMid meet">
        <g :stroke="GRID_STROKE_COLOR" :stroke-width="1/Math.max(1,stage.scale)">
          <path v-for="x in (stage.width+1)" :key="'gx'+x" :d="'M '+(x-1)+' 0 V '+stage.height"></path>
          <path v-for="y in (stage.height+1)" :key="'gy'+y" :d="'M 0 '+(y-1)+' H '+stage.width"></path>
        </g>
      </svg>
        <!-- 오버레이 -->
      <svg class="absolute w-full h-full top-0 left-0 pointer-events-none block" :viewBox="viewportStore.viewBox" preserveAspectRatio="xMidYMid meet">
        <template v-for="ov in overlay.list" :key="ov.id">
          <path v-if="ov.path"
                :id="ov.id + 'Overlay'"
                :d="ov.path"
              :fill="ov.styles.FILL_COLOR"
                :stroke="ov.styles.STROKE_COLOR"
                :stroke-width="ov.styles.STROKE_WIDTH_SCALE / Math.max(1, stage.scale)"
                :fill-rule="ov.styles.FILL_RULE"
                shape-rendering="crispEdges" />
        </template>
      </svg>
      </div>
      <!-- Marquee overlay -->
      <svg class="absolute top-0 left-0 w-full h-full pointer-events-none block" :viewBox="viewportViewBox" preserveAspectRatio="none">
          <rect id="marqueeRect"
                :x="marqueeRect.x"
                :y="marqueeRect.y"
              :width="marqueeRect.width"
              :height="marqueeRect.height"
              :visibility="marqueeRect.visibility"
              :fill="OVERLAY_STYLES.MARQUEE.FILL_COLOR"
              :stroke="OVERLAY_STYLES.MARQUEE.STROKE_COLOR"
              :stroke-width="OVERLAY_STYLES.MARQUEE.STROKE_WIDTH_SCALE"
              shape-rendering="crispEdges" />
    </svg>
  </div>
</template>

<script setup>
import { useTemplateRef, computed, onMounted, onUnmounted } from 'vue';
import { useStore } from '../stores';
import { useService } from '../services';
import { OVERLAY_STYLES, GRID_STROKE_COLOR } from '@/constants';
import { rgbaCssU32, ensureCheckerboardPattern } from '../utils';

const { viewport: viewportStore, nodeTree, nodes, pixels: pixelStore, viewportEvent: viewportEvents } = useStore();
const { overlay, toolSelection: toolSelectionService, viewport } = useService();
const viewportEl = useTemplateRef('viewportEl');
const stage = viewportStore.stage;
const image = viewportStore.imageRect;
const dpr = window.devicePixelRatio || 1;

const stageStyle = computed(() => {
    const width = stage.width / dpr;
    const height = stage.height / dpr;
    return {
        width: width + 'px',
        height: height + 'px',
        transform: `translate3d(${stage.offset.x}px, ${stage.offset.y}px, 0) scale(${stage.scale * dpr})`,
        transformOrigin: 'top left',
        willChange: 'transform'
    };
});

const imageStyle = computed(() => ({
    left: image.x / dpr + 'px',
    top: image.y / dpr + 'px',
    width: image.width / dpr + 'px',
    height: image.height / dpr + 'px'
}));

const viewportViewBox = computed(() => `0 0 ${viewportStore.content.width} ${viewportStore.content.height}`);
const marqueeRect = computed(() => {
    const marquee = toolSelectionService.marquee;
    if (!marquee.visible || !marquee.anchorEvent || !marquee.tailEvent)
        return { x: 0, y: 0, width: 0, height: 0, visibility: 'hidden' };
    const left = viewportStore.content.left;
    const top = viewportStore.content.top;
    const ax = marquee.anchorEvent.clientX - left;
    const ay = marquee.anchorEvent.clientY - top;
    const tx = marquee.tailEvent.clientX - left;
    const ty = marquee.tailEvent.clientY - top;
    return {
        x: Math.min(ax, tx),
        y: Math.min(ay, ty),
        width: Math.abs(tx - ax),
        height: Math.abs(ty - ay),
        visibility: marquee.visible ? 'visible' : 'hidden'
    };
});

const patternUrl = computed(() => `url(#${ensureCheckerboardPattern(document.body)})`);

function initPosition() {
  viewportStore.recalcContentSize();
  viewportStore.setScale(stage.containScale * 3/4);
  viewport.centerPosition();
}

const onImageLoad = (e) => {
    const img = e.target;
    viewportStore.setImageSize(img.naturalWidth, img.naturalHeight);
    initPosition();
};

const resizeObserver = new ResizeObserver(viewportStore.recalcContentSize);
onMounted(() => {
    viewport.setElement(viewportEl.value);
    requestAnimationFrame(initPosition);
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
