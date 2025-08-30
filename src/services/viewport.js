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

  function handleWheel(e) {
    if (!viewportStore.element) return;
    const { offset } = viewportStore.stage;
    if (!e.ctrlKey) {
      viewportStore.setOffset(offset.x - e.deltaX, offset.y - e.deltaY);
    } else {
      if (e.deltaY === 0) return;
      const px = e.clientX - viewportStore.content.left;
      const py = e.clientY - viewportStore.content.top;
      const oldScale = viewportStore.stage.scale;
      const factor = e.deltaY < 0 ? WHEEL_ZOOM_IN_FACTOR : WHEEL_ZOOM_OUT_FACTOR;
      const newScale = oldScale * factor;
      const clamped = Math.max(viewportStore.stage.minScale, newScale);
      const ratio = clamped / oldScale;
      viewportStore.setOffset(
        px - ratio * (px - offset.x),
        py - ratio * (py - offset.y)
      );
      viewportStore.setScale(clamped);
      if (newScale < oldScale) interpolatePosition(true);
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
      const oldScale = viewportStore.stage.scale;
      const newScale = oldScale * (dist / lastTouchDistance);
      const clamped = Math.max(viewportStore.stage.minScale, newScale);
      const ratio = clamped / oldScale;
      const { offset } = viewportStore.stage;
      viewportStore.setOffset(
        cx - ratio * (cx - offset.x),
        cy - ratio * (cy - offset.y)
      );
      viewportStore.setScale(clamped);
      if (newScale < oldScale) interpolatePosition(true);
    }
    lastTouchDistance = dist;
  }

  function interpolatePosition() {
    const stage = viewportStore.stage
    const width = viewportStore.content.width;
    const height = viewportStore.content.height;
    const scaledWidth = stage.width * stage.scale;
    const scaledHeight = stage.height * stage.scale;
    const strength = (stage.minScale / stage.scale) ** POSITION_LERP_EXPONENT;
    viewportStore.setOffset(
      stage.offset.x + ((width - scaledWidth) / 2 - stage.offset.x) * strength,
      stage.offset.y + ((height - scaledHeight) / 2 - stage.offset.y) * strength
    );
  }

  function centerPosition() {
    const stage = viewportStore.stage
    const width = viewportStore.content.width;
    const height = viewportStore.content.height;
    const scaledWidth = stage.width * stage.scale;
    const scaledHeight = stage.height * stage.scale;
    viewportStore.setOffset((width - scaledWidth) / 2, (height - scaledHeight) / 2);
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
    setElement,
    centerPosition
  };
});
