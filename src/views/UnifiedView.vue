<template>
  <div class="unified-view">
    <!-- 左侧标签栏 -->
    <UnifiedSidebar
      v-show="!isSidebarCollapsed"
      :style="{ width: sidebarWidth + 'px' }"
      :all-notebooks="notebookStore.notebooks"
      :active-tab="activeTab"
      :active-notebook-id="activeNotebookId"
      :static-context-files="contextStore.staticContextFiles"
      :dynamic-context-files="contextStore.dynamicContextFiles"
      @select-tab="handleSelectTab"
      @select-notebook="handleSelectNotebook"
      @create-notebook="handleCreateNotebook"
      @switch-view-mode="handleSwitchViewMode"
      @create-note="handleCreateNote"
    />

    <!-- 可拖动分隔线 -->
    <div
      class="sidebar-resizer"
      :class="{ collapsed: isSidebarCollapsed }"
      @mousedown="startResizeSidebar"
      @dblclick="toggleSidebar"
    >
      <div class="resizer-line"></div>
      <div v-if="isSidebarCollapsed" class="collapsed-indicator">
        <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
          <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/>
        </svg>
      </div>
    </div>

    <!-- 右侧内容区域 -->
    <main class="main-content">
      <!-- 上下文面板 -->
      <ContextsPanel
        v-if="activeTab === 'contexts'"
        @newContext="handleNewContext"
        @editContext="editContextFile"
        @dragStart="handleContextDragStart"
        @dragEnd="handleContextDragEnd"
        @quickCommandDragStart="handleQuickCommandDragStart"
        @quickCommandDragEnd="handleQuickCommandDragEnd"
      />

      <!-- 标签面板 -->
      <TagsPanel v-if="activeTab === 'tags'" />

      <!-- 收藏夹面板 -->
      <FavoritesPanel v-if="activeTab === 'favorites'" />

      <!-- 回收站面板 -->
      <TrashPanel v-if="activeTab === 'trash'" />

      <!-- 设置面板 -->
      <SettingsPanel
        v-if="activeTab === 'settings'"
        @dragStart="handleProfileDragStart"
        @dragEnd="handleProfileDragEnd"
      />

      <!-- 笔记本面板 -->
      <MultiChatPanel
        v-if="(activeTab === 'notebooks' || activeTab === 'all-notebooks') && viewMode === 'chat'"
        :notebook-id="activeNotebookId"
        :static-context-files="staticContextFiles"
        :all-static-context-files="contextStore.staticContextFiles"
        :all-dynamic-context-files="contextStore.dynamicContextFiles"
        :dynamic-context-file="dynamicContextFile || null"
        :all-profiles="settingsStore.settings.llm.profiles"
        :active-profile-id="settingsStore.settings.llm.activeProfileId"
        :all-notebooks="notebookStore.notebooks"
        :current-notebook-id="activeNotebookId || null"
        :activate-node-id="activateNodeId"
        :trigger-create-note="shouldTriggerCreateNote"
        @node-activated="handleNodeActivated"
        @create-note-triggered="handleCreateNoteTriggered"
      />

      <!-- Canvas画布面板 -->
      <CanvasViewPanel
        ref="canvasViewPanelRef"
        v-if="viewMode === 'canvas' && activeNotebookId && (activeTab === 'notebooks' || activeTab === 'all-notebooks' || activeTab === 'pdf-notebook')"
        :notebook-id="activeNotebookId"
        :static-context-files="staticContextFiles"
        :all-static-context-files="contextStore.staticContextFiles"
        :all-dynamic-context-files="contextStore.dynamicContextFiles"
        :dynamic-context-file="dynamicContextFile || null"
        :all-profiles="settingsStore.settings.llm.profiles"
        :active-profile-id="settingsStore.settings.llm.activeProfileId"
        :all-notebooks="notebookStore.notebooks"
        :current-notebook-id="activeNotebookId"
        @toggle-static-context="toggleStaticContext"
        @select-dynamic-context="selectDynamicContext"
        @dynamic-context-drop="handleDynamicContextDrop"
        @select-model="handleSelectModel"
      />

      <!-- 粒子视图面板 -->
      <ParticleViewPanel
        v-if="viewMode === 'particle' && activeNotebookId && (activeTab === 'notebooks' || activeTab === 'all-notebooks')"
        :notebook-id="activeNotebookId"
        @switch-to-chat="handleSwitchViewMode('chat')"
        @select-node="handleParticleSelectNode"
        @navigate="handleParticleNavigate"
      />

      <!-- PDF笔记本面板 -->
      <PdfReaderPanel
        v-if="activeTab === 'pdf-notebook' && viewMode !== 'canvas' && activeNotebookId"
        :notebook-id="activeNotebookId"
        :static-context-files="staticContextFiles"
        :all-static-context-files="contextStore.staticContextFiles"
        :all-dynamic-context-files="contextStore.dynamicContextFiles"
        :dynamic-context-file="dynamicContextFile || null"
        :all-profiles="settingsStore.settings.llm.profiles"
        :active-profile-id="settingsStore.settings.llm.activeProfileId"
        :all-notebooks="notebookStore.notebooks"
        :current-notebook-id="activeNotebookId"
        :activate-node-id="activateNodeId"
        @node-activated="handleNodeActivated"
      />

      <!-- 状态栏 -->
      <StatusBar />
    </main>

    <!-- Context Edit Dialog (新建/编辑上下文) -->
    <ContextEditDialog
      :visible="showContextEditDialog"
      :context="editingContext"
      @update:visible="showContextEditDialog = $event"
      @save="handleContextSave"
      @delete="handleContextDelete"
      @cancel="showContextEditDialog = false"
    />

    <!-- Delete Confirmation Dialog -->
    <div v-if="showDeleteConfirm" class="dialog-overlay" @click="showDeleteConfirm = false">
      <div class="dialog confirm-dialog" @click.stop>
        <h3>{{ t('context.deleteConfirmTitle') }}</h3>
        <p>{{ t('context.deleteConfirmMessage') }}</p>
        <div class="dialog-actions">
          <button @click="showDeleteConfirm = false" class="cancel-btn">{{ t('common.cancel') }}</button>
          <button @click="deleteContextFile" class="delete-btn confirm-delete">{{ t('common.delete') }}</button>
        </div>
      </div>
    </div>

    <!-- 快捷指令删除确认对话框 -->
    <div v-if="showQuickCommandDeleteConfirm" class="dialog-overlay" @click="showQuickCommandDeleteConfirm = false">
      <div class="dialog confirm-dialog" @click.stop>
        <h3>{{ t('quickCommand.deleteConfirmTitle') }}</h3>
        <p>{{ t('quickCommand.deleteConfirmMessage', { name: quickCommandToDelete?.name }) }}</p>
        <div class="dialog-actions">
          <button @click="showQuickCommandDeleteConfirm = false" class="cancel-btn">{{ t('common.cancel') }}</button>
          <button @click="confirmDeleteQuickCommand" class="delete-btn confirm-delete">{{ t('common.delete') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter, useRoute } from 'vue-router'
import { useNotebookStore } from '@/stores/notebookStore'
import { useContextStore } from '@/stores/contextStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useQuickCommandStore } from '@/stores/quickCommandStore'
import UnifiedSidebar from '@/components/UnifiedSidebar.vue'
import ContextsPanel from '@/components/ContextsPanel.vue'
import FavoritesPanel from '@/components/FavoritesPanel.vue'
import TrashPanel from '@/components/TrashPanel.vue'
import TagsPanel from '@/components/TagsPanel.vue'
import SettingsPanel from '@/components/SettingsPanel.vue'
import MultiChatPanel from '@/components/MultiChatPanel.vue'
import PdfReaderPanel from '@/components/PdfReaderPanel.vue'
import CanvasViewPanel from '@/components/CanvasViewPanel.vue'
import ParticleViewPanel from '@/components/ParticleViewPanel.vue'
import ContextEditDialog from '@/components/ContextEditDialog.vue'
import StatusBar from '@/components/StatusBar.vue'
import type { ContextFile, ContextType } from '@/types/context'
import { CONTEXT_COLORS, type ContextColor } from '@/types/context'
import type { QuickCommand } from '@/types/quickCommand'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const notebookStore = useNotebookStore()
const contextStore = useContextStore()
const settingsStore = useSettingsStore()
const quickCommandStore = useQuickCommandStore()

const contextColors = computed(() => CONTEXT_COLORS)

// CanvasViewPanel 的引用（用于激活节点）
const canvasViewPanelRef = ref<InstanceType<typeof CanvasViewPanel> | null>(null)

// 当前激活的 tab - 根据默认笔记本设置决定初始值
const activeTab = ref<string>(settingsStore.settings.general.defaultNotebookId ? 'notebooks' : 'all-notebooks')

// 当前激活的笔记本ID - 如果有默认笔记本，先设置为默认（等待加载后验证）
const activeNotebookId = ref<string | null>(settingsStore.settings.general.defaultNotebookId || null)

// 视图模式：'chat' | 'canvas' | 'particle'（仅在笔记本tab下生效）
const viewMode = ref<'chat' | 'canvas' | 'particle'>('chat')

// 需要激活的节点ID（用于跳转链接）
const activateNodeId = ref<string | null>(null)

// 上下文编辑对话框状态
const showContextEditDialog = ref(false)
const editingContext = ref<ContextFile | null>(null)

const showDeleteConfirm = ref(false)
const contextToDelete = ref<string | null>(null)

// 拖拽删除相关
const draggedContext = ref<ContextFile | null>(null)
const draggedProfileId = ref<string | null>(null)
const draggedQuickCommand = ref<QuickCommand | null>(null)
const showQuickCommandDeleteConfirm = ref(false)
const quickCommandToDelete = ref<QuickCommand | null>(null)

// 侧边栏宽度拖拽
const sidebarWidth = ref(180)
const isResizingSidebar = ref(false)
const isSidebarCollapsed = ref(false)
const savedSidebarWidth = ref(180)

// 静态上下文文件
const staticContextFiles = computed(() => {
  const ids = notebookStore.currentNotebook?.context?.staticContextIds || []
  return contextStore.staticContextFiles.filter(f => ids.includes(f.id))
})

// 动态上下文文件
const dynamicContextFile = computed(() => {
  const id = notebookStore.currentNotebook?.context?.dynamicContextId
  return id ? contextStore.dynamicContextFiles.find(f => f.id === id) : null
})

// 触发创建笔记输入
const shouldTriggerCreateNote = ref(false)

onMounted(async () => {
  await notebookStore.loadNotebooks()
  await contextStore.loadContextFiles()

  // 验证默认笔记本是否存在
  const defaultNotebookId = settingsStore.settings.general.defaultNotebookId
  if (defaultNotebookId) {
    const notebook = notebookStore.notebooks.find(nb => nb.id === defaultNotebookId)
    if (notebook) {
      // 默认笔记本存在，确保设置正确
      notebookStore.setCurrentNotebook(notebook)
      if (notebook.pdfPath) {
        activeTab.value = 'pdf-notebook'
      } else {
        activeTab.value = 'notebooks'
      }
    } else {
      // 默认笔记本不存在，回退到全部笔记本
      activeTab.value = 'all-notebooks'
      activeNotebookId.value = null
    }
  }

  // 处理路由中的 nodeId 参数
  handleRouteNodeId()
})

// 监听路由变化，处理 nodeId 查询参数
watch(() => route.query.nodeId, (nodeId) => {
  if (nodeId && route.params.notebookId) {
    handleNodeActivation(String(nodeId), String(route.params.notebookId))
  }
}, { immediate: false })

// 处理路由中的 nodeId 参数（初始化时）
function handleRouteNodeId() {
  const nodeId = route.query.nodeId
  const notebookId = route.params.notebookId

  if (nodeId && notebookId) {
    handleNodeActivation(String(nodeId), String(notebookId))
  }
}

// 处理节点激活（跳转到指定节点）
function handleNodeActivation(nodeId: string, notebookId: string) {
  // 设置笔记本
  const notebook = notebookStore.notebooks.find(nb => nb.id === notebookId)
  if (!notebook) return

  notebookStore.setCurrentNotebook(notebook)
  activeNotebookId.value = notebookId

  // 设置 tab 和视图模式
  if (notebook.pdfPath) {
    activeTab.value = 'pdf-notebook'
    viewMode.value = 'chat'  // PDF笔记跳转到 PdfReaderPanel
  } else {
    activeTab.value = 'notebooks'
    viewMode.value = 'chat'  // 普通笔记跳转到 MultiChatPanel
  }

  // 等待组件渲染后激活节点
  setTimeout(() => {
    activateNode(nodeId)
  }, 300)
}

// 激活指定节点（根据当前视图模式选择正确的面板）
function activateNode(nodeId: string) {
  // 通过 prop 传递给子组件，子组件监听变化并激活节点
  activateNodeId.value = nodeId
}

// 节点激活完成后的回调
function handleNodeActivated() {
  // 清除激活请求
  activateNodeId.value = null
}

// 标签选择处理
function handleSelectTab(tab: string) {
  activeTab.value = tab
  if (tab !== 'notebooks' && tab !== 'all-notebooks' && tab !== 'pdf-notebook') {
    activeNotebookId.value = null
  }
  // 切换tab时重置视图模式为chat
  viewMode.value = 'chat'
}

// 笔记本选择处理
function handleSelectNotebook(notebookId: string | null) {
  activeNotebookId.value = notebookId
  // 选择笔记本时默认为chat模式
  viewMode.value = 'chat'

  if (notebookId) {
    const notebook = notebookStore.notebooks.find(nb => nb.id === notebookId)
    if (notebook) {
      notebookStore.setCurrentNotebook(notebook)

      if (notebook.pdfPath) {
        activeTab.value = 'pdf-notebook'
      } else {
        activeTab.value = 'notebooks'
      }
    }
  } else {
    activeTab.value = 'all-notebooks'
  }
}

// 创建笔记 - 触发输入模式
function handleCreateNote() {
  // 确定目标笔记本
  let targetNotebookId: string | null = activeNotebookId.value

  if (!targetNotebookId) {
    // 如果没有选中笔记本，使用默认笔记本
    const defaultId = settingsStore.settings.general.defaultNotebookId
    if (!defaultId) {
      // 如果没有默认笔记本，提示用户
      alert(t('settings.defaultNotebookNone'))
      return
    }
    targetNotebookId = defaultId
    // 设置为默认笔记本
    handleSelectNotebook(targetNotebookId)
  }

  // 确保视图模式为 chat
  viewMode.value = 'chat'

  // 触发创建笔记输入
  shouldTriggerCreateNote.value = true
}

// 创建笔记触发完成
function handleCreateNoteTriggered() {
  shouldTriggerCreateNote.value = false
}

// 创建笔记本
async function handleCreateNotebook(data: {
  name: string
  pdfPath?: string
  staticContextIds: string[]
  dynamicContextId?: string
}) {
  const notebook = await notebookStore.createNotebook(data.name, undefined, data.pdfPath)

  // 设置上下文
  if (data.staticContextIds.length > 0 || data.dynamicContextId) {
    const contextData: { staticContextIds?: string[]; dynamicContextId?: string } = {}
    if (data.staticContextIds.length > 0) {
      contextData.staticContextIds = data.staticContextIds
    }
    if (data.dynamicContextId) {
      contextData.dynamicContextId = data.dynamicContextId
    }
    notebook.context = contextData
    await notebookStore.saveNotebook(notebook)
  }

  notebookStore.setCurrentNotebook(notebook)
  activeNotebookId.value = notebook.id

  // 根据笔记本类型设置 tab
  if (notebook.pdfPath) {
    activeTab.value = 'pdf-notebook'
  } else {
    activeTab.value = 'notebooks'
  }
}

// 侧边栏拖拽调整
function startResizeSidebar(e: MouseEvent) {
  if (isSidebarCollapsed.value) return
  isResizingSidebar.value = true
  document.addEventListener('mousemove', handleResizeSidebar)
  document.addEventListener('mouseup', stopResizeSidebar)
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

function handleResizeSidebar(e: MouseEvent) {
  if (!isResizingSidebar.value) return

  const minWidth = 150
  const maxWidth = 300

  sidebarWidth.value = Math.max(minWidth, Math.min(maxWidth, e.clientX))
}

function stopResizeSidebar() {
  isResizingSidebar.value = false
  document.removeEventListener('mousemove', handleResizeSidebar)
  document.removeEventListener('mouseup', stopResizeSidebar)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
}

// 双击切换侧边栏显示/隐藏
function toggleSidebar() {
  isSidebarCollapsed.value = !isSidebarCollapsed.value
  if (isSidebarCollapsed.value) {
    savedSidebarWidth.value = sidebarWidth.value
  } else {
    sidebarWidth.value = savedSidebarWidth.value
  }
}

// Context file management
function editContextFile(file: ContextFile) {
  editingContext.value = file
  showContextEditDialog.value = true
}

// 处理新建上下文（从ContextsPanel emit的newContext事件）
function handleNewContext() {
  editingContext.value = null
  showContextEditDialog.value = true
}

// 处理上下文保存（新建或编辑）
async function handleContextSave(data: { name: string; type: ContextType; color: ContextColor; content: string }) {
  if (editingContext.value) {
    // 编辑现有上下文
    await contextStore.updateContextFile(editingContext.value.id, {
      name: data.name,
      color: data.color,
      content: data.content
    })
  } else {
    // 新建上下文
    const newFile = await contextStore.createContextFile(
      data.name,
      data.type,
      data.content
    )
    // 更新颜色
    if (newFile.color !== data.color) {
      await contextStore.updateContextFile(newFile.id, {
        color: data.color
      })
    }
  }
  editingContext.value = null
}

// 处理上下文删除
function handleContextDelete() {
  if (editingContext.value) {
    contextToDelete.value = editingContext.value.id
    showDeleteConfirm.value = true
  }
}

async function deleteContextFile() {
  if (!contextToDelete.value) return

  await contextStore.deleteContextFile(contextToDelete.value)
  showDeleteConfirm.value = false
  contextToDelete.value = null
  editingContext.value = null
}

// 拖拽删除功能
function handleContextDragStart(e: DragEvent, context: ContextFile) {
  draggedContext.value = context
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    const target = e.target as HTMLElement
    target.style.opacity = '0.5'
  }
}

function handleContextDragEnd(e: DragEvent) {
  const target = e.target as HTMLElement
  target.style.opacity = '1'
  draggedContext.value = null
}

function handleProfileDragStart(e: DragEvent, profileId: string) {
  draggedProfileId.value = profileId
}

function handleProfileDragEnd(e: DragEvent) {
  draggedProfileId.value = null
}

function handleQuickCommandDragStart(e: DragEvent, cmd: QuickCommand) {
  draggedQuickCommand.value = cmd
}

function handleQuickCommandDragEnd(e: DragEvent) {
  draggedQuickCommand.value = null
}

async function confirmDeleteQuickCommand() {
  if (quickCommandToDelete.value) {
    await quickCommandStore.deleteQuickCommand(quickCommandToDelete.value.id)
    showQuickCommandDeleteConfirm.value = false
    quickCommandToDelete.value = null
  }
}

// CanvasViewPanel 事件处理
function toggleStaticContext(contextId: string) {
  if (!notebookStore.currentNotebook) return
  const staticIds = notebookStore.currentNotebook.context?.staticContextIds || []
  const index = staticIds.indexOf(contextId)

  if (index === -1) {
    notebookStore.currentNotebook.context = {
      ...notebookStore.currentNotebook.context,
      staticContextIds: [...staticIds, contextId]
    }
  } else {
    const newIds = [...staticIds]
    newIds.splice(index, 1)
    notebookStore.currentNotebook.context = {
      ...notebookStore.currentNotebook.context,
      staticContextIds: newIds
    }
  }
  notebookStore.saveNotebook(notebookStore.currentNotebook)
}

function selectDynamicContext(contextId: string) {
  if (!notebookStore.currentNotebook) return
  notebookStore.currentNotebook.context = {
    ...notebookStore.currentNotebook.context,
    dynamicContextId: contextId
  }
  notebookStore.saveNotebook(notebookStore.currentNotebook)
}

function handleDynamicContextDrop(text: string) {
  // TODO: 处理动态上下文拖拽
}

function handleSelectModel(modelId: string) {
  settingsStore.updateSettings({
    llm: {
      ...settingsStore.settings.llm,
      activeProfileId: modelId
    }
  })
}

// 视图模式切换
function handleSwitchViewMode(mode: 'chat' | 'canvas' | 'particle') {
  viewMode.value = mode
}

// 粒子视图选中节点
function handleParticleSelectNode(nodeId: string) {
  // 设置要激活的节点
  activateNodeId.value = nodeId
}

// 粒子视图跳转到节点位置
function handleParticleNavigate(data: { notebookId: string; nodeId: string }) {
  // 切换到对应笔记本
  if (data.notebookId !== activeNotebookId.value) {
    const notebook = notebookStore.notebooks.find(n => n.id === data.notebookId)
    if (notebook) {
      notebookStore.setCurrentNotebook(notebook)
      activeNotebookId.value = data.notebookId
    }
  }
  // 设置要激活的节点
  activateNodeId.value = data.nodeId
}
</script>

<style scoped>
.unified-view {
  height: 100%;
  display: flex;
  background: var(--bg-secondary);
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

/* 主内容区域样式 */
.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg-primary);
}

/* 主内容区域内部的视图面板 */
.main-content > :not(.status-bar) {
  flex: 1;
  overflow: hidden;
}

/* 对话框样式 */
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.dialog {
  background: var(--bg-primary);
  padding: 24px;
  border-radius: 12px;
  min-width: 400px;
  max-width: 500px;
}

.edit-dialog {
  min-width: 500px;
  max-width: 700px;
}

.color-picker {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.color-option {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: all 0.2s;
}

.color-option:hover {
  transform: scale(1.1);
}

.color-option.selected {
  border-color: var(--text-primary);
  box-shadow: 0 0 0 2px var(--bg-secondary), 0 0 0 4px var(--border-color);
}

.confirm-dialog {
  min-width: 350px;
}

.dialog h3 {
  margin-bottom: 16px;
  font-size: 20px;
  color: var(--text-primary);
}

.dialog input[type="text"] {
  width: 100%;
  padding: 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 14px;
  margin-bottom: 16px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  box-sizing: border-box;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  color: var(--text-secondary);
}

.form-group select {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 14px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  cursor: pointer;
}

.content-input {
  width: 100%;
  min-height: 200px;
  padding: 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 14px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  resize: vertical;
  font-family: inherit;
  line-height: 1.6;
  box-sizing: border-box;
}

.name-input {
  margin-bottom: 12px;
}

.dialog-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 20px;
}

.dialog-actions-right {
  display: flex;
  gap: 12px;
}

.delete-btn {
  padding: 8px 16px;
  background: rgba(255, 68, 68, 0.1);
  border: 1px solid rgba(255, 68, 68, 0.3);
  border-radius: 6px;
  cursor: pointer;
  color: var(--color-error);
  transition: all 0.2s;
}

.delete-btn:hover {
  background: rgba(255, 68, 68, 0.2);
}

.cancel-btn {
  padding: 8px 16px;
  background: var(--bg-secondary);
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: var(--text-secondary);
}

.confirm-btn {
  padding: 8px 16px;
  background: var(--color-primary);
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: white;
}

.confirm-delete {
  background: var(--color-error);
  border: none;
  color: white;
}

.confirm-delete:hover {
  background: var(--color-error-hover);
}
</style>