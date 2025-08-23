<template>
  <div v-memo="[output.commitVersion, selection.ids]" ref="listElement" class="layers flex-1 overflow-auto p-2 flex flex-col gap-2 relative" :class="{ dragging: dragging }" @dragover.prevent @drop.prevent>
    <div v-for="id in layers.idsTopToBottom" class="layer flex items-center gap-3 p-2 border border-white/15 rounded-lg bg-sky-950/30 cursor-grab select-none" :key="id" :data-id="id" :class="{ selected: selection.isSelected(id), anchor: selection.anchorId===id, dragging: dragId===id }" draggable="true" @click="onLayerClick(id,$event)" @dragstart="onDragStart(id,$event)" @dragend="onDragEnd" @dragover.prevent="onDragOver(id,$event)" @dragleave="onDragLeave($event)" @drop.prevent="onDrop(id,$event)">
      <!-- 썸네일 -->
      <div @click.stop="onThumbnailClick(id)" class="w-16 h-16 rounded-md border border-white/15 bg-slate-950 overflow-hidden cursor-pointer" title="같은 색상의 모든 레이어 선택">
        <svg :viewBox="stageStore.viewBox" preserveAspectRatio="xMidYMid meet" class="w-full h-full">
          <rect x="0" y="0" :width="stageStore.canvas.width" :height="stageStore.canvas.height" :fill="patternUrl"/>
          <path :d="layers.pathOf(id)" :fill="rgbaCssU32(layers.colorOf(id))" :opacity="layers.visibilityOf(id)?1:0.3" fill-rule="evenodd" shape-rendering="crispEdges"/>
        </svg>
      </div>
      <!-- 색상 -->
      <div class="h-6 w-6 rounded border border-white/25 p-0 relative overflow-hidden">
        <input type="color" class="h-10 w-10 p-0 cursor-pointer absolute -top-2 -left-2" :value="rgbaToHexU32(layers.colorOf(id))" @pointerdown.stop @mousedown.stop @click.stop="onColorDown()" @input.stop="onColorInput(id, $event)" @change.stop="onColorChange()" title="색상 변경" />
      </div>
      <!-- 이름/픽셀 -->
      <div class="min-w-0 flex-1">
        <div class="name font-semibold truncate text-sm pointer-events-none" title="더블클릭으로 이름 편집">
          <span class="nameText pointer-events-auto inline-block max-w-full whitespace-nowrap overflow-hidden text-ellipsis" @dblclick="startRename(id)" @keydown="onNameKey(id,$event)" @blur="finishRename(id,$event)">{{ layers.nameOf(id) }}</span>
        </div>
        <div class="text-xs text-slate-400">
          <span class="cursor-pointer" @click.stop="onPixelCountClick(id)" title="같은 크기의 모든 레이어 선택">{{ layers.pixelCountOf(id) }} px</span>
          <template v-if="layers.disconnectedCountOf(id) > 1">
            <span class="mx-1">|</span>
            <span class="cursor-pointer" @click.stop="onDisconnectedClick(id)">Disconnected</span>:
            <span class="cursor-pointer" @click.stop="onDisconnectedCountClick(id)">{{ layers.disconnectedCountOf(id) }}</span>
          </template>
        </div>
      </div>
      <!-- 액션 -->
      <div class="flex gap-1 justify-end">
        <div class="inline-flex items-center justify-center w-7 h-7 rounded-md" title="보이기/숨기기">
          <img :src="(layers.visibilityOf(id)?icons.show:icons.hide)" alt="show/hide" class="w-4 h-4 cursor-pointer" @error="icons.show=icons.hide=''" @click.stop="toggleVisibility(id)" />
        </div>
        <div class="inline-flex items-center justify-center w-7 h-7 rounded-md" title="삭제">
          <img :src="icons.del" alt="delete" class="w-4 h-4 cursor-pointer" @error="icons.del=''" @click.stop="deleteLayer(id)" />
        </div>
      </div>
    </div>
    <div v-show="layers.idsTopToBottom.length===0" class="text-xs text-slate-400/80 py-6 text-center">(레이어가 없습니다)</div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { useStageStore } from '../stores/stage';
import { useStageService } from '../services/stage';
import { useLayerStore } from '../stores/layers';
import { useSelectionStore } from '../stores/selection';
import { useLayerService } from '../services/layers';
import { useSelectService } from '../services/select';
import { useOutputStore } from '../stores/output';
import { rgbaCssU32, rgbaToHexU32, hexToRgbaU32, coordsToKey, clamp } from '../utils';

const stageStore = useStageStore();
const stageService = useStageService();
const layers = useLayerStore();
const selection = useSelectionStore();
const layerSvc = useLayerService();
const selectSvc = useSelectService();
const output = useOutputStore();

const dragging = ref(false);
const dragId = ref(null);
const editingId = ref(null);
const listElement = ref(null);
const icons = reactive({
    show: 'image/layer_block/show.svg',
    hide: 'image/layer_block/hide.svg',
    del: 'image/layer_block/delete.svg'
});

const patternUrl = computed(() => `url(#${stageService.ensureCheckerboardPattern(document.body)})`);

function onLayerClick(id, event) {
    if (event.shiftKey) {
        selectSvc.selectRange(selection.anchorId ?? id, id);
    } else if (event.ctrlKey || event.metaKey) {
        selection.toggle(id);
    } else {
        selection.selectOne(id);
    }
    selection.setScrollRule({
        type: "follow",
        target: id
    });
}

function onThumbnailClick(id) {
    layerSvc.selectByColor(id);
    selection.setScrollRule({
        type: "follow",
        target: id
    });
}

function onPixelCountClick(id) {
    layerSvc.selectByPixelCount(id);
    selection.setScrollRule({
        type: "follow",
        target: id
    });
}

function onDisconnectedClick(id) {
    layerSvc.selectDisconnectedLayers(id);
    selection.setScrollRule({
        type: "follow",
        target: id
    });
}

function onDisconnectedCountClick(id) {
    layerSvc.selectByDisconnectedCount(id);
    selection.setScrollRule({
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
    if (selection.isSelected(id)) {
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
    layers.reorderLayers(selection.ids, targetId, placeBelow);
    output.commit();
}

function onColorDown() {
    output.setRollbackPoint();
}

function onColorInput(id, event) {
    const colorU32 = hexToRgbaU32(event.target.value);
    selection.isSelected(id) ? layerSvc.setColorForSelectedU32(colorU32) : layers.updateLayer(id, { colorU32 });
}

function onColorChange() {
    output.commit();
}

function toggleVisibility(id) {
    output.setRollbackPoint();
    if (selection.isSelected(id)) layerSvc.setVisibilityForSelected(!layers.visibilityOf(id));
    else layers.toggleVisibility(id);
    output.commit();
}

function deleteLayer(id) {
    output.setRollbackPoint();
    const targets = selection.isSelected(id) ? selection.ids : [id];
    const belowId = layers.belowId(layers.lowermostIdOf(targets));
    layers.deleteLayers(targets);
    const newSelectId = layers.has(belowId) ? belowId : layers.lowermostId;
    selection.selectOne(newSelectId);
    if (newSelectId) {
        selection.setScrollRule({
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

watch(() => selection.scrollRule, rule => nextTick(() => ensureBlockVisibility(rule)));

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
    selection.setScrollRule({
        type: "follow",
        target: id
    });
}

function finishRename(id, event) {
    const element = document.querySelector(`.layer[data-id="${id}"] .nameText`);
    element.contentEditable = false;
    const oldName = layers.nameOf(id);
    const text = event.target.innerText.trim();
    editingId.value = null;
    if (text && text !== oldName) {
        layers.updateLayer(id, { name: text });
        output.commit();
    } else {
        event.target.innerText = oldName;
        output.clearRollbackPoint();
    }
    selection.setScrollRule({
        type: "follow",
        target: id
    });
}

function onNameKey(id, event) {
    const name = layers.nameOf(id);
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
    const stageEl = document.getElementById('stage');
    const isStage = stageEl && stageEl.contains(target);
    const isLayers = listElement.value && listElement.value.contains(target);
    const isButton = !!target.closest('button');
    if (isStage || isLayers || isButton) return;
    selection.clear();
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
