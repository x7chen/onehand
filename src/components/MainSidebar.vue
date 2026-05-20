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
      @reorder-pinned="handleReorderPinned"
      @activate-node="handleActivateNode"
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
      :filter-date-start="filterDateStart"
      :filter-date-end="filterDateEnd"
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
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
  filterDateStart?: string
  filterDateEnd?: string
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
  (e: 'reorder-pinned', pinnedIds: string[]): void
  (e: 'create-context', type: 'static' | 'dynamic'): void
  (e: 'select-context', contextId: string | null): void
  (e: 'create-quick-command'): void
  (e: 'select-quick-command', commandId: string | null): void
  (e: 'edit-context', context: ContextFile): void
  (e: 'edit-quick-command', command: QuickCommand): void
  (e: 'select-tag', tagName: string | null): void
  (e: 'update-filter', filter: { notebookId?: string | null; timeType?: string | null; dateStart?: string; dateEnd?: string }): void
  (e: 'select-settings-tab', tab: 'general' | 'model'): void
  (e: 'select-trash-tab', tab: 'notes' | 'notebooks' | 'contexts' | 'quickCommands'): void
  (e: 'activate-node', nodeId: string): void
}>()

const { t } = useI18n()
const settingsStore = useSettingsStore()
const notebookStore = useNotebookStore()

// 从settingsStore获取侧边栏状态
const sidebarWidth = ref(settingsStore.settings.general.sidebarWidth || 200)
const sidebarCollapsed = computed(() => settingsStore.settings.general.sidebarCollapsed || false)

const isResizing = ref(false)
const savedSidebarWidth = ref(200)

// 监听 settingsStore 的 sidebarWidth 变化，同步本地状态
watch(() => settingsStore.settings.general.sidebarWidth, (newWidth) => {
  if (newWidth && !sidebarCollapsed.value) {
    sidebarWidth.value = newWidth
  }
})

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

function handleReorderPinned(pinnedIds: string[]) {
  emit('reorder-pinned', pinnedIds)
}

function handleActivateNode(nodeId: string) {
  emit('activate-node', nodeId)
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
  const maxWidth = 600
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
  const newCollapsed = !sidebarCollapsed.value
  if (newCollapsed) {
    savedSidebarWidth.value = sidebarWidth.value
  } else {
    sidebarWidth.value = savedSidebarWidth.value
  }

  // 通过 settingsStore 更新折叠状态
  settingsStore.updateSettings({
    general: {
      ...settingsStore.settings.general,
      sidebarCollapsed: newCollapsed,
      sidebarWidth: sidebarWidth.value
    }
  })

  emit('toggle-collapse')
}

// 监听外部折叠请求（来自ActivityBar）
function handleExternalToggle() {
  toggleSidebar()
}

onMounted(() => {
  // 初始化时同步侧边栏宽度
  sidebarWidth.value = settingsStore.settings.general.sidebarWidth || 200
  savedSidebarWidth.value = sidebarWidth.value
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
  width: 4px;
  background: var(--bg-primary);
  cursor: col-resize;
  flex-shrink: 0;
  transition: background 0.2s, width 0.2s;
}

.sidebar-resizer:hover {
  background: var(--color-primary);
  opacity: 0.5;
}

.sidebar-resizer.collapsed {
  width: 4px;
  cursor: pointer;
}
</style>