<template>
  <div ref="scrollContainerRef" class="notebook-sidebar-content" @scroll="handleScroll">
    <!-- 新建笔记本按钮 -->
    <button class="create-notebook-btn" @click="showCreateDialog = true">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
        <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
      </svg>
      <span>{{ t('notebook.newNotebook') }}</span>
    </button>

    <!-- 固定的笔记本区域 -->
    <div v-if="pinnedAllNotebooks || pinnedNotebookIds.length > 0" class="pinned-section">
      <!-- 固定的全部笔记本 -->
      <button
        v-if="pinnedAllNotebooks"
        class="notebook-item"
        :class="{ active: activeNotebookId === null }"
        @click="handleSelectAll"
        @contextmenu.prevent="handleContextMenu($event, null, 'all')"
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H8V4h12v12z"/>
        </svg>
        <span>{{ t('canvas.allNotebooks') }}</span>
      </button>

      <!-- 固定的具体笔记本 -->
      <button
        v-for="notebook in pinnedNotebooks"
        :key="notebook.id"
        class="notebook-item"
        :class="{ active: activeNotebookId === notebook.id, dragging: draggedPinnedId === notebook.id }"
        draggable="true"
        @click="handleSelectNotebook(notebook.id)"
        @contextmenu.prevent="handleContextMenu($event, notebook, 'pinned')"
        @dragstart="handlePinnedDragStart($event, notebook.id)"
        @dragover.prevent="handlePinnedDragOver($event, notebook.id)"
        @drop.prevent="handlePinnedDrop(notebook.id)"
        @dragend="handlePinnedDragEnd"
      >
        <span v-if="notebook.pdfPath" class="pdf-badge">PDF</span>
        <svg v-else viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          <path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z"/>
        </svg>
        <span>{{ notebook.name }}</span>
      </button>
    </div>

    <!-- 分隔线 -->
    <div class="separator"></div>

    <!-- 所有笔记本区域（可展开） -->
    <div class="all-notebooks-section">
      <button class="expand-btn" @click.stop="isExpanded = !isExpanded">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" :class="{ rotated: isExpanded }">
          <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
        </svg>
        <span>{{ t('nav.notebooks') }}</span>
        <span class="count">{{ notebooks.length }}</span>
      </button>

      <!-- 内联展开的笔记本列表 -->
      <div v-if="isExpanded" class="notebooks-list">
        <button
          v-for="notebook in sortedNotebooks"
          :key="notebook.id"
          class="notebook-item"
          :class="{ active: activeNotebookId === notebook.id }"
          @click="handleSelectNotebook(notebook.id)"
          @contextmenu.prevent="handleContextMenu($event, notebook, 'list')"
        >
          <span v-if="notebook.pdfPath" class="pdf-badge">PDF</span>
          <svg v-else viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z"/>
          </svg>
          <span>{{ notebook.name }}</span>
        </button>
      </div>
    </div>
  </div>

  <!-- 右键菜单 -->
  <Teleport to="body">
    <div
      v-if="contextMenu.visible"
      class="context-menu"
      :style="{ top: contextMenu.y + 'px', left: contextMenu.x + 'px' }"
      @click.stop
    >
      <!-- 全部笔记本菜单 -->
      <template v-if="contextMenu.type === 'all'">
        <button class="menu-item" @click="handleUnpinAllContextMenu">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.5v-6H18v-2l-2-2z"/>
          </svg>
          <span>{{ t('notebook.unpinAll') }}</span>
        </button>
      </template>

      <!-- 具体笔记本菜单 -->
      <template v-else-if="contextMenu.notebook">
        <button class="menu-item" @click="handleOpenCanvas">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M4 4h7v7H4zm0 9h7v7H4zm9-9h7v7h-7zm0 9h7v7h-7z"/>
          </svg>
          <span>{{ t('notebook.openCanvas') }}</span>
        </button>
        <button class="menu-item" @click="handleOpenParticle">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
          <span>{{ t('notebook.openParticle') }}</span>
        </button>
        <div class="menu-divider"></div>
        <button class="menu-item" @click="handleTogglePinContextMenu">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.5v-6H18v-2l-2-2z"/>
          </svg>
          <span>{{ isPinned ? t('notebook.unpin') : t('notebook.pin') }}</span>
        </button>
        <button class="menu-item" @click="handleRename">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.9959.9959 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
          </svg>
          <span>{{ t('notebook.rename') }}</span>
        </button>
        <div class="menu-divider"></div>
        <button class="menu-item danger" @click="handleDelete">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
          </svg>
          <span>{{ t('notebook.delete') }}</span>
        </button>
      </template>
    </div>
  </Teleport>

  <!-- 创建笔记本对话框 -->
  <CreateNotebookDialog
    :visible="showCreateDialog"
    :static-context-files="contextStore.staticContextFiles"
    :dynamic-context-files="contextStore.dynamicContextFiles"
    @close="showCreateDialog = false"
    @create="handleCreateNotebook"
  />

  <!-- 重命名对话框 -->
  <div v-if="showRenameDialog" class="rename-dialog-overlay" @click="showRenameDialog = false">
    <div class="rename-dialog" @click.stop>
      <h3>{{ t('notebook.rename') }}</h3>
      <input
        ref="renameInputRef"
        v-model="renameValue"
        type="text"
        @keyup.enter="confirmRename"
        @keyup.escape="showRenameDialog = false"
      />
      <div class="dialog-actions">
        <button class="cancel-btn" @click="showRenameDialog = false">{{ t('common.cancel') }}</button>
        <button class="confirm-btn" @click="confirmRename">{{ t('common.confirm') }}</button>
      </div>
    </div>
  </div>

  <!-- 删除确认对话框 -->
  <div v-if="showDeleteDialog" class="delete-dialog-overlay" @click="showDeleteDialog = false">
    <div class="delete-dialog" @click.stop>
      <h3>{{ t('notebook.delete') }}</h3>
      <p>{{ t('notebook.deleteConfirm', { name: deleteNotebookName }) }}</p>
      <div class="dialog-actions">
        <button class="cancel-btn" @click="showDeleteDialog = false">{{ t('common.cancel') }}</button>
        <button class="confirm-btn danger" @click="confirmDelete">{{ t('common.delete') }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '@/stores/settingsStore'
import { useNotebookStore } from '@/stores/notebookStore'
import { useContextStore } from '@/stores/contextStore'
import CreateNotebookDialog from '@/components/CreateNotebookDialog.vue'
import type { Notebook } from '@/types/notebook'

const props = defineProps<{
  notebooks: Notebook[]
  activeNotebookId: string | null
  pinnedNotebookIds: string[]
  pinnedAllNotebooks: boolean
}>()

const emit = defineEmits<{
  (e: 'select-notebook', notebookId: string | null): void
  (e: 'create-notebook', data: { name: string; pdfPath?: string; staticContextIds: string[]; dynamicContextId?: string }): void
  (e: 'open-canvas', notebookId: string): void
  (e: 'open-particle', notebookId: string): void
  (e: 'rename-notebook', notebookId: string, newName: string): void
  (e: 'delete-notebook', notebookId: string): void
  (e: 'toggle-pin', notebookId: string): void
  (e: 'toggle-pin-all'): void
  (e: 'reorder-pinned', pinnedIds: string[]): void
}>()

const { t } = useI18n()
const settingsStore = useSettingsStore()
const notebookStore = useNotebookStore()
const contextStore = useContextStore()

const scrollContainerRef = ref<HTMLElement | null>(null)
let scrollbarTimer: ReturnType<typeof setTimeout> | null = null

const isExpanded = ref(true)
const showCreateDialog = ref(false)

// 右键菜单状态
const contextMenu = ref<{
  visible: boolean
  x: number
  y: number
  notebook: Notebook | null
  type: 'all' | 'pinned' | 'list'
}>({
  visible: false,
  x: 0,
  y: 0,
  notebook: null,
  type: 'list'
})

// 重命名对话框状态
const showRenameDialog = ref(false)
const renameValue = ref('')
const renameInputRef = ref<HTMLInputElement | null>(null)

// 删除确认对话框状态
const showDeleteDialog = ref(false)
const deleteNotebookName = ref('')

// 拖动排序状态
const draggedPinnedId = ref<string | null>(null)
const dragOverPinnedId = ref<string | null>(null)

// 固定的笔记本列表
const pinnedNotebooks = computed(() => {
  return props.pinnedNotebookIds
    .map(id => props.notebooks.find(n => n.id === id))
    .filter((n): n is Notebook => n !== undefined)
})

// 按名称排序的笔记本列表
const sortedNotebooks = computed(() => {
  return [...props.notebooks].sort((a, b) => a.name.localeCompare(b.name))
})

// 当前右键菜单的笔记本是否已固定
const isPinned = computed(() => {
  if (!contextMenu.value.notebook) return false
  return props.pinnedNotebookIds.includes(contextMenu.value.notebook.id)
})

function handleSelectAll() {
  emit('select-notebook', null)
}

function handleSelectNotebook(notebookId: string) {
  emit('select-notebook', notebookId)
}

// 右键菜单处理
function handleContextMenu(event: MouseEvent, notebook: Notebook | null, type: 'all' | 'pinned' | 'list') {
  contextMenu.value = {
    visible: true,
    x: event.clientX,
    y: event.clientY,
    notebook,
    type
  }
}

function closeContextMenu() {
  contextMenu.value.visible = false
}

// 全部笔记本菜单操作
function handleUnpinAllContextMenu() {
  emit('toggle-pin-all')
  closeContextMenu()
}

// 具体笔记本菜单操作
function handleOpenCanvas() {
  if (contextMenu.value.notebook) {
    emit('open-canvas', contextMenu.value.notebook.id)
  }
  closeContextMenu()
}

function handleOpenParticle() {
  if (contextMenu.value.notebook) {
    emit('open-particle', contextMenu.value.notebook.id)
  }
  closeContextMenu()
}

function handleTogglePinContextMenu() {
  if (contextMenu.value.notebook) {
    emit('toggle-pin', contextMenu.value.notebook.id)
  }
  closeContextMenu()
}

function handleRename() {
  if (contextMenu.value.notebook) {
    renameValue.value = contextMenu.value.notebook.name
    showRenameDialog.value = true
    nextTick(() => {
      renameInputRef.value?.focus()
      renameInputRef.value?.select()
    })
  }
  closeContextMenu()
}

function confirmRename() {
  if (contextMenu.value.notebook && renameValue.value.trim()) {
    emit('rename-notebook', contextMenu.value.notebook.id, renameValue.value.trim())
  }
  showRenameDialog.value = false
}

function handleDelete() {
  if (contextMenu.value.notebook) {
    deleteNotebookName.value = contextMenu.value.notebook.name
    showDeleteDialog.value = true
  }
  closeContextMenu()
}

function confirmDelete() {
  if (contextMenu.value.notebook) {
    emit('delete-notebook', contextMenu.value.notebook.id)
  }
  showDeleteDialog.value = false
}

function handleCreateNotebook(data: { name: string; pdfPath?: string; staticContextIds: string[]; dynamicContextId?: string }) {
  emit('create-notebook', data)
  showCreateDialog.value = false
}

// 拖动排序函数
function handlePinnedDragStart(e: DragEvent, notebookId: string) {
  draggedPinnedId.value = notebookId
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', notebookId)
  }
}

function handlePinnedDragOver(e: DragEvent, notebookId: string) {
  if (draggedPinnedId.value && draggedPinnedId.value !== notebookId) {
    dragOverPinnedId.value = notebookId
  }
}

function handlePinnedDrop(targetId: string) {
  if (!draggedPinnedId.value || draggedPinnedId.value === targetId) return

  const currentIds = [...props.pinnedNotebookIds]
  const draggedIndex = currentIds.indexOf(draggedPinnedId.value)
  const targetIndex = currentIds.indexOf(targetId)

  if (draggedIndex !== -1 && targetIndex !== -1) {
    // 移动 dragged 到 target 位置
    currentIds.splice(draggedIndex, 1)
    currentIds.splice(targetIndex, 0, draggedPinnedId.value)
    emit('reorder-pinned', currentIds)
  }
}

function handlePinnedDragEnd() {
  draggedPinnedId.value = null
  dragOverPinnedId.value = null
}

// 滚动条显示逻辑
function handleScroll() {
  if (!scrollContainerRef.value) return
  scrollContainerRef.value.classList.add('is-scrolling')
  if (scrollbarTimer !== null) {
    clearTimeout(scrollbarTimer)
  }
  scrollbarTimer = setTimeout(() => {
    scrollContainerRef.value?.classList.remove('is-scrolling')
    scrollbarTimer = null
  }, 1000)
}

// 点击其他地方关闭右键菜单
function handleClickOutside() {
  if (contextMenu.value.visible) {
    closeContextMenu()
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.notebook-sidebar-content {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 8px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
}

.notebook-sidebar-content.is-scrolling {
  scrollbar-color: rgba(128, 128, 128, 0.4) transparent;
}

.notebook-sidebar-content::-webkit-scrollbar {
  width: 4px;
}

.notebook-sidebar-content::-webkit-scrollbar-track {
  background: transparent;
}

.notebook-sidebar-content::-webkit-scrollbar-thumb {
  background: transparent;
  border-radius: 2px;
}

.notebook-sidebar-content.is-scrolling::-webkit-scrollbar-thumb {
  background: rgba(128, 128, 128, 0.4);
}

:root.dark .notebook-sidebar-content.is-scrolling {
  scrollbar-color: rgba(255, 255, 255, 0.3) transparent;
}

:root.dark .notebook-sidebar-content.is-scrolling::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.3);
}

.create-notebook-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: var(--color-primary-light);
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: var(--color-primary);
  font-size: var(--font-size-body);
  font-weight: 500;
  transition: all 0.2s;
  margin-bottom: 8px;
}

.create-notebook-btn:hover {
  background: var(--color-primary);
  color: white;
}

.pinned-section {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.notebook-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: var(--text-secondary);
  font-size: var(--font-size-body);
  transition: all 0.2s;
  text-align: left;
  width: 100%;
}

.notebook-item:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.notebook-item.active {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.notebook-item.dragging {
  opacity: 0.5;
  background: var(--bg-hover);
}

.notebook-item span:not(.pdf-badge) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.pdf-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  min-width: 28px;
  width: 28px;
  height: 16px;
  background: #e53e3e;
  color: white;
  font-size: var(--font-size-mini);
  font-weight: 600;
  border-radius: 3px;
}

.item-actions {
  display: flex;
  align-items: center;
  margin-left: auto;
  flex-shrink: 0;
}

.action-btn {
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s;
}

.action-btn.visible {
  opacity: 1;
}

.action-btn:hover {
  color: var(--text-primary);
}

.separator {
  height: 1px;
  background: var(--border-color);
  margin: 8px 0;
}

.all-notebooks-section {
  display: flex;
  flex-direction: column;
}

.expand-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: var(--text-secondary);
  font-size: var(--font-size-body);
  transition: all 0.2s;
  text-align: left;
  width: 100%;
}

.expand-btn:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.expand-btn svg {
  transition: transform 0.2s;
}

.expand-btn svg.rotated {
  transform: rotate(90deg);
}

.count {
  margin-left: auto;
  font-size: var(--font-size-small);
  color: var(--text-tertiary);
}

/* 内联展开的笔记本列表 */
.notebooks-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-left: 8px;
  margin-top: 4px;
}

.notebooks-list .notebook-item {
  padding-left: 20px;
}

/* 右键菜单 */
.context-menu {
  position: fixed;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 4px 16px var(--shadow-color);
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  z-index: 2000;
  min-width: 160px;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: var(--text-secondary);
  font-size: var(--font-size-body);
  transition: all 0.2s;
  text-align: left;
  width: 100%;
}

.menu-item:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.menu-item.danger {
  color: var(--color-error);
}

.menu-item.danger:hover {
  background: rgba(255, 68, 68, 0.1);
}

.menu-divider {
  height: 1px;
  background: var(--border-color);
  margin: 4px 0;
}

/* 重命名对话框 */
.rename-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3000;
}

.rename-dialog {
  background: var(--bg-primary);
  padding: 24px;
  border-radius: 12px;
  min-width: 300px;
}

.rename-dialog h3 {
  margin: 0 0 16px 0;
  font-size: var(--font-size-title);
  color: var(--text-primary);
}

.rename-dialog input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: var(--font-size-heading);
  background: var(--bg-secondary);
  color: var(--text-primary);
  box-sizing: border-box;
}

.rename-dialog input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}

.cancel-btn {
  padding: 8px 16px;
  background: var(--bg-secondary);
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: var(--text-secondary);
  font-size: var(--font-size-heading);
}

.confirm-btn {
  padding: 8px 16px;
  background: var(--color-primary);
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: white;
  font-size: var(--font-size-heading);
}

.confirm-btn.danger {
  background: var(--color-error);
}

/* 删除确认对话框 */
.delete-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3000;
}

.delete-dialog {
  background: var(--bg-primary);
  padding: 24px;
  border-radius: 12px;
  min-width: 300px;
}

.delete-dialog h3 {
  margin: 0 0 12px 0;
  font-size: var(--font-size-title);
  color: var(--text-primary);
}

.delete-dialog p {
  margin: 0 0 16px 0;
  font-size: var(--font-size-heading);
  color: var(--text-secondary);
}
</style>