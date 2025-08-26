import { defineStore } from 'pinia';
import { computed, watch } from 'vue';
import { useStore } from '../stores';
import { clamp } from '../utils';
import { WHEEL_ZOOM_IN_FACTOR, WHEEL_ZOOM_OUT_FACTOR, POSITION_LERP_EXPONENT } from '@/constants';

export const useViewportService = defineStore('viewportService', () => {
  const { viewport: viewportStore, viewportEvent: viewportEvents } = useStore();
  const offset = viewportStore.stage.offset;
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
      offset.x -= e.deltaX;
      offset.y -= e.deltaY;
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
      offset.x = px - ratio * (px - offset.x);
      offset.y = py - ratio * (py - offset.y);
      viewportStore.setScale(clamped);
      if (newScale < oldScale) posSoftInterpolation(false);
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
    offset.x = cx - ratio * (cx - offset.x);
    offset.y = cy - ratio * (cy - offset.y);
    viewportStore.setScale(clamped);
    lastTouchDistance = dist;
    if (newScale < oldScale) posSoftInterpolation(false);
  }

  function posSoftInterpolation(center = false) {
    const viewportEl = viewportStore.element;
    if (!viewportEl) return;
    const style = getComputedStyle(viewportEl);
    const width = viewportEl.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const height = viewportEl.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
    const scaledWidth = viewportStore.stage.width * viewportStore.stage.scale;
    const scaledHeight = viewportStore.stage.height * viewportStore.stage.scale;
    const maxX = width - scaledWidth;
    const maxY = height - scaledHeight;
    const targetX = maxX >= 0 ? maxX / 2 : clamp(offset.x, maxX, 0);
    const targetY = maxY >= 0 ? maxY / 2 : clamp(offset.y, maxY, 0);
    if (center) {
      offset.x = targetX;
      offset.y = targetY;
    } else {
      const strength = (viewportStore.stage.minScale / viewportStore.stage.scale) ** POSITION_LERP_EXPONENT;
      offset.x += (targetX - offset.x) * strength;
      offset.y += (targetY - offset.y) * strength;
    }
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
    offset,
    posSoftInterpolation,
  };
});
