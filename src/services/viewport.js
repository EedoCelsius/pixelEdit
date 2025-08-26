import { defineStore } from 'pinia';
import { computed, watch } from 'vue';
import { useStore } from '../stores';
import { clamp } from '../utils';
import { WHEEL_ZOOM_IN_FACTOR, WHEEL_ZOOM_OUT_FACTOR, POSITION_LERP_EXPONENT } from '@/constants';

export const useViewportService = defineStore('viewportService', () => {
  const { viewport: viewportStore, viewportEvent: viewportEvents } = useStore();
  const touches = new Map();
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
      const rect = viewportEl.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
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
    if (!viewportEl) return;
    const rect = viewportEl.getBoundingClientRect();
    const [t1, t2] = Array.from(touches.values());
    const cx = (t1.x + t2.x) / 2 - rect.left;
    const cy = (t1.y + t2.y) / 2 - rect.top;
    const dist = Math.hypot(t2.x - t1.x, t2.y - t1.y);
    if (!lastTouchDistance) {
      lastTouchDistance = dist;
      return;
    }
    const oldScale = viewportStore.stage.scale;
    const newScale = oldScale * (dist / lastTouchDistance);
    const clamped = Math.max(viewportStore.stage.minScale, newScale);
    const ratio = clamped / oldScale;
    viewportStore.stage.offset.x = cx - ratio * (cx - viewportStore.stage.offset.x);
    viewportStore.stage.offset.y = cy - ratio * (cy - viewportStore.stage.offset.y);
    viewportStore.setScale(clamped);
    lastTouchDistance = dist;
    if (newScale < oldScale) interpolatePosition(true);
  }

  function interpolatePosition(soft = true) {
    const viewportEl = viewportStore.element;
    if (!viewportEl) return;
    const style = getComputedStyle(viewportEl);
    const width = viewportEl.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const height = viewportEl.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
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
    () => viewportEvents.recent.pointer.down,
    (events) => {
      for (const e of events) {
        if (e.pointerType !== 'touch') continue;
        touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
        lastTouchDistance = 0;
      }
    },
    { deep: true }
  );

  watch(
    () => viewportEvents.recent.pointer.move,
    (events) => {
      for (const e of events) {
        if (e.pointerType !== 'touch') continue;
        touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (touches.size === 2) handlePinch();
      }
    },
    { deep: true }
  );

  watch(
    () => viewportEvents.recent.pointer.up,
    (events) => {
      for (const e of events) {
        if (e.pointerType !== 'touch') continue;
        touches.delete(e.pointerId);
        lastTouchDistance = 0;
      }
    },
    { deep: true }
  );

  watch(() => viewportEvents.getEvent('wheel'), (e) => {
    if (e) handleWheel(e);
  });

  return {
    element,
    setElement,
    interpolatePosition,
  };
});
