<template>
  <div v-memo="[output.commitVersion, nodeTree.selectedLayerIds, nodeTree.layerCount, foldedMemo]" ref="listElement" class="layers flex-1 overflow-auto p-2 flex flex-col gap-2 relative" :class="{ dragging: dragging }" @dragover.prevent @drop.prevent>
    <div v-for="item in flatNodes" class="layer group relative flex flex-none items-center gap-3 p-2 border border-white/15 rounded-lg bg-sky-950/30 cursor-grab select-none overflow-hidden" :key="item.id" :data-id="item.id" :style="{ marginLeft: (item.depth * 32) + 'px' }" :class="{ selected: nodeTree.selectedNodeIds.includes(item.id), anchor: layerPanel.anchorId===item.id, dragging: dragId===item.id, 'descendant-selected': ancestorsOfSelected.has(item.id) }" draggable="true" @click="layerPanel.onLayerClick(item.id,$event)" @dragstart="onDragStart(item.id,$event)" @dragend="onDragEnd" @dragover.prevent="onDragOver(item,$event)" @dragleave="onDragLeave($event)" @drop.prevent="onDrop(item,$event)" @contextmenu.prevent="onContextMenu(item,$event)">
      <template v-if="item.isGroup">
        <div class="w-4 text-center cursor-pointer" @click.stop="toggleFold(item.id)">{{ folded[item.id] ? '▶' : '▼' }}</div>
        <div class="w-16 h-16 rounded-md border border-white/15 bg-slate-950 overflow-hidden" title="그룹 미리보기">
          <svg :viewBox="viewportStore.viewBox" preserveAspectRatio="xMidYMid meet" class="w-full h-full">
            <rect x="0" y="0" :width="viewportStore.stage.width" :height="viewportStore.stage.height" :fill="patternUrl"/>
            <path v-for="child in descendantProps(item.id)" :key="child.id" :d="pixelStore.pathOfLayer(child.id)" :fill="rgbaCssU32(child.color)" :opacity="child.visibility?1:0.3" fill-rule="evenodd" shape-rendering="crispEdges"/>
          </svg>
        </div>
        <div class="min-w-0 flex-1 relative overflow-hidden fade-mask">
          <div class="name font-semibold truncate text-sm pointer-events-none" title="더블클릭으로 이름 편집">
            <span class="nameText pointer-events-auto inline-block max-w-full whitespace-nowrap overflow-hidden text-ellipsis" @dblclick="startRename(item.id)" @keydown="onNameKey(item.id,$event)" @blur="finishRename(item.id,$event)">{{ item.props.name }}</span>
          </div>
          <div class="text-xs text-slate-400">
            <span>{{ getPixelUnion(descendantPixels(item.id)).length }}px</span>
            <span class="mx-1">|</span>
            <span>{{ nodeTree.descendantLayerIds(item.id).length }} Layers</span>
          </div>
        </div>
        <div class="absolute inset-y-0 right-0 flex items-center gap-1 pr-2 pl-6 bg-gradient-to-l from-sky-950/80 to-sky-950/0 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity">
          <div class="inline-flex items-center justify-center w-7 h-7 rounded-md" title="보이기/숨기기">
            <img :src="(item.props.visibility?icons.show:icons.hide)" alt="show/hide" class="w-4 h-4 cursor-pointer" @error="icons.show=icons.hide=''" @click.stop="toggleVisibility(item.id)" />
          </div>
          <div class="inline-flex items-center justify-center w-7 h-7 rounded-md" title="잠금/해제">
            <img :src="(item.props.locked?icons.lock:icons.unlock)" alt="lock/unlock" class="w-4 h-4 cursor-pointer" @error="icons.lock=icons.unlock=''" @click.stop="toggleLock(item.id)" />
          </div>
          <div class="inline-flex items-center justify-center w-7 h-7 rounded-md" title="삭제">
            <img :src="icons.del" alt="delete" class="w-4 h-4 cursor-pointer" @error="icons.del=''" @click.stop="deleteNode(item.id)" />
          </div>
        </div>
      </template>
      <template v-else>
        <!-- 썸네일 -->
        <div v-if="item.depth===0" @click.stop="onThumbnailClick(item.id)" class="w-16 h-16 rounded-md border border-white/15 bg-slate-950 overflow-hidden cursor-pointer" title="같은 색상의 모든 레이어 선택">
          <svg :viewBox="viewportStore.viewBox" preserveAspectRatio="xMidYMid meet" class="w-full h-full">
            <rect x="0" y="0" :width="viewportStore.stage.width" :height="viewportStore.stage.height" :fill="patternUrl"/>
            <path :d="pixelStore.pathOfLayer(item.id)" :fill="rgbaCssU32(item.props.color)" :opacity="item.props.visibility?1:0.3" fill-rule="evenodd" shape-rendering="crispEdges"/>
          </svg>
        </div>
        <!-- 색상 -->
        <div class="h-6 w-6 rounded border border-white/25 p-0 relative overflow-hidden">
          <input type="color" class="h-10 w-10 p-0 cursor-pointer absolute -top-2 -left-2" :class="{ 'cursor-not-allowed': item.props.locked }" :disabled="item.props.locked" :value="rgbaToHexU32(item.props.color)" @pointerdown.stop @mousedown.stop @click.stop="onColorDown()" @input.stop="onColorInput(item.id, $event)" @change.stop="onColorChange()" title="색상 변경" />
        </div>
        <!-- 이름/픽셀 -->
        <div class="min-w-0 flex-1 relative overflow-hidden fade-mask">
          <div class="name font-semibold truncate text-sm pointer-events-none" title="더블클릭으로 이름 편집">
            <span class="nameText pointer-events-auto inline-block max-w-full whitespace-nowrap overflow-hidden text-ellipsis" @dblclick="startRename(item.id)" @keydown="onNameKey(item.id,$event)" @blur="finishRename(item.id,$event)">{{ item.props.name }}</span>
          </div>
          <div class="text-xs text-slate-400">
            <template v-if="pixelStore.disconnectedCountOfLayer(item.id) > 1">
              <span class="cursor-pointer" @click.stop="onDisconnectedClick(item.id)">⚠️</span>
              <span class="cursor-pointer" @click.stop="onPixelCountClick(item.id)" title="같은 크기의 모든 레이어 선택">{{ item.props.pixels.length }}px</span>
              <span class="mx-1">|</span>
              <span class="cursor-pointer" @click.stop="onDisconnectedCountClick(item.id)">{{ pixelStore.disconnectedCountOfLayer(item.id) }} Pieces</span>
            </template>
            <template v-else>
              <span class="cursor-pointer" @click.stop="onPixelCountClick(item.id)" title="같은 크기의 모든 레이어 선택">{{ item.props.pixels.length }}px</span>
            </template>
          </div>
        </div>
        <!-- 액션 -->
        <div class="absolute inset-y-0 right-0 flex items-center gap-1 pr-2 pl-6 bg-gradient-to-l from-sky-950/80 to-sky-950/0 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity">
          <div class="inline-flex items-center justify-center w-7 h-7 rounded-md" title="보이기/숨기기">
            <img :src="(item.props.visibility?icons.show:icons.hide)" alt="show/hide" class="w-4 h-4 cursor-pointer" @error="icons.show=icons.hide=''" @click.stop="toggleVisibility(item.id)" />
          </div>
          <div class="inline-flex items-center justify-center w-7 h-7 rounded-md" title="잠금/해제">
            <img :src="(item.props.locked?icons.lock:icons.unlock)" alt="lock/unlock" class="w-4 h-4 cursor-pointer" @error="icons.lock=icons.unlock=''" @click.stop="toggleLock(item.id)" />
          </div>
          <div class="inline-flex items-center justify-center w-7 h-7 rounded-md" title="삭제">
            <img :src="icons.del" alt="delete" class="w-4 h-4 cursor-pointer" @error="icons.del=''" @click.stop="deleteNode(item.id)" />
          </div>
        </div>
      </template>
    </div>
    <div v-show="flatNodes.length===0" class="text-xs text-slate-400/80 py-6 text-center">(레이어가 없습니다)</div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { useStore } from '../stores';
import { rgbaCssU32, rgbaToHexU32, hexToRgbaU32, clamp, ensureCheckerboardPattern, getPixelUnion } from '../utils';
import blockIcons from '../image/layer_block';

import { useService } from '../services';
import { useContextMenuStore } from '../stores/contextMenu';

const { viewport: viewportStore, nodeTree, nodes, pixels: pixelStore, output } = useStore();
const { layerPanel, layerQuery, nodeQuery, viewport, stageResize: stageResizeService, layerTool: layerSvc, clipboard } = useService();
const contextMenu = useContextMenuStore();

const dragging = ref(false);
const dragId = ref(null);
const editingId = ref(null);
const listElement = ref(null);
const icons = reactive(blockIcons);
const folded = layerPanel.folded;
const foldedMemo = computed(() => JSON.stringify(folded));

const flatNodes = computed(() => {
  const ids = [];
  const depths = [];
  const walk = (list, depth) => {
    for (let i = list.length - 1; i >= 0; i--) {
      const node = list[i];
      ids.push(node.id);
      depths.push(depth);
      if (node.children && !folded[node.id]) walk(node.children, depth + 1);
    }
  };
  walk(nodeTree.tree, 0);
  const propsList = nodes.getProperties(ids);
  const pixelList = pixelStore.getProperties(ids);
  return ids.map((id, i) => ({ id, depth: depths[i], isGroup: propsList[i].type === 'group', props: { ...propsList[i], pixels: pixelList[i].pixels } }));
});

const ancestorsOfSelected = computed(() => {
  nodeTree.tree;
  const selected = new Set(nodeTree.selectedNodeIds);
  const result = new Set();
  for (const id of selected) {
    let info = nodeTree._findNode(id);
    let parent = info?.parent;
    while (parent) {
      if (!selected.has(parent.id)) result.add(parent.id);
      parent = nodeTree._findNode(parent.id)?.parent;
    }
  }
  return result;
});

const patternUrl = computed(() => `url(#${ensureCheckerboardPattern(document.body)})`);

function toggleFold(id) {
  layerPanel.toggleFold(id);
}

function descendantProps(id) {
  const ids = nodeTree.descendantLayerIds(id);
  return nodes.getProperties(ids);
}

function descendantPixels(id) {
  const ids = nodeTree.descendantLayerIds(id);
  return pixelStore.getProperties(ids);
}

  function onThumbnailClick(id) {
      const color = nodes.getProperty(id, 'color');
      const ids = layerQuery.byColor(color);
      if (ids.length) {
          nodeTree.replaceSelection(ids);
          layerPanel.clearRange();
      }
      layerPanel.setScrollRule({
          type: "follow",
          target: id
      });
  }

  function onPixelCountClick(id) {
      const count = pixelStore.get(id).length;
      const ids = count === 0 ? [id] : layerQuery.byPixelCount(count);
      if (ids.length <= 1) {
          layerPanel.setRange(id, id);
      } else {
          nodeTree.replaceSelection(ids);
          layerPanel.clearRange();
      }
      layerPanel.setScrollRule({
          type: "follow",
          target: id
      });
  }

  function onDisconnectedClick(id) {
      const ids = layerQuery.disconnected();
      if (ids.length) {
          nodeTree.replaceSelection(ids);
          layerPanel.clearRange();
      }
      layerPanel.setScrollRule({
          type: "follow",
          target: id
      });
  }

  function onDisconnectedCountClick(id) {
      const count = pixelStore.disconnectedCountOfLayer(id);
      const ids = count <= 1 ? [id] : layerQuery.byDisconnectedCount(count);
      if (ids.length <= 1) {
          layerPanel.setRange(id, id);
      } else {
          nodeTree.replaceSelection(ids);
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

function onDragOver(item, event) {
    const row = event.currentTarget;
    if (nodeTree.selectedNodeIds.includes(item.id)) {
        row.classList.remove('insert-before', 'insert-after', 'insert-into');
        event.dataTransfer.dropEffect = 'none';
        return;
    }
    const rect = row.getBoundingClientRect();
    const y = event.clientY - rect.top;
    row.classList.remove('insert-before', 'insert-after', 'insert-into');
    if (item.isGroup && y > rect.height / 3 && y < rect.height * 2 / 3) {
        row.classList.add('insert-into');
    } else {
        const before = y < rect.height * 0.5;
        row.classList.add(before ? 'insert-before' : 'insert-after');
    }
}

function onDragLeave(event) {
    event.currentTarget.classList.remove('insert-before', 'insert-after', 'insert-into');
}

function onDrop(item, event) {
    const row = event.currentTarget;
    row.classList.remove('insert-before', 'insert-after', 'insert-into');
    const rect = row.getBoundingClientRect();
    const y = event.clientY - rect.top;
    const ids = nodeTree.orderedSelection;
    if (item.isGroup && y > rect.height / 3 && y < rect.height * 2 / 3) {
        nodeTree.append(ids, item.id, true);
    } else {
        const placeBelow = y > rect.height * 0.5;
        nodeTree.insert(ids, item.id, placeBelow);
    }
    output.commit();
}

function onColorDown() {
    output.setRollbackPoint();
}

function onColorInput(id, event) {
    const colorU32 = hexToRgbaU32(event.target.value);
    if (nodeTree.selectedNodeIds.includes(id)) {
        for (const sid of nodeTree.selectedLayerIds) {
            nodes.update(sid, { color: colorU32 });
        }
    } else {
        nodes.update(id, { color: colorU32 });
    }
}

function onColorChange() {
    output.commit();
}

function toggleVisibility(id) {
    output.setRollbackPoint();
    if (nodeTree.selectedNodeIds.includes(id)) {
        const value = !nodes.getProperty(id, 'visibility');
        for (const sid of nodeTree.selectedNodeIds) {
            nodes.update(sid, { visibility: value });
        }
    } else {
        nodes.toggleVisibility(id);
    }
    output.commit();
}

function toggleLock(id) {
    output.setRollbackPoint();
    if (nodeTree.selectedNodeIds.includes(id)) {
        const value = !nodes.getProperty(id, 'locked');
        for (const sid of nodeTree.selectedNodeIds) {
            nodes.update(sid, { locked: value });
        }
    } else {
        nodes.toggleLock(id);
    }
    output.commit();
}

function onContextMenu(item, event) {
    if (!nodeTree.selectedIds.includes(item.id)) {
        layerPanel.setRange(item.id, item.id);
    }
    const selected = nodeTree.selectedIds;
    let flipEnabled = false;
    if (selected.length === 1) {
        flipEnabled = nodes.getProperty(selected[0], 'type') === 'group';
    } else if (selected.length > 1) {
        const infos = selected.map(id => nodeTree._findNode(id));
        if (infos.every(info => info && info.parent === infos[0].parent)) flipEnabled = true;
    }
    const items = [
        {
            label: 'Group',
            action: () => {
                output.setRollbackPoint();
                const ordered = nodeTree.orderedSelection;
                nodeTree.replaceSelection(ordered);
                const id = layerSvc.groupSelected();
                layerPanel.setRange(id, id);
                layerPanel.setScrollRule({ type: 'follow', target: id });
                output.commit();
            }
        },
        {
            label: 'Copy',
            action: () => {
                clipboard.copySelection();
            }
        },
        {
            label: 'Paste',
            action: () => {
                clipboard.paste();
            }
        },
        {
            label: 'Flip Order',
            disabled: !flipEnabled,
            action: () => {
                if (!flipEnabled) return;
                output.setRollbackPoint();
                layerSvc.flipOrderSelected();
                output.commit();
            }
        }
    ];
    if (item.isGroup) {
        items.push({
            label: 'Ungroup',
            action: () => {
                output.setRollbackPoint();
                layerSvc.ungroupSelected();
                output.commit();
            }
        });
    }
    contextMenu.open(event, items);
}

function deleteNode(id) {
    output.setRollbackPoint();
    const targets = nodeTree.selectedNodeIds.includes(id) ? nodeTree.selectedIds : [id];
    const lowermostTarget = nodeQuery.lowermost(targets);
    const parentId = nodeQuery.parentOf(lowermostTarget);
    const belowId = nodeQuery.below(lowermostTarget);
    const removed = nodeTree.remove(targets);
    nodes.remove(removed);
    pixelStore.remove(removed);
    let newSelectId = null;
    if (nodeTree.has(belowId)) {
        newSelectId = belowId;
    } else {
        const siblings = nodeQuery.childrenOf(parentId);
        const lowermostSibling = nodeQuery.lowermost(siblings);
        if (nodeTree.has(lowermostSibling)) {
            newSelectId = lowermostSibling;
        } else if (nodeTree.has(parentId)) {
            newSelectId = parentId;
        }
    }
    layerPanel.setRange(newSelectId, newSelectId);
    if (newSelectId) {
        layerPanel.setScrollRule({ type: 'follow', target: newSelectId });
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
    const oldName = nodes.getProperty(id, 'name');
    const text = event.target.innerText.trim();
    editingId.value = null;
    if (text && text !== oldName) {
        nodes.update(id, { name: text });
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
    const name = nodes.getProperty(id, 'name');
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
    if (stageResizeService.show) return;
    const target = event.target;
    const viewportEl = viewport.element;
    const stageEl = document.getElementById('stage');
    const isViewport = viewportEl && viewportEl.contains(target);
    const isStage = stageEl && stageEl.contains(target);
    const isLayers = listElement.value && listElement.value.contains(target);
    const isButton = !!target.closest('button');
    const isContextMenu = contextMenu.visible;
    if (isLayers || isButton) return;
    if (isViewport && !isStage) {
        let moved = false;
        const pid = event.pointerId;
        const onMove = (e) => { if (e.pointerId === pid) moved = true; };
        const onUp = (e) => {
            if (e.pointerId !== pid) return;
            window.removeEventListener('pointermove', onMove, true);
            if (!moved) nodeTree.clearSelection();
        };
        window.addEventListener('pointermove', onMove, { capture: true });
        window.addEventListener('pointerup', onUp, { capture: true, once: true });
        return;
    }
    if (!isViewport && !isStage && !isLayers && !isButton && !isContextMenu)
        nodeTree.clearSelection();
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
/* 텍스트 그라데이션 마스킹 */
.fade-mask{
  -webkit-mask-image:none;
  mask-image:none;
}
.group:hover .fade-mask{
  -webkit-mask-image:linear-gradient(to right,#000,#000 calc(100% - 10rem),transparent calc(100% - 5rem),transparent);
  mask-image:linear-gradient(to right,#000,#000 calc(100% - 10rem),transparent calc(100% - 5rem),transparent);
}
/* 레이어 재정렬 표시 */
.insert-before{box-shadow:inset 0 3px 0 0 rgba(56,189,248,.7)}
.insert-after{box-shadow:inset 0 -3px 0 0 rgba(56,189,248,.7)}
.insert-into{box-shadow:inset 0 0 0 2px rgba(56,189,248,.7)}

/* 선택 강조 */
.layer.selected{
  outline:2px solid rgba(56,189,248,.70);
  background:linear-gradient(180deg,rgba(56,189,248,.12),rgba(56,189,248,.05));
}
.layer.selected.anchor{
  outline:3px solid rgba(56,189,248,.95);
  background:linear-gradient(180deg,rgba(56,189,248,.18),rgba(56,189,248,.07));
}

.layer.descendant-selected{
  border-color:rgba(56,189,248,.70)
}

/* 드래그/이름편집 UX */
.layers.dragging,.layers .layer.dragging{cursor:grabbing!important}
</style>
