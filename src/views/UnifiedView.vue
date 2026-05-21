<template>
  <div class="unified-view">
    <!-- 主体内容区域（活动栏 + 侧边栏 + 主内容） -->
    <div class="content-row">
      <!-- 活动栏 -->
      <ActivityBar
        :active-item="activeActivity"
        @select="handleActivitySelect"
        @create-note="handleCreateNote"
        @toggle-collapse="toggleSidebar"
      />

      <!-- 主侧边栏 -->
      <MainSidebar
        :active-activity="activeActivity"
        :sidebar-width="sidebarWidth"
        :sidebar-collapsed="sidebarCollapsed"
        :notebooks="notebookStore.notebooks"
        :active-notebook-id="activeNotebookId"
        :pinned-notebook-ids="settingsStore.settings.general.pinnedNotebookIds || []"
        :pinned-all-notebooks="settingsStore.settings.general.pinnedAllNotebooks || false"
        :static-contexts="contextStore.staticContextFiles"
        :dynamic-contexts="contextStore.dynamicContextFiles"
        :quick-commands="quickCommandStore.quickCommands"
        :tags="tagGroups"
        :selected-context-id="selectedContextId"
        :selected-quick-command-id="selectedQuickCommandId"
        :selected-tag-name="selectedTagName"
        :filter-notebook-id="favoriteFilterNotebookId"
        :filter-time-type="favoriteFilterTimeType"
        :filter-date-start="favoriteFilterDateStart"
        :filter-date-end="favoriteFilterDateEnd"
        :settings-tab="settingsTab"
        :trash-tab="trashTab"
        @toggle-collapse="toggleSidebar"
        @select-notebook="handleSelectNotebook"
        @create-notebook="handleCreateNotebook"
        @open-canvas="handleOpenCanvas"
        @open-particle="handleOpenParticle"
        @create-context="handleCreateContext"
        @select-context="handleSelectContext"
        @create-quick-command="handleCreateQuickCommand"
        @select-quick-command="handleSelectQuickCommand"
        @select-tag="handleSelectTag"
        @update-filter="handleUpdateFavoriteFilter"
        @select-settings-tab="handleSelectSettingsTab"
        @select-trash-tab="handleSelectTrashTab"
        @edit-context="editContextFile"
        @edit-quick-command="editQuickCommand"
        @rename-notebook="handleRenameNotebook"
        @delete-notebook="handleDeleteNotebook"
        @toggle-pin="handleTogglePin"
        @toggle-pin-all="handleTogglePinAll"
        @reorder-pinned="handleReorderPinned"
        @activate-node="handleActivateNodeFromSidebar"
      />

      <!-- 右侧内容区域 -->
      <main class="main-content">
        <!-- 笔记本内容 -->
        <template v-if="activeActivity === 'notebooks'">
          <!-- MultiChatPanel -->
          <MultiChatPanel
            v-if="viewMode === 'chat' && activeNotebookId && !currentNotebook?.pdfPath"
            :notebook-id="activeNotebookId"
            :static-context-files="staticContextFiles"
            :all-static-context-files="contextStore.staticContextFiles"
            :all-dynamic-context-files="contextStore.dynamicContextFiles"
            :dynamic-context-file="dynamicContextFile || null"
            :all-profiles="settingsStore.settings.llm.profiles"
            :active-profile-id="settingsStore.settings.llm.activeProfileId"
            :activate-node-id="activateNodeId"
            :trigger-create-note="shouldTriggerCreateNote"
            :context-mode="contextMode"
            @node-activated="handleNodeActivated"
            @create-note-triggered="handleCreateNoteTriggered"
          />

          <!-- Canvas画布面板 -->
          <CanvasViewPanel
            ref="canvasViewPanelRef"
            v-if="viewMode === 'canvas' && activeNotebookId"
            :notebook-id="activeNotebookId"
            :static-context-files="staticContextFiles"
            :all-static-context-files="contextStore.staticContextFiles"
            :all-dynamic-context-files="contextStore.dynamicContextFiles"
            :dynamic-context-file="dynamicContextFile || null"
            :ai-answer-enabled="aiAnswerEnabled"
            :context-mode="contextMode"
            @toggle-static-context="toggleStaticContext"
            @select-dynamic-context="selectDynamicContext"
            @dynamic-context-drop="handleDynamicContextDrop"
          />

          <!-- 粒子视图面板 -->
          <ParticleViewPanel
            v-if="viewMode === 'particle' && activeNotebookId"
            :notebook-id="activeNotebookId"
            @switch-to-chat="handleSwitchViewMode('chat')"
            @select-node="handleParticleSelectNode"
            @navigate="handleParticleNavigate"
          />

          <!-- PDF笔记本面板 -->
          <PdfReaderPanel
            v-if="viewMode === 'chat' && activeNotebookId && currentNotebook?.pdfPath"
            :notebook-id="activeNotebookId"
            :static-context-files="staticContextFiles"
            :all-static-context-files="contextStore.staticContextFiles"
            :all-dynamic-context-files="contextStore.dynamicContextFiles"
            :dynamic-context-file="dynamicContextFile || null"
            :all-profiles="settingsStore.settings.llm.profiles"
            :active-profile-id="settingsStore.settings.llm.activeProfileId"
            :activate-node-id="activateNodeId"
            :context-mode="contextMode"
            @node-activated="handleNodeActivated"
          />
        </template>

        <!-- 上下文编辑面板 -->
        <ContextEditPanel
          v-if="activeActivity === 'contexts'"
          :context="selectedContext"
          :quick-command="selectedQuickCommand"
          :is-creating="isCreatingContext"
          @save="handleContextSavePanel"
          @delete="handleContextDeletePanel"
          @cancel="handleContextEditCancel"
        />

        <!-- 标签面板 -->
        <TagsPanel
          v-if="activeActivity === 'tags'"
          :selected-tag-name="selectedTagName"
          @tag-selected="handleTagSelected"
        />

        <!-- 收藏夹面板 -->
        <FavoritesPanel
          v-if="activeActivity === 'favorites'"
          :filter-notebook-id="favoriteFilterNotebookId"
          :filter-time-type="favoriteFilterTimeType"
          :filter-date-start="favoriteFilterDateStart"
          :filter-date-end="favoriteFilterDateEnd"
        />

        <!-- 回收站面板 -->
        <TrashPanel
          v-if="activeActivity === 'trash'"
          :active-tab="trashTab"
        />

        <!-- 设置面板 -->
        <SettingsPanel
          v-if="activeActivity === 'settings'"
          :active-tab="settingsTab"
          @dragStart="handleProfileDragStart"
          @dragEnd="handleProfileDragEnd"
        />
      </main>

      <!-- 辅助侧边栏 -->
      <AuxiliarySidebar />
    </div>

    <!-- 状态栏（整个界面底部） -->
    <StatusBar
      :active-tab="activeActivity"
      :view-mode="viewMode"
      :active-notebook-id="activeNotebookId"
      :selected-tag-name="selectedTagName"
      :settings-tab="settingsTab"
      :ai-answer-enabled="aiAnswerEnabled"
      :context-mode="contextMode"
      :all-profiles="settingsStore.settings.llm.profiles"
      :active-profile-id="settingsStore.settings.llm.activeProfileId"
      @update:ai-answer-enabled="aiAnswerEnabled = $event"
      @update:context-mode="contextMode = $event"
      @select-model="handleSelectModel"
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
import { useTagStore } from '@/stores/tagStore'
import ActivityBar from '@/components/ActivityBar.vue'
import MainSidebar from '@/components/MainSidebar.vue'
import FavoritesPanel from '@/components/FavoritesPanel.vue'
import TrashPanel from '@/components/TrashPanel.vue'
import TagsPanel from '@/components/TagsPanel.vue'
import SettingsPanel from '@/components/SettingsPanel.vue'
import MultiChatPanel from '@/components/MultiChatPanel.vue'
import PdfReaderPanel from '@/components/PdfReaderPanel.vue'
import CanvasViewPanel from '@/components/CanvasViewPanel.vue'
import ParticleViewPanel from '@/components/ParticleViewPanel.vue'
import ContextEditPanel from '@/components/ContextEditPanel.vue'
import StatusBar from '@/components/StatusBar.vue'
import AuxiliarySidebar from '@/components/AuxiliarySidebar.vue'
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
const tagStore = useTagStore()

const contextColors = computed(() => CONTEXT_COLORS)

// CanvasViewPanel 的引用（用于激活节点）
const canvasViewPanelRef = ref<InstanceType<typeof CanvasViewPanel> | null>(null)

// 活动栏选中项（从settingsStore获取）
const activeActivity = ref(settingsStore.settings.general.activeActivityItem || 'notebooks')

// 当前激活的笔记本ID
const activeNotebookId = ref<string | null>(settingsStore.settings.general.defaultNotebookId || null)

// 视图模式：'chat' | 'canvas' | 'particle'（仅在笔记本tab下生效）
const viewMode = ref<'chat' | 'canvas' | 'particle'>('chat')

// 需要激活的节点ID（用于跳转链接）
const activateNodeId = ref<string | null>(null)

const showDeleteConfirm = ref(false)
const contextToDelete = ref<string | null>(null)

// 拖拽相关
const draggedProfileId = ref<string | null>(null)
const showQuickCommandDeleteConfirm = ref(false)
const quickCommandToDelete = ref<QuickCommand | null>(null)

// 侧边栏状态（从settingsStore获取）
const sidebarWidth = ref(settingsStore.settings.general.sidebarWidth || 200)
const sidebarCollapsed = ref(settingsStore.settings.general.sidebarCollapsed || false)

// 选中的上下文/快捷指令（用于上下文视图）
const selectedContextId = ref<string | null>(null)
const selectedQuickCommandId = ref<string | null>(null)

// 新建上下文/快捷指令状态
const isCreatingContext = ref<'static' | 'dynamic' | 'quickCommand' | false>(false)

// 选中的上下文/快捷指令对象
const selectedContext = computed(() => {
  if (!selectedContextId.value) return null
  return contextStore.staticContextFiles.find(f => f.id === selectedContextId.value) ||
         contextStore.dynamicContextFiles.find(f => f.id === selectedContextId.value) || null
})

const selectedQuickCommand = computed(() => {
  if (!selectedQuickCommandId.value) return null
  return quickCommandStore.quickCommands.find(c => c.id === selectedQuickCommandId.value) || null
})

// 标签面板选中的标签名称
const selectedTagName = ref<string | null>(null)

// 收藏过滤器
const favoriteFilterNotebookId = ref<string | null>(null)
const favoriteFilterTimeType = ref<string | null>(null)
const favoriteFilterDateStart = ref<string>('')
const favoriteFilterDateEnd = ref<string>('')

// 设置tab
const settingsTab = ref<'general' | 'model'>('general')

// 回收站tab
const trashTab = ref<'notes' | 'notebooks' | 'contexts' | 'quickCommands'>('notes')

// AI 回答开关状态（从设置中读取默认值）
const aiAnswerEnabled = ref(settingsStore.settings.general.autoAiAnswer ?? true)

// 上下文模式：关闭 / 自动勾选 / RAG上下文
const contextMode = ref<'off' | 'auto' | 'rag'>('off')

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

// 当前笔记本
const currentNotebook = computed(() => notebookStore.currentNotebook)

// 标签列表（用于标签侧边栏）- 需要从笔记本中计算
interface TaggedNodeItem {
  notebookId: string
  notebookName: string
  nodeId: string
  nodeTitle: string
  pdfPage?: number
  fullText: string
}

interface TagGroup {
  tagName: string
  tagColor: string
  nodes: TaggedNodeItem[]
}

const tagGroups = computed(() => {
  const groups: Map<string, TagGroup> = new Map()

  notebookStore.notebooks.forEach(notebook => {
    notebook.nodes?.forEach(node => {
      if (node.tags && node.tags.length > 0) {
        node.tags.forEach((tagName: string) => {
          if (!groups.has(tagName)) {
            const tag = tagStore.tags.find(t => t.name === tagName)
            groups.set(tagName, {
              tagName,
              tagColor: tag?.color || '#66bb6a',
              nodes: []
            })
          }
          groups.get(tagName)!.nodes.push({
            notebookId: notebook.id,
            notebookName: notebook.name,
            nodeId: node.id,
            nodeTitle: node.title || '',
            pdfPage: node.pdfPage,
            fullText: node.transcript || ''
          })
        })
      }
    })
  })

  return Array.from(groups.values())
})

onMounted(async () => {
  await notebookStore.loadNotebooks()
  await contextStore.loadContextFiles()
  await quickCommandStore.loadQuickCommands()
  await tagStore.loadTags()

  // 验证默认笔记本是否存在
  const defaultNotebookId = settingsStore.settings.general.defaultNotebookId
  if (defaultNotebookId) {
    const notebook = notebookStore.notebooks.find(nb => nb.id === defaultNotebookId)
    if (notebook) {
      notebookStore.setCurrentNotebook(notebook)
    } else {
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

  // 设置活动栏和视图模式
  activeActivity.value = 'notebooks'
  viewMode.value = 'chat'

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

// 活动栏选中处理
function handleActivitySelect(itemId: string) {
  activeActivity.value = itemId

  // 保存到settingsStore
  settingsStore.updateSettings({
    general: {
      ...settingsStore.settings.general,
      activeActivityItem: itemId
    }
  })

  // 如果不是笔记本视图，清除笔记本选中
  if (itemId !== 'notebooks') {
    // 保持笔记本状态但不显示
  }

  // 重置视图模式为chat
  viewMode.value = 'chat'
}

// 切换侧边栏显示/隐藏
function toggleSidebar() {
  sidebarCollapsed.value = !sidebarCollapsed.value

  // 保存到settingsStore
  settingsStore.updateSettings({
    general: {
      ...settingsStore.settings.general,
      sidebarCollapsed: sidebarCollapsed.value
    }
  })
}

// 笔记本选择处理
function handleSelectNotebook(notebookId: string | null) {
  activeNotebookId.value = notebookId
  viewMode.value = 'chat'

  if (notebookId) {
    const notebook = notebookStore.notebooks.find(nb => nb.id === notebookId)
    if (notebook) {
      notebookStore.setCurrentNotebook(notebook)
    }
  }
}

// 打开画布视图
function handleOpenCanvas(notebookId: string) {
  handleSelectNotebook(notebookId)
  viewMode.value = 'canvas'
}

// 打开粒子视图
function handleOpenParticle(notebookId: string) {
  handleSelectNotebook(notebookId)
  viewMode.value = 'particle'
}

// 处理上下文选择
function handleSelectContext(contextId: string | null) {
  selectedContextId.value = contextId
  selectedQuickCommandId.value = null
  isCreatingContext.value = false
}

// 处理快捷指令选择
function handleSelectQuickCommand(commandId: string | null) {
  selectedQuickCommandId.value = commandId
  selectedContextId.value = null
  isCreatingContext.value = false
}

// 处理创建上下文
function handleCreateContext(type: 'static' | 'dynamic') {
  // 切换到上下文视图
  activeActivity.value = 'contexts'
  settingsStore.updateSettings({
    general: {
      ...settingsStore.settings.general,
      activeActivityItem: 'contexts'
    }
  })
  // 清除选中，设置新建状态
  selectedContextId.value = null
  selectedQuickCommandId.value = null
  isCreatingContext.value = type
}

// 处理创建快捷指令
function handleCreateQuickCommand() {
  // 切换到上下文视图
  activeActivity.value = 'contexts'
  settingsStore.updateSettings({
    general: {
      ...settingsStore.settings.general,
      activeActivityItem: 'contexts'
    }
  })
  // 清除选中，设置新建状态
  selectedContextId.value = null
  selectedQuickCommandId.value = null
  isCreatingContext.value = 'quickCommand'
}

// 处理标签选择
function handleSelectTag(tagName: string | null) {
  selectedTagName.value = tagName
}

// 标签面板选中标签处理（保持兼容）
function handleTagSelected(tagName: string | null) {
  selectedTagName.value = tagName
}

// 处理收藏过滤器更新
function handleUpdateFavoriteFilter(filter: { notebookId?: string | null; timeType?: string | null; dateStart?: string; dateEnd?: string }) {
  if (filter.notebookId !== undefined) {
    favoriteFilterNotebookId.value = filter.notebookId
  }
  if (filter.timeType !== undefined) {
    favoriteFilterTimeType.value = filter.timeType
  }
  if (filter.dateStart !== undefined) {
    favoriteFilterDateStart.value = filter.dateStart
  }
  if (filter.dateEnd !== undefined) {
    favoriteFilterDateEnd.value = filter.dateEnd
  }
}

// 处理设置tab选择
function handleSelectSettingsTab(tab: 'general' | 'model') {
  settingsTab.value = tab
}

// 处理回收站tab选择
function handleSelectTrashTab(tab: 'notes' | 'notebooks' | 'contexts' | 'quickCommands') {
  trashTab.value = tab
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
  activeActivity.value = 'notebooks'
}

// 创建笔记 - 触发输入模式
function handleCreateNote() {
  // 如果当前不在笔记本视图，切换到笔记本视图
  if (activeActivity.value !== 'notebooks') {
    activeActivity.value = 'notebooks'
    settingsStore.updateSettings({
      general: {
        ...settingsStore.settings.general,
        activeActivityItem: 'notebooks'
      }
    })
  }

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
    handleSelectNotebook(targetNotebookId)
  }

  // 确保视图模式为 chat
  viewMode.value = 'chat'

  // 触发创建笔记输入
  shouldTriggerCreateNote.value = true
}

// 重命名笔记本
async function handleRenameNotebook(notebookId: string, newName: string) {
  const notebook = notebookStore.notebooks.find(n => n.id === notebookId)
  if (notebook) {
    notebook.name = newName
    await notebookStore.saveNotebook(notebook)
  }
}

// 删除笔记本
async function handleDeleteNotebook(notebookId: string) {
  await notebookStore.deleteNotebook(notebookId)
  if (activeNotebookId.value === notebookId) {
    activeNotebookId.value = null
  }
}

// 固定/取消固定笔记本
function handleTogglePin(notebookId: string) {
  const pinnedIds = settingsStore.settings.general.pinnedNotebookIds || []
  const index = pinnedIds.indexOf(notebookId)

  if (index === -1) {
    settingsStore.updateSettings({
      general: {
        ...settingsStore.settings.general,
        pinnedNotebookIds: [...pinnedIds, notebookId]
      }
    })
  } else {
    const newIds = [...pinnedIds]
    newIds.splice(index, 1)
    settingsStore.updateSettings({
      general: {
        ...settingsStore.settings.general,
        pinnedNotebookIds: newIds
      }
    })
  }
}

// 固定/取消固定全部笔记本
function handleTogglePinAll() {
  const currentState = settingsStore.settings.general.pinnedAllNotebooks || false
  settingsStore.updateSettings({
    general: {
      ...settingsStore.settings.general,
      pinnedAllNotebooks: !currentState
    }
  })
}

// 重新排序固定的笔记本
function handleReorderPinned(pinnedIds: string[]) {
  settingsStore.updateSettings({
    general: {
      ...settingsStore.settings.general,
      pinnedNotebookIds: pinnedIds
    }
  })
}

// 从侧边栏激活节点
function handleActivateNodeFromSidebar(nodeId: string) {
  activateNodeId.value = nodeId
}

// Context file management
function editContextFile(file: ContextFile) {
  selectedContextId.value = file.id
  selectedQuickCommandId.value = null
  isCreatingContext.value = false
}

// 处理编辑快捷指令
function editQuickCommand(cmd: QuickCommand) {
  selectedQuickCommandId.value = cmd.id
  selectedContextId.value = null
  isCreatingContext.value = false
}

// 处理上下文保存（新建或编辑）
async function handleContextSavePanel(data: { name: string; type: ContextType; color: ContextColor; content: string; isNew: boolean }) {
  if (data.isNew) {
    // 新建上下文或快捷指令
    if (isCreatingContext.value === 'quickCommand') {
      const newCmd = await quickCommandStore.createQuickCommand(data.name, data.content)
      if (newCmd.color !== data.color) {
        await quickCommandStore.updateQuickCommand(newCmd.id, { color: data.color })
      }
      // 选中新创建的快捷指令
      selectedQuickCommandId.value = newCmd.id
    } else {
      const newFile = await contextStore.createContextFile(
        data.name,
        data.type,
        data.content
      )
      if (newFile.color !== data.color) {
        await contextStore.updateContextFile(newFile.id, { color: data.color })
      }
      // 选中新创建的上下文
      selectedContextId.value = newFile.id
    }
    isCreatingContext.value = false
  } else {
    // 编辑现有上下文或快捷指令
    if (selectedQuickCommand.value) {
      await quickCommandStore.updateQuickCommand(selectedQuickCommand.value.id, {
        name: data.name,
        color: data.color,
        content: data.content
      })
    } else if (selectedContext.value) {
      await contextStore.updateContextFile(selectedContext.value.id, {
        name: data.name,
        type: data.type,
        color: data.color,
        content: data.content
      })
    }
  }
}

// 处理上下文/快捷指令删除（从面板）
function handleContextDeletePanel(itemId: string, type: 'context' | 'quickCommand') {
  if (type === 'context') {
    contextToDelete.value = itemId
    showDeleteConfirm.value = true
  } else {
    const cmd = quickCommandStore.quickCommands.find(c => c.id === itemId)
    if (cmd) {
      quickCommandToDelete.value = cmd
      showQuickCommandDeleteConfirm.value = true
    }
  }
}

// 处理上下文编辑取消
function handleContextEditCancel() {
  isCreatingContext.value = false
  // 如果没有选中的项目，选中第一个上下文
  if (!selectedContextId.value && !selectedQuickCommandId.value) {
    if (contextStore.staticContextFiles.length > 0) {
      selectedContextId.value = contextStore.staticContextFiles[0].id
    } else if (contextStore.dynamicContextFiles.length > 0) {
      selectedContextId.value = contextStore.dynamicContextFiles[0].id
    }
  }
}

async function deleteContextFile() {
  if (!contextToDelete.value) return

  await contextStore.deleteContextFile(contextToDelete.value)
  showDeleteConfirm.value = false
  contextToDelete.value = null
  // 清除选中状态
  if (selectedContextId.value === contextToDelete.value) {
    selectedContextId.value = null
  }
}

function handleProfileDragStart(e: DragEvent, profileId: string) {
  draggedProfileId.value = profileId
}

function handleProfileDragEnd(e: DragEvent) {
  draggedProfileId.value = null
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
  // 只更新当前笔记本的 modelId，不改变全局 activeProfileId
  const currentNotebook = notebookStore.currentNotebook
  if (currentNotebook) {
    currentNotebook.modelId = modelId
    notebookStore.saveNotebook(currentNotebook)
  }
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
  flex-direction: column;
  background: var(--bg-secondary);
}

/* 主体内容区域（侧边栏 + 主内容） */
.content-row {
  flex: 1;
  display: flex;
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
  background: var(--color-primary);
  opacity: 0.5;
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
  display: flex;
  flex-direction: column;
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
  font-size: var(--font-size-title);
  color: var(--text-primary);
}

.dialog input[type="text"] {
  width: 100%;
  padding: 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: var(--font-size-heading);
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
  font-size: var(--font-size-heading);
  color: var(--text-secondary);
}

.form-group select {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: var(--font-size-heading);
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
  font-size: var(--font-size-heading);
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