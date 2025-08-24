import { defineStore } from 'pinia';
import { reactive } from 'vue';
import { useStageStore } from '../stores/stage';
import { clamp } from '../utils';

export const useViewportService = defineStore('viewportService', () => {
  const stageStore = useStageStore();
  const offset = reactive({ x: 0, y: 0 });
  const touches = new Map();
  let lastTouchDistance = 0;

  function onContainerPointerDown(e) {
    if (e.pointerType !== 'touch') return;
    e.preventDefault();
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    lastTouchDistance = 0;
  }

  function onContainerPointerMove(e, container) {
    if (e.pointerType !== 'touch') return;
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.size === 2) handlePinch(container);
  }

  function onContainerPointerUp(e) {
    if (e.pointerType !== 'touch') return;
    touches.delete(e.pointerId);
    lastTouchDistance = 0;
  }

  function onContainerPointerCancel(e) {
    if (e.pointerType !== 'touch') return;
    touches.delete(e.pointerId);
    lastTouchDistance = 0;
  }

  function onWheel(e, container) {
    if (!e.ctrlKey) {
      offset.x -= e.deltaX;
      offset.y -= e.deltaY;
    } else {
      if (e.deltaY === 0) return;
      const rect = container.getBoundingClientRect();
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
      if (newScale < oldScale) positionStage(false, container);
    }
    updateCanvasPosition(container);
  }

  function handlePinch(container) {
    const rect = container.getBoundingClientRect();
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
    if (newScale < oldScale) positionStage(false, container);
    updateCanvasPosition(container);
  }

  function positionStage(center = false, container) {
    const style = getComputedStyle(container);
    const width = container.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const height = container.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
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
  }

  function updateCanvasPosition(container) {
    const rect = container.getBoundingClientRect();
    const style = getComputedStyle(container);
    const left = rect.left + parseFloat(style.paddingLeft);
    const top = rect.top + parseFloat(style.paddingTop);
    stageStore.setCanvasPosition(left + offset.x, top + offset.y);
  }

  return {
    offset,
    onContainerPointerDown,
    onContainerPointerMove,
    onContainerPointerUp,
    onContainerPointerCancel,
    onWheel,
    positionStage,
    updateCanvasPosition,
  };
});
