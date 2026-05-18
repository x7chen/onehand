<template>
  <div
    class="main-sidebar"
    v-show="!sidebarCollapsed"
    :style="{ width: sidebarWidth + 'px' }"
  >
    <!-- 笔记本视图侧边栏 -->
    <NotebookSidebarContent
      v-if="activeActivity === 'notebooks'"
      :notebooks="notebooks"
      :active-notebook-id="activeNotebookId"
      :pinned-notebook-ids="pinnedNotebookIds"
      :pinned-all-notebooks="pinnedAllNotebooks"
      @select-notebook="handleSelectNotebook"
      @create-notebook="handleCreateNotebook"
      @open-canvas="handleOpenCanvas"
      @open-particle="handleOpenParticle"
      @rename-notebook="handleRenameNotebook"
      @delete-notebook="handleDeleteNotebook"
      @toggle-pin="handleTogglePin"
      @toggle-pin-all="handleTogglePinAll"
    />

    <!-- 上下文视图侧边栏 -->
    <ContextSidebarContent
      v-if="activeActivity === 'contexts'"
      :static-contexts="staticContexts"
      :dynamic-contexts="dynamicContexts"
      :quick-commands="quickCommands"
      :selected-context-id="selectedContextId"
      :selected-quick-command-id="selectedQuickCommandId"
      @create-context="handleCreateContext"
      @select-context="handleSelectContext"
      @create-quick-command="handleCreateQuickCommand"
      @select-quick-command="handleSelectQuickCommand"
      @edit-context="handleEditContext"
      @edit-quick-command="handleEditQuickCommand"
    />

    <!-- 标签视图侧边栏 -->
    <TagSidebarContent
      v-if="activeActivity === 'tags'"
      :tags="tags"
      :selected-tag-name="selectedTagName"
      @select-tag="handleSelectTag"
    />

    <!-- 收藏视图侧边栏 -->
    <FavoriteSidebarContent
      v-if="activeActivity === 'favorites'"
      :notebooks="notebooks"
      :filter-notebook-id="filterNotebookId"
      :filter-time-type="filterTimeType"
      @update-filter="handleUpdateFavoriteFilter"
    />

    <!-- 设置视图侧边栏 -->
    <SettingsSidebarContent
      v-if="activeActivity === 'settings'"
      :active-tab="settingsTab"
      @select-tab="handleSelectSettingsTab"
    />

    <!-- 回收站视图侧边栏 -->
    <TrashSidebarContent
      v-if="activeActivity === 'trash'"
      :active-tab="trashTab"
      @select-tab="handleSelectTrashTab"
    />
  </div>

  <!-- 可拖动分隔线 -->
  <div
    class="sidebar-resizer"
    :class="{ collapsed: sidebarCollapsed }"
    @mousedown="startResize"
    @dblclick="toggleSidebar"
  >
    <div class="resizer-line"></div>
    <div v-if="sidebarCollapsed" class="collapsed-indicator">
      <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
        <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/>
      </svg>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '@/stores/settingsStore'
import { useNotebookStore } from '@/stores/notebookStore'
import NotebookSidebarContent from './sidebar/NotebookSidebarContent.vue'
import ContextSidebarContent from './sidebar/ContextSidebarContent.vue'
import TagSidebarContent from './sidebar/TagSidebarContent.vue'
import FavoriteSidebarContent from './sidebar/FavoriteSidebarContent.vue'
import SettingsSidebarContent from './sidebar/SettingsSidebarContent.vue'
import TrashSidebarContent from './sidebar/TrashSidebarContent.vue'
import type { Notebook } from '@/types/notebook'
import type { ContextFile } from '@/types/context'
import type { QuickCommand } from '@/types/quickCommand'

const props = defineProps<{
  activeActivity: string
  notebooks: Notebook[]
  activeNotebookId: string | null
  pinnedNotebookIds: string[]
  pinnedAllNotebooks: boolean
  staticContexts: ContextFile[]
  dynamicContexts: ContextFile[]
  quickCommands: QuickCommand[]
  tags: Array<{ tagName: string; tagColor: string; nodes: any[] }>
  selectedContextId: string | null
  selectedQuickCommandId: string | null
  selectedTagName: string | null
  filterNotebookId: string | null
  filterTimeType: string | null
  settingsTab: 'general' | 'model'
  trashTab: 'notes' | 'notebooks' | 'contexts' | 'quickCommands'
}>()

const emit = defineEmits<{
  (e: 'toggle-collapse'): void
  (e: 'select-notebook', notebookId: string | null): void
  (e: 'create-notebook', data: { name: string; pdfPath?: string; staticContextIds: string[]; dynamicContextId?: string }): void
  (e: 'open-canvas', notebookId: string): void
  (e: 'open-particle', notebookId: string): void
  (e: 'rename-notebook', notebookId: string, newName: string): void
  (e: 'delete-notebook', notebookId: string): void
  (e: 'toggle-pin', notebookId: string): void
  (e: 'toggle-pin-all'): void
  (e: 'create-context', type: 'static' | 'dynamic'): void
  (e: 'select-context', contextId: string | null): void
  (e: 'create-quick-command'): void
  (e: 'select-quick-command', commandId: string | null): void
  (e: 'edit-context', context: ContextFile): void
  (e: 'edit-quick-command', command: QuickCommand): void
  (e: 'select-tag', tagName: string | null): void
  (e: 'update-filter', filter: { notebookId?: string | null; timeType?: string | null }): void
  (e: 'select-settings-tab', tab: 'general' | 'model'): void
  (e: 'select-trash-tab', tab: 'notes' | 'notebooks' | 'contexts' | 'quickCommands'): void
}>()

const { t } = useI18n()
const settingsStore = useSettingsStore()
const notebookStore = useNotebookStore()

// 从settingsStore获取侧边栏状态
const sidebarWidth = ref(settingsStore.settings.general.sidebarWidth || 200)
const sidebarCollapsed = ref(settingsStore.settings.general.sidebarCollapsed || false)

const isResizing = ref(false)
const savedSidebarWidth = ref(200)

// 处理笔记本相关事件
function handleSelectNotebook(notebookId: string | null) {
  emit('select-notebook', notebookId)
}

function handleCreateNotebook(data: { name: string; pdfPath?: string; staticContextIds: string[]; dynamicContextId?: string }) {
  emit('create-notebook', data)
}

function handleOpenCanvas(notebookId: string) {
  emit('open-canvas', notebookId)
}

function handleOpenParticle(notebookId: string) {
  emit('open-particle', notebookId)
}

function handleRenameNotebook(notebookId: string, newName: string) {
  emit('rename-notebook', notebookId, newName)
}

function handleDeleteNotebook(notebookId: string) {
  emit('delete-notebook', notebookId)
}

function handleTogglePin(notebookId: string) {
  emit('toggle-pin', notebookId)
}

function handleTogglePinAll() {
  emit('toggle-pin-all')
}

// 处理上下文相关事件
function handleCreateContext(type: 'static' | 'dynamic') {
  emit('create-context', type)
}

function handleSelectContext(contextId: string | null) {
  emit('select-context', contextId)
}

function handleCreateQuickCommand() {
  emit('create-quick-command')
}

function handleSelectQuickCommand(commandId: string | null) {
  emit('select-quick-command', commandId)
}

function handleEditContext(context: ContextFile) {
  emit('edit-context', context)
}

function handleEditQuickCommand(command: QuickCommand) {
  emit('edit-quick-command', command)
}

// 处理标签相关事件
function handleSelectTag(tagName: string | null) {
  emit('select-tag', tagName)
}

// 处理收藏过滤器事件
function handleUpdateFavoriteFilter(filter: { notebookId?: string | null; timeType?: string | null }) {
  emit('update-filter', filter)
}

// 处理设置tab事件
function handleSelectSettingsTab(tab: 'general' | 'model') {
  emit('select-settings-tab', tab)
}

// 处理回收站tab事件
function handleSelectTrashTab(tab: 'notes' | 'notebooks' | 'contexts' | 'quickCommands') {
  emit('select-trash-tab', tab)
}

// 侧边栏拖拽调整
function startResize(e: MouseEvent) {
  if (sidebarCollapsed.value) return
  isResizing.value = true
  document.addEventListener('mousemove', handleResize)
  document.addEventListener('mouseup', stopResize)
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

function handleResize(e: MouseEvent) {
  if (!isResizing.value) return

  const minWidth = 150
  const maxWidth = 300
  // 计算宽度时需要减去活动栏的48px
  const newWidth = Math.max(minWidth, Math.min(maxWidth, e.clientX - 48))

  sidebarWidth.value = newWidth
}

function stopResize() {
  isResizing.value = false
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', stopResize)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''

  // 保存宽度到settingsStore
  settingsStore.updateSettings({
    general: {
      ...settingsStore.settings.general,
      sidebarWidth: sidebarWidth.value
    }
  })
}

// 双击切换侧边栏显示/隐藏
function toggleSidebar() {
  sidebarCollapsed.value = !sidebarCollapsed.value
  if (sidebarCollapsed.value) {
    savedSidebarWidth.value = sidebarWidth.value
  } else {
    sidebarWidth.value = savedSidebarWidth.value
  }

  // 保存折叠状态到settingsStore
  settingsStore.updateSettings({
    general: {
      ...settingsStore.settings.general,
      sidebarCollapsed: sidebarCollapsed.value
    }
  })

  emit('toggle-collapse')
}

// 监听外部折叠请求（来自ActivityBar）
function handleExternalToggle() {
  toggleSidebar()
}

onMounted(() => {
  // 初始化时同步状态
  sidebarWidth.value = settingsStore.settings.general.sidebarWidth || 200
  sidebarCollapsed.value = settingsStore.settings.general.sidebarCollapsed || false
})
</script>

<style scoped>
.main-sidebar {
  height: 100%;
  background: var(--bg-primary);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  overflow: hidden;
}

/* 侧边栏分隔线 */
.sidebar-resizer {
  width: 8px;
  background: var(--bg-primary);
  cursor: col-resize;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.2s, width 0.2s;
}

.sidebar-resizer:hover {
  background: var(--border-color);
}

.sidebar-resizer .resizer-line {
  width: 2px;
  height: 40px;
  background: var(--border-color);
  border-radius: 1px;
  transition: background 0.2s, opacity 0.2s;
}

.sidebar-resizer:hover .resizer-line {
  background: var(--color-primary);
}

.sidebar-resizer.collapsed {
  width: 12px;
  cursor: pointer;
}

.sidebar-resizer.collapsed .resizer-line {
  opacity: 0;
}

.sidebar-resizer.collapsed .collapsed-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  transition: color 0.2s;
}

.sidebar-resizer.collapsed:hover .collapsed-indicator {
  color: var(--color-primary);
}
</style>