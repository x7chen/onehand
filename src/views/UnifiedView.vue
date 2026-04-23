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
        @newContext="showNewContextDialog = true"
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

      <!-- 设置面板 -->
      <SettingsPanel
        v-if="activeTab === 'settings'"
        @dragStart="handleProfileDragStart"
        @dragEnd="handleProfileDragEnd"
      />

      <!-- 笔记本面板 -->
      <MultiChatPanel
        v-if="(activeTab === 'notebooks' || activeTab === 'all-notebooks') && viewMode !== 'canvas'"
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
        @switch-to-chat="handleSwitchViewMode('chat')"
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
    </main>

    <!-- New Context Dialog -->
    <div v-if="showNewContextDialog" class="dialog-overlay" @click="showNewContextDialog = false">
      <div class="dialog edit-dialog" @click.stop>
        <h3>{{ t('context.newContext') }}</h3>

        <div class="edit-form">
          <div class="form-group">
            <label>{{ t('context.tagName') }}</label>
            <input
              v-model="newContextName"
              type="text"
              :placeholder="t('context.contextNamePlaceholder')"
              class="name-input"
            />
          </div>

          <div class="form-group">
            <label>{{ t('context.contextType') }}</label>
            <select v-model="newContextType">
              <option value="static">{{ t('context.staticDesc') }}</option>
              <option value="dynamic">{{ t('context.dynamicDesc') }}</option>
            </select>
          </div>

          <div class="form-group">
            <label>{{ t('context.tagColor') }}</label>
            <div class="color-picker">
              <button
                v-for="color in contextColors"
                :key="color"
                class="color-option"
                :class="{ selected: newContextColor === color }"
                :style="{ backgroundColor: color }"
                @click="newContextColor = color"
                :title="color"
              />
            </div>
          </div>

          <div class="form-group">
            <label>{{ t('context.contextContent') }}</label>
            <textarea
              v-model="newContextContent"
              :placeholder="t('context.tagContentPlaceholder')"
              class="content-input"
            ></textarea>
          </div>
        </div>

        <div class="dialog-actions">
          <button @click="showNewContextDialog = false" class="cancel-btn">{{ t('common.cancel') }}</button>
          <button @click="createContextFile" class="confirm-btn">{{ t('common.create') }}</button>
        </div>
      </div>
    </div>

    <!-- Edit Context Dialog -->
    <div v-if="showEditContextDialog && editingContext" class="dialog-overlay" @click="closeEditDialog">
      <div class="dialog edit-dialog" @click.stop>
        <div class="edit-dialog-header">
          <h3>{{ t('context.editTag') }}</h3>
          <button @click="closeEditDialog" class="close-btn" :title="t('common.close')">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>

        <div class="edit-form">
          <div class="form-group">
            <label>{{ t('context.tagName') }}</label>
            <input
              v-model="editingContext.name"
              type="text"
              :placeholder="t('context.tagName')"
              class="name-input"
            />
          </div>

          <div class="form-group">
            <label>{{ t('context.tagColor') }}</label>
            <div class="color-picker">
              <button
                v-for="color in contextColors"
                :key="color"
                class="color-option"
                :class="{ selected: editingContext.color === color }"
                :style="{ backgroundColor: color }"
                @click="editingContext.color = color"
                :title="color"
              />
            </div>
          </div>

          <div class="form-group">
            <label>{{ t('context.contextContent') }}</label>
            <textarea
              v-model="editingContext.content"
              :placeholder="t('context.tagContentPlaceholder')"
              class="content-input"
            ></textarea>
          </div>
        </div>

        <div class="dialog-actions">
          <button @click="confirmDeleteContext(editingContext.id, true)" class="delete-btn">{{ t('common.delete') }}</button>
          <div class="dialog-actions-right">
            <button @click="closeEditDialog" class="cancel-btn">{{ t('common.cancel') }}</button>
            <button @click="saveContextEdit" class="confirm-btn">{{ t('common.save') }}</button>
          </div>
        </div>
      </div>
    </div>

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
import TagsPanel from '@/components/TagsPanel.vue'
import SettingsPanel from '@/components/SettingsPanel.vue'
import MultiChatPanel from '@/components/MultiChatPanel.vue'
import PdfReaderPanel from '@/components/PdfReaderPanel.vue'
import CanvasViewPanel from '@/components/CanvasViewPanel.vue'
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

// 当前激活的 tab
const activeTab = ref<string>('all-notebooks')

// 当前激活的笔记本ID
const activeNotebookId = ref<string | null>(null)

// 视图模式：'chat' | 'canvas'（仅在笔记本tab下生效）
const viewMode = ref<'chat' | 'canvas'>('chat')

// 需要激活的节点ID（用于跳转链接）
const activateNodeId = ref<string | null>(null)

// 对话框状态
const showNewContextDialog = ref(false)
const newContextName = ref('')
const newContextType = ref<ContextType>('static')
const newContextColor = ref<ContextColor>(CONTEXT_COLORS[0])
const newContextContent = ref('')

const showEditContextDialog = ref(false)
const editingContext = ref<ContextFile | undefined>(undefined)

const showDeleteConfirm = ref(false)
const contextToDelete = ref<string | null>(null)
const shouldCloseEditDialogAfterDelete = ref(false)

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
async function createContextFile() {
  if (!newContextName.value.trim()) return

  const newFile = await contextStore.createContextFile(
    newContextName.value.trim(),
    newContextType.value,
    newContextContent.value
  )

  // 更新颜色
  if (newFile.color !== newContextColor.value) {
    await contextStore.updateContextFile(newFile.id, {
      color: newContextColor.value
    })
  }

  showNewContextDialog.value = false
  newContextName.value = ''
  newContextType.value = 'static'
  newContextColor.value = CONTEXT_COLORS[0]
  newContextContent.value = ''
}

function editContextFile(file: ContextFile) {
  editingContext.value = { ...file }
  showEditContextDialog.value = true
}

function closeEditDialog() {
  showEditContextDialog.value = false
  editingContext.value = undefined
}

async function saveContextEdit() {
  if (!editingContext.value) return

  await contextStore.updateContextFile(editingContext.value.id, {
    name: editingContext.value.name,
    color: editingContext.value.color,
    content: editingContext.value.content
  })

  closeEditDialog()
}

function confirmDeleteContext(contextId: string, fromEditDialog = false) {
  contextToDelete.value = contextId
  shouldCloseEditDialogAfterDelete.value = fromEditDialog
  showDeleteConfirm.value = true
}

async function deleteContextFile() {
  if (!contextToDelete.value) return

  await contextStore.deleteContextFile(contextToDelete.value)
  showDeleteConfirm.value = false
  contextToDelete.value = null

  if (shouldCloseEditDialogAfterDelete.value) {
    shouldCloseEditDialogAfterDelete.value = false
    closeEditDialog()
  }
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
function handleSwitchViewMode(mode: 'chat' | 'canvas') {
  viewMode.value = mode
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
  overflow: hidden;
  background: var(--bg-primary);
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
  min-width: 600px;
  max-width: 800px;
}

.edit-dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.edit-dialog-header h3 {
  margin: 0;
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  color: var(--text-secondary);
  transition: background 0.2s;
}

.close-btn:hover {
  background: var(--border-color);
}

.edit-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
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
  min-height: 300px;
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