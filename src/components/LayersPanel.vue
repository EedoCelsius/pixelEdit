<template>
  <div v-memo="[output.commitVersion, layers.selectedIds, layers.count]" ref="listElement" class="layers flex-1 overflow-auto p-2 flex flex-col gap-2 relative" :class="{ dragging: dragging }" @dragover.prevent @drop.prevent>
    <div v-for="item in panelItems" :key="item.type+'-'+item.id" :data-id="item.id" :style="{ marginLeft: (item.depth*16)+'px' }" :class="[item.type==='layer'? 'layer':'group', 'flex items-center gap-3 p-2 border border-white/15 rounded-lg bg-sky-950/30 cursor-grab select-none', { selected: item.type==='layer' && layers.isSelected(item.id), anchor: item.type==='layer' && layerPanel.anchorId===item.id, dragging: dragId===item.id }]" draggable="true" @click="item.type==='layer' && layerPanel.onLayerClick(item.id,$event)" @dragstart="onDragStart(item.id,$event)" @dragend="onDragEnd" @dragover.prevent="onDragOver(item.id,$event)" @dragleave="onDragLeave($event)" @drop.prevent="onDrop(item.id,$event)">
      <template v-if="item.type==='layer'">
        <div @click.stop="onThumbnailClick(item.id)" class="w-16 h-16 rounded-md border border-white/15 bg-slate-950 overflow-hidden cursor-pointer" title="같은 색상의 모든 레이어 선택">
          <svg :viewBox="viewportStore.viewBox" preserveAspectRatio="xMidYMid meet" class="w-full h-full">
            <rect x="0" y="0" :width="viewportStore.stage.width" :height="viewportStore.stage.height" :fill="patternUrl"/>
            <path :d="layers.pathOf(item.id)" :fill="rgbaCssU32(item.color)" :opacity="item.visibility?1:0.3" fill-rule="evenodd" shape-rendering="crispEdges"/>
          </svg>
        </div>
        <div class="h-6 w-6 rounded border border-white/25 p-0 relative overflow-hidden">
          <input type="color" class="h-10 w-10 p-0 cursor-pointer absolute -top-2 -left-2" :class="{ 'cursor-not-allowed': item.locked }" :disabled="item.locked" :value="rgbaToHexU32(item.color)" @pointerdown.stop @mousedown.stop @click.stop="onColorDown()" @input.stop="onColorInput(item.id, $event)" @change.stop="onColorChange()" title="색상 변경" />
        </div>
        <div class="min-w-0 flex-1">
          <div class="name font-semibold truncate text-sm pointer-events-none" title="더블클릭으로 이름 편집">
            <span class="nameText pointer-events-auto inline-block max-w-full whitespace-nowrap overflow-hidden text-ellipsis" @dblclick="startRename(item.id)" @keydown="onNameKey(item.id,$event)" @blur="finishRename(item.id,$event)">{{ item.name }}</span>
          </div>
          <div class="text-xs text-slate-400">
            <template v-if="layers.disconnectedCountOf(item.id) > 1">
              <span class="cursor-pointer" @click.stop="onDisconnectedClick(item.id)">⚠️</span>
              <span class="cursor-pointer" @click.stop="onDisconnectedCountClick(item.id)">{{ layers.disconnectedCountOf(item.id) }} piece</span>
              <span class="mx-1">|</span>
            </template>
            <span class="cursor-pointer" @click.stop="onPixelCountClick(item.id)" title="같은 크기의 모든 레이어 선택">{{ item.pixels.length }} px</span>
          </div>
        </div>
        <div class="flex gap-1 justify-end">
          <div class="inline-flex items-center justify-center w-7 h-7 rounded-md" title="보이기/숨기기">
            <img :src="(item.visibility?icons.show:icons.hide)" alt="show/hide" class="w-4 h-4 cursor-pointer" @error="icons.show=icons.hide=''" @click.stop="toggleVisibility(item.id)" />
          </div>
          <div class="inline-flex items-center justify-center w-7 h-7 rounded-md" title="잠금/해제">
            <img :src="(item.locked?icons.lock:icons.unlock)" alt="lock/unlock" class="w-4 h-4 cursor-pointer" @error="icons.lock=icons.unlock=''" @click.stop="toggleLock(item.id)" />
          </div>
          <div class="inline-flex items-center justify-center w-7 h-7 rounded-md" title="삭제">
            <img :src="icons.del" alt="delete" class="w-4 h-4 cursor-pointer" @error="icons.del=''" @click.stop="deleteLayer(item.id)" />
          </div>
        </div>
      </template>
      <template v-else>
        <div class="w-4 text-center cursor-pointer" @click.stop="toggleGroupExpanded(item.id)">{{ item.expanded ? '▼' : '▶' }}</div>
        <div class="flex-1 font-semibold truncate">{{ item.name }}</div>
        <div class="flex gap-1 justify-end">
          <div class="inline-flex items-center justify-center w-7 h-7 rounded-md" title="보이기/숨기기">
            <img :src="(item.visibility?icons.show:icons.hide)" alt="show/hide" class="w-4 h-4 cursor-pointer" @error="icons.show=icons.hide=''" @click.stop="toggleGroupVisibility(item.id)" />
          </div>
          <div class="inline-flex items-center justify-center w-7 h-7 rounded-md" title="잠금/해제">
            <img :src="(item.locked?icons.lock:icons.unlock)" alt="lock/unlock" class="w-4 h-4 cursor-pointer" @error="icons.lock=icons.unlock=''" @click.stop="toggleGroupLock(item.id)" />
          </div>
        </div>
      </template>
    </div>
    <div v-show="layers.idsTopToBottom.length===0" class="text-xs text-slate-400/80 py-6 text-center">(레이어가 없습니다)</div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { useStore } from '../stores';
import { rgbaCssU32, rgbaToHexU32, hexToRgbaU32, clamp, ensureCheckerboardPattern } from '../utils';
import blockIcons from '../image/layer_block';

import { useService } from '../services';

const { viewport: viewportStore, layers, output } = useStore();
const { layerPanel, query, viewport } = useService();

const dragging = ref(false);
const dragId = ref(null);
const editingId = ref(null);
const listElement = ref(null);
const icons = reactive(blockIcons);

const patternUrl = computed(() => `url(#${ensureCheckerboardPattern(document.body)})`);

const panelItems = computed(() => {
    const items = [];
    const walk = (nodes, depth = 0) => {
        for (const n of nodes) {
            items.push({ ...n, depth });
            if (n.type === 'group' && n.expanded) walk(n.children, depth + 1);
        }
    };
    walk(layers.tree, 0);
    return items;
});

function toggleGroupVisibility(id) {
    output.setRollbackPoint();
    layers.toggleGroupVisibility(id);
    output.commit();
}

function toggleGroupLock(id) {
    output.setRollbackPoint();
    layers.toggleGroupLock(id);
    output.commit();
}

function toggleGroupExpanded(id) {
    layers.toggleGroupExpanded(id);
}


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
    const ids = layers.has(dragId.value) && layers.isSelected(dragId.value) ? layers.selectedIds : [dragId.value];
    layers.reorderNodes(ids, targetId, placeBelow);
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
        const value = !layers.getProperty(id, 'visibility');
        for (const sid of layers.selectedIds) {
            layers.updateProperties(sid, { visibility: value });
        }
    } else {
        layers.toggleVisibility(id);
    }
    output.commit();
}

function toggleLock(id) {
    output.setRollbackPoint();
    if (layers.isSelected(id)) {
        const value = !layers.getProperty(id, 'locked');
        for (const sid of layers.selectedIds) {
            layers.updateProperties(sid, { locked: value });
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
    const stageEl = viewport.element;
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

<style scoped>
/* 레이어 재정렬 표시 */
.insert-before{box-shadow:inset 0 3px 0 0 rgba(56,189,248,.7)}
.insert-after{box-shadow:inset 0 -3px 0 0 rgba(56,189,248,.7)}

/* 선택 강조 */
.layer.selected{
  outline:2px solid rgba(56,189,248,.70);
  background:linear-gradient(180deg,rgba(56,189,248,.12),rgba(56,189,248,.05));
  border-color:rgba(56,189,248,.35)
}
.layer.selected.anchor{
  outline:3px solid rgba(56,189,248,.95);
  background:linear-gradient(180deg,rgba(56,189,248,.18),rgba(56,189,248,.07));
  border-color:rgba(56,189,248,.6)
}

/* 드래그/이름편집 UX */
.layers.dragging,.layers .layer.dragging{cursor:grabbing!important}
</style>
