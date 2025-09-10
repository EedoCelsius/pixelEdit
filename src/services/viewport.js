import { defineStore } from 'pinia';
import { computed, watch } from 'vue';
import { useStore } from '../stores';
import { WHEEL_ZOOM_IN_FACTOR, WHEEL_ZOOM_OUT_FACTOR, POSITION_LERP_EXPONENT } from '@/constants';

export const useViewportService = defineStore('viewportService', () => {
  const { viewport: viewportStore, viewportEvent: viewportEvents } = useStore();
  let lastTouchDistance = 0;

  const element = computed(() => viewportStore.element);

  function setElement(el) {
    viewportStore.setElement(el);
  }

  function zoomAt(px, py, factor) {
    const oldScale = viewportStore.stage.scale;
    const newScale = oldScale * factor;
    const clamped = Math.max(viewportStore.stage.minScale, newScale);
    const ratio = clamped / oldScale;
    const { offset } = viewportStore.stage;
    const centerX0 = (viewportStore.content.width - viewportStore.stage.width * oldScale) / 2;
    const centerY0 = (viewportStore.content.height - viewportStore.stage.height * oldScale) / 2;
    const t0x = offset.x + centerX0;
    const t0y = offset.y + centerY0;
    const t1x = px - ratio * (px - t0x);
    const t1y = py - ratio * (py - t0y);
    const centerX1 = (viewportStore.content.width - viewportStore.stage.width * clamped) / 2;
    const centerY1 = (viewportStore.content.height - viewportStore.stage.height * clamped) / 2;
    viewportStore.setOffset(t1x - centerX1, t1y - centerY1);
    viewportStore.setScale(clamped);
  }

  function handleWheel(e) {
    if (!viewportStore.element) return;
    if (!e.ctrlKey) {
      const { offset } = viewportStore.stage;
      viewportStore.setOffset(offset.x - e.deltaX, offset.y - e.deltaY);
    } else {
      if (e.deltaY === 0) return;
      const px = e.clientX - viewportStore.content.left;
      const py = e.clientY - viewportStore.content.top;
      const factor = e.deltaY < 0 ? WHEEL_ZOOM_IN_FACTOR : WHEEL_ZOOM_OUT_FACTOR;
      zoomAt(px, py, factor);
      if (factor < 1) interpolatePosition();
    }
  }

  function handlePinch() {
    const [id1, id2] = viewportEvents.pinchIds;
    const e1 = viewportEvents.get('pointermove', id1) || viewportEvents.get('pointerdown', id1);
    const e2 = viewportEvents.get('pointermove', id2) || viewportEvents.get('pointerdown', id2);
    const cx = (e1.clientX + e2.clientX) / 2 - viewportStore.content.left;
    const cy = (e1.clientY + e2.clientY) / 2 - viewportStore.content.top;
    const dist = Math.hypot(e2.clientX - e1.clientX, e2.clientY - e1.clientY);
    if (lastTouchDistance) {
      const factor = dist / lastTouchDistance
      zoomAt(cx, cy, factor);
      if (factor < 1) interpolatePosition();
    }
    lastTouchDistance = dist;
  }

  function interpolatePosition() {
    const stage = viewportStore.stage
    const strength = (stage.minScale / stage.scale) ** POSITION_LERP_EXPONENT;
    viewportStore.setOffset(
      stage.offset.x - stage.offset.x * strength,
      stage.offset.y - stage.offset.y * strength
    );
  }
  
  watch(() => viewportEvents.recent.pointer.move, () => {
      if (viewportEvents.pinchIds) handlePinch();
  });

  watch(() => viewportEvents.pinchIds, () => {
      lastTouchDistance = 0;
  });

  watch(() => viewportEvents.get('wheel'), (e) => {
    if (e) handleWheel(e);
  });

  return {
    element,
    setElement
  };
});
