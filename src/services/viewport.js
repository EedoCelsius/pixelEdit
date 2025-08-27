import { defineStore } from 'pinia';
import { computed, watch } from 'vue';
import { useStore } from '../stores';
import { clamp } from '../utils';
import { WHEEL_ZOOM_IN_FACTOR, WHEEL_ZOOM_OUT_FACTOR, POSITION_LERP_EXPONENT } from '@/constants';

export const useViewportService = defineStore('viewportService', () => {
  const { viewport: viewportStore, viewportEvent: viewportEvents } = useStore();
  let lastTouchDistance = 0;

  const element = computed(() => viewportStore.element);

  function setElement(el) {
    viewportStore.setElement(el);
  }

  function handleWheel(e) {
    const viewportEl = viewportStore.element;
    if (!viewportEl) return;
      if (!e.ctrlKey) {
      viewportStore.stage.offset.x -= e.deltaX;
      viewportStore.stage.offset.y -= e.deltaY;
    } else {
      if (e.deltaY === 0) return;
      const px = e.clientX - viewportStore.content.left;
      const py = e.clientY - viewportStore.content.top;
      const oldScale = viewportStore.stage.scale;
      const factor = e.deltaY < 0 ? WHEEL_ZOOM_IN_FACTOR : WHEEL_ZOOM_OUT_FACTOR;
      const newScale = oldScale * factor;
      const clamped = Math.max(viewportStore.stage.minScale, newScale);
      const ratio = clamped / oldScale;
      viewportStore.stage.offset.x = px - ratio * (px - viewportStore.stage.offset.x);
      viewportStore.stage.offset.y = py - ratio * (py - viewportStore.stage.offset.y);
      viewportStore.setScale(clamped);
      if (newScale < oldScale) interpolatePosition(true);
    }
  }

  function handlePinch() {
    const viewportEl = viewportStore.element;
    const [id1, id2] = viewportEvents.pinchIds;
    const e1 = viewportEvents.get('pointermove', id1) || viewportEvents.get('pointerdown', id1);
    const e2 = viewportEvents.get('pointermove', id2) || viewportEvents.get('pointerdown', id2);
    const cx = (e1.clientX + e2.clientX) / 2 - viewportStore.content.left;
    const cy = (e1.clientY + e2.clientY) / 2 - viewportStore.content.top;
    const dist = Math.hypot(e2.clientX - e1.clientX, e2.clientY - e1.clientY);
    if (lastTouchDistance) {
      const oldScale = viewportStore.stage.scale;
      const newScale = oldScale * (dist / lastTouchDistance);
      const clamped = Math.max(viewportStore.stage.minScale, newScale);
      const ratio = clamped / oldScale;
      viewportStore.stage.offset.x = cx - ratio * (cx - viewportStore.stage.offset.x);
      viewportStore.stage.offset.y = cy - ratio * (cy - viewportStore.stage.offset.y);
      viewportStore.setScale(clamped);
      if (newScale < oldScale) interpolatePosition(true);
    }
    lastTouchDistance = dist;
  }

  function interpolatePosition(soft = true) {
    const viewportEl = viewportStore.element;
    if (!viewportEl) return;
    const width = viewportStore.content.width;
    const height = viewportStore.content.height;
    const scaledWidth = viewportStore.stage.width * viewportStore.stage.scale;
    const scaledHeight = viewportStore.stage.height * viewportStore.stage.scale;
    const maxX = width - scaledWidth;
    const maxY = height - scaledHeight;
    const targetX = maxX >= 0 ? maxX / 2 : clamp(viewportStore.stage.offset.x, maxX, 0);
    const targetY = maxY >= 0 ? maxY / 2 : clamp(viewportStore.stage.offset.y, maxY, 0);
    const strength = soft ? (viewportStore.stage.minScale / viewportStore.stage.scale) ** POSITION_LERP_EXPONENT : 1;
    viewportStore.stage.offset.x += (targetX - viewportStore.stage.offset.x) * strength;
    viewportStore.stage.offset.y += (targetY - viewportStore.stage.offset.y) * strength;
  }

  watch(
    () => viewportEvents.recent.pointer.move,
    () => {
      if (viewportEvents.pinchIds) handlePinch();
    },
    { deep: true }
  );

  watch(
    () => viewportEvents.pinchIds,
    () => {
      lastTouchDistance = 0;
    }
  );

  watch(() => viewportEvents.get('wheel'), (e) => {
    if (e) handleWheel(e);
  });

  return {
    element,
    setElement,
    interpolatePosition,
  };
});
