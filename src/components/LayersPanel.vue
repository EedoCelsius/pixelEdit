<template>
  <div v-memo="[output.commitVersion, layers.selectedIds, layers.count]" ref="listElement" class="layers flex-1 overflow-auto p-2 flex flex-col gap-2 relative" :class="{ dragging: dragging }" @dragover.prevent @drop.prevent>
    <div v-for="props in layers.getProperties(layers.idsTopToBottom)" class="layer flex items-center gap-3 p-2 border border-white/15 rounded-lg bg-sky-950/30 cursor-grab select-none" :key="props.id" :data-id="props.id" :class="{ selected: layers.isSelected(props.id), anchor: layerPanel.anchorId===props.id, dragging: dragId===props.id }" draggable="true" @click="layerPanel.onLayerClick(props.id,$event)" @dragstart="onDragStart(props.id,$event)" @dragend="onDragEnd" @dragover.prevent="onDragOver(props.id,$event)" @dragleave="onDragLeave($event)" @drop.prevent="onDrop(props.id,$event)">
      <!-- 썸네일 -->
      <div @click.stop="onThumbnailClick(props.id)" class="w-16 h-16 rounded-md border border-white/15 bg-slate-950 overflow-hidden cursor-pointer" title="같은 색상의 모든 레이어 선택">
        <svg :viewBox="stageStore.viewBox" preserveAspectRatio="xMidYMid meet" class="w-full h-full">
          <rect x="0" y="0" :width="stageStore.canvas.width" :height="stageStore.canvas.height" :fill="patternUrl"/>
          <path :d="layers.pathOf(props.id)" :fill="rgbaCssU32(props.color)" :opacity="props.visible?1:0.3" fill-rule="evenodd" shape-rendering="crispEdges"/>
        </svg>
      </div>
      <!-- 색상 -->
      <div class="h-6 w-6 rounded border border-white/25 p-0 relative overflow-hidden">
        <input type="color" class="h-10 w-10 p-0 cursor-pointer absolute -top-2 -left-2" :class="{ 'cursor-not-allowed': props.locked }" :disabled="props.locked" :value="rgbaToHexU32(props.color)" @pointerdown.stop @mousedown.stop @click.stop="onColorDown()" @input.stop="onColorInput(props.id, $event)" @change.stop="onColorChange()" title="색상 변경" />
      </div>
      <!-- 이름/픽셀 -->
      <div class="min-w-0 flex-1">
        <div class="name font-semibold truncate text-sm pointer-events-none" title="더블클릭으로 이름 편집">
          <span class="nameText pointer-events-auto inline-block max-w-full whitespace-nowrap overflow-hidden text-ellipsis" @dblclick="startRename(props.id)" @keydown="onNameKey(props.id,$event)" @blur="finishRename(props.id,$event)">{{ props.name }}</span>
        </div>
        <div class="text-xs text-slate-400">
          <template v-if="layers.disconnectedCountOf(props.id) > 1">
            <span class="cursor-pointer" @click.stop="onDisconnectedClick(props.id)">⚠️</span>
            <span class="cursor-pointer" @click.stop="onDisconnectedCountClick(props.id)">{{ layers.disconnectedCountOf(props.id) }} piece</span>
            <span class="mx-1">|</span>
          </template>
          <span class="cursor-pointer" @click.stop="onPixelCountClick(props.id)" title="같은 크기의 모든 레이어 선택">{{ props.pixels.length }} px</span>
        </div>
      </div>
      <!-- 액션 -->
      <div class="flex gap-1 justify-end">
        <div class="inline-flex items-center justify-center w-7 h-7 rounded-md" title="보이기/숨기기">
          <img :src="(props.visible?icons.show:icons.hide)" alt="show/hide" class="w-4 h-4 cursor-pointer" @error="icons.show=icons.hide=''" @click.stop="toggleVisibility(props.id)" />
        </div>
        <div class="inline-flex items-center justify-center w-7 h-7 rounded-md" title="잠금/해제">
          <img :src="(props.locked?icons.lock:icons.unlock)" alt="lock/unlock" class="w-4 h-4 cursor-pointer" @error="icons.lock=icons.unlock=''" @click.stop="toggleLock(props.id)" />
        </div>
        <div class="inline-flex items-center justify-center w-7 h-7 rounded-md" title="삭제">
          <img :src="icons.del" alt="delete" class="w-4 h-4 cursor-pointer" @error="icons.del=''" @click.stop="deleteLayer(props.id)" />
        </div>
        </div>
    </div>
      <div v-show="layers.idsTopToBottom.length===0" class="text-xs text-slate-400/80 py-6 text-center">(레이어가 없습니다)</div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { useStore } from '../stores';
import { useService } from '../services';
import { rgbaCssU32, rgbaToHexU32, hexToRgbaU32, coordsToKey, clamp } from '../utils';
import blockIcons from '../image/layer_block';

const { stage: stageStore, layers, output } = useStore();
const { stage: stageService, layerPanel, query } = useService();

const dragging = ref(false);
const dragId = ref(null);
const editingId = ref(null);
const listElement = ref(null);
const icons = reactive(blockIcons);

const patternUrl = computed(() => `url(#${stageService.ensureCheckerboardPattern(document.body)})`);


  function onThumbnailClick(id) {
      const color = layers.getProperty(id, 'color');
      const ids = query.byColor(color);
      if (ids.length) {
          layers.replaceSelection(ids);
          layerPanel.clearRange();
      }
      layerPanel.setScrollRule({
          type: "follow",
          target: id
      });
  }

  function onPixelCountClick(id) {
      const count = layers.getProperty(id, 'pixels').length;
      const ids = count === 0 ? [id] : query.byPixelCount(count);
      if (ids.length <= 1) {
          layerPanel.setRange(id, id);
      } else {
          layers.replaceSelection(ids);
          layerPanel.clearRange();
      }
      layerPanel.setScrollRule({
          type: "follow",
          target: id
      });
  }

  function onDisconnectedClick(id) {
      const ids = query.disconnected();
      if (ids.length) {
          layers.replaceSelection(ids);
          layerPanel.clearRange();
      }
      layerPanel.setScrollRule({
          type: "follow",
          target: id
      });
  }

  function onDisconnectedCountClick(id) {
      const count = layers.disconnectedCountOf(id);
      const ids = count <= 1 ? [id] : query.byDisconnectedCount(count);
      if (ids.length <= 1) {
          layerPanel.setRange(id, id);
      } else {
          layers.replaceSelection(ids);
          layerPanel.clearRange();
      }
      layerPanel.setScrollRule({
          type: "follow",
          target: id
      });
  }

function onDragStart(id, event) {
    dragging.value = true;
    dragId.value = id;
    output.setRollbackPoint();
    event.dataTransfer.setData('text/plain', String(id));
}

function onDragEnd() {
    dragging.value = false;
    dragId.value = null;
}

function onDragOver(id, event) {
    const row = event.currentTarget;
    if (layers.isSelected(id)) {
        row.classList.remove('insert-before', 'insert-after');
        event.dataTransfer.dropEffect = 'none';
        return;
    }
    const rect = row.getBoundingClientRect();
    const before = (event.clientY - rect.top) < rect.height * 0.5;
    row.classList.toggle('insert-before', before);
    row.classList.toggle('insert-after', !before);
}

function onDragLeave(event) {
    event.currentTarget.classList.remove('insert-before', 'insert-after');
}

function onDrop(id, event) {
    const row = event.currentTarget;
    row.classList.remove('insert-before', 'insert-after');
    const targetId = id;
    const rect = row.getBoundingClientRect();
    const placeBelow = (event.clientY - rect.top) > rect.height * 0.5;
    layers.reorderLayers(layers.selectedIds, targetId, placeBelow);
    output.commit();
}

function onColorDown() {
    output.setRollbackPoint();
}

function onColorInput(id, event) {
    const colorU32 = hexToRgbaU32(event.target.value);
    if (layers.isSelected(id)) {
        for (const sid of layers.selectedIds) {
            layers.updateProperties(sid, { color: colorU32 });
        }
    } else {
        layers.updateProperties(id, { color: colorU32 });
    }
}

function onColorChange() {
    output.commit();
}

function toggleVisibility(id) {
    output.setRollbackPoint();
    if (layers.isSelected(id)) {
        const newVisible = !layers.getProperty(id, 'visible');
        for (const sid of layers.selectedIds) {
            layers.updateProperties(sid, { visible: newVisible });
        }
    } else {
        layers.toggleVisibility(id);
    }
    output.commit();
}

function toggleLock(id) {
    output.setRollbackPoint();
    if (layers.isSelected(id)) {
        const newLocked = !layers.getProperty(id, 'locked');
        for (const sid of layers.selectedIds) {
            layers.updateProperties(sid, { locked: newLocked });
        }
    } else {
        layers.toggleLock(id);
    }
    output.commit();
}

function deleteLayer(id) {
    output.setRollbackPoint();
    const targets = layers.isSelected(id) ? layers.selectedIds : [id];
    const belowId = query.below(query.lowermost(targets));
    layers.deleteLayers(targets);
    const newSelectId = layers.has(belowId) ? belowId : query.lowermost();
    layerPanel.setRange(newSelectId, newSelectId);
    if (newSelectId) {
        layerPanel.setScrollRule({
            type: "follow",
            target: newSelectId
        });
    }
    output.commit();
}

function ensureBlockVisibility({
    type,
    target
}) {
    const container = listElement.value;
    const row = container?.querySelector(`.layer[data-id="${target}"]`);
    if (!row) return;

    const containerRect = container.getBoundingClientRect(),
        rowRect = row.getBoundingClientRect();
    const viewTop = container.scrollTop,
        viewBottom = viewTop + container.clientHeight;
    const elTop = rowRect.top - containerRect.top + container.scrollTop,
        elBottom = elTop + rowRect.height;

    let scrollToPosition
    if (viewTop < elBottom && elTop < viewBottom) {
        // 이동 전 약간이라도 보임
        const half = container.scrollTop + container.clientHeight * 0.5;
        if (type === "follow-up") {
            // 위로 이동
            if (half < elTop)
                scrollToPosition = container.scrollTop;
            else {
                // 상단에 위치함
                scrollToPosition = elTop - container.clientHeight * 0.5;
            }
        } else if (type === "follow-down") {
            // 아래로 이동
            if (elBottom < half)
                scrollToPosition = container.scrollTop;
            else {
                // 하단에 위치함
                scrollToPosition = elBottom - container.clientHeight * 0.5;
            }
        } else {
            if (elTop < viewTop) {
                // 위로 약간 가림
                scrollToPosition = elTop
            } else if (elBottom > viewBottom) {
                // 아래로 약간 가림
                scrollToPosition = elBottom - container.clientHeight;
            } else {
                scrollToPosition = container.scrollTop;
            }
        }
    } else {
        // 이동 전 전혀 안보임
        if (type === "follow-up")
            // 위로 이동
            scrollToPosition = elTop - container.clientHeight * 0.5;
        else if (type === "follow-down")
            // 아래로 이동
            scrollToPosition = elBottom - container.clientHeight * 0.5;
        else {
            if (elBottom <= viewTop)
                // 위에 있음
                scrollToPosition = elBottom - container.clientHeight * 0.5;
            else if (elTop >= viewBottom)
                // 아래에 있음
                scrollToPosition = elTop - container.clientHeight * 0.5;
        }
    }

    const max = Math.max(0, container.scrollHeight - container.clientHeight);
    container.scrollTo({
        top: clamp(scrollToPosition, 0, max),
        behavior: 'smooth'
    });
}

  watch(() => layerPanel.scrollRule, rule => nextTick(() => ensureBlockVisibility(rule)));

function startRename(id) {
    output.setRollbackPoint();
    const element = document.querySelector(`.layer[data-id="${id}"] .nameText`);
    element.contentEditable = true;
    const range = document.createRange();
    range.selectNodeContents(element);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    element.focus();
    layerPanel.setScrollRule({
        type: "follow",
        target: id
    });
}

function finishRename(id, event) {
    const element = document.querySelector(`.layer[data-id="${id}"] .nameText`);
    element.contentEditable = false;
    const oldName = layers.getProperty(id, 'name');
    const text = event.target.innerText.trim();
    editingId.value = null;
    if (text && text !== oldName) {
        layers.updateProperties(id, { name: text });
        output.commit();
    } else {
        event.target.innerText = oldName;
        output.clearRollbackPoint();
    }
    layerPanel.setScrollRule({
        type: "follow",
        target: id
    });
}

function onNameKey(id, event) {
    const name = layers.getProperty(id, 'name');
    if (event.key === 'Enter') {
        event.preventDefault();
        event.target.blur();
    }
    if (event.key === 'Escape') {
        event.preventDefault();
        event.target.innerText = name;
        event.target.blur();
    }
}

function handleGlobalPointerDown(event) {
    const target = event.target;
    const stageEl = stageService.element;
    const isStage = stageEl && stageEl.contains(target);
    const isLayers = listElement.value && listElement.value.contains(target);
    const isButton = !!target.closest('button');
    if (isStage || isLayers || isButton) return;
      layers.clearSelection();
  }

onMounted(() => {
    window.addEventListener('pointerdown', handleGlobalPointerDown, {
        capture: true
    });
});
onUnmounted(() => {
    window.removeEventListener('pointerdown', handleGlobalPointerDown, {
        capture: true
    });
});
</script>
