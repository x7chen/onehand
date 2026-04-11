<template>
  <div class="home-view">
    <!-- 左侧侧边栏 -->
    <aside class="sidebar" @dragover="handleSidebarDragOver" @drop="handleSidebarDrop">
      <div class="sidebar-header">
        <h1 class="logo">OneHand</h1>
      </div>

      <nav class="sidebar-nav">
        <button
          class="nav-item"
          :class="{ active: activeTab === 'search' }"
          @click="handleSearchClick"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
          </svg>
          <span>{{ t('common.search') }}</span>
        </button>

        <button
          class="nav-item"
          :class="{ active: activeTab === 'notebooks' }"
          @click="activeTab = 'notebooks'"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="4" y="4" width="16" height="16" rx="2"/>
            <line x1="8" y1="8" x2="16" y2="8"/>
            <line x1="8" y1="12" x2="16" y2="12"/>
            <line x1="8" y1="16" x2="12" y2="16"/>
          </svg>
          <span>{{ t('nav.notebooks') }}</span>
        </button>

        <button
          class="nav-item"
          :class="{ active: activeTab === 'contexts' }"
          @click="activeTab = 'contexts'"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M17.63 5.84C17.27 5.33 16.67 5 16 5L5 5.01C3.9 5.01 3 5.9 3 7v10c0 1.1.9 1.99 2 1.99L16 19c.67 0 1.27-.33 1.63-.84L22 12l-4.37-6.16z"/>
          </svg>
          <span>{{ t('nav.contexts') }}</span>
        </button>

        <button
          class="nav-item"
          :class="{ active: activeTab === 'favorites' }"
          @click="activeTab = 'favorites'"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
          </svg>
          <span>{{ t('nav.favorites') }}</span>
        </button>

        <button
          class="nav-item"
          :class="{ active: activeTab === 'settings' }"
          @click="activeTab = 'settings'"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
          </svg>
          <span>{{ t('nav.settings') }}</span>
        </button>
        <!-- 主题切换按钮 -->
        <button class="nav-item" @click="cycleTheme" :title="t('theme.currentTheme', { name: getThemeLabel() })">
          <!-- 月亮图标 (深色模式) -->
          <svg v-if="getThemeIcon() === 'moon'" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-3.03 0-5.5-2.47-5.5-5.5 0-1.82.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z"/>
          </svg>
          <!-- 太阳图标 (浅色模式) -->
          <svg v-else-if="getThemeIcon() === 'sun'" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0 .39-.39.39-1.03 0-1.41l-1.06-1.06zm1.06-10.96c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41.39.39 1.03.39 1.41 0l1.06-1.06zM7.05 18.36c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41.39.39 1.03.39 1.41 0l1.06-1.06z"/>
          </svg>
          <!-- 自动图标 (跟随系统) -->
          <svg v-else viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zm-7-2h2v-4h4v-2h-4V7h-2v4H8v2h4v4z"/>
          </svg>
          <span>{{ getThemeLabel() }}</span>
        </button>
      </nav>
      <!-- 回收站 -->
      <div
        class="sidebar-trash"
        :class="{ 'drag-over': isDragOverTrash }"
        @dragover="handleTrashDragOver"
        @dragleave="handleTrashDragLeave"
        @drop="handleTrashDrop"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
          <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
        </svg>
        <span>{{ t('nav.trash') }}</span>
      </div>
    </aside>

    <!-- 右侧内容区域 -->
    <main class="main-content">
      <NotebooksPanel
        v-if="activeTab === 'notebooks'"
        @newNotebook="showNewNotebookDialog = true"
        @dragStart="handleNotebookDragStart"
        @dragEnd="handleNotebookDragEnd"
      />
      <ContextsPanel
        v-if="activeTab === 'contexts'"
        @newContext="showNewContextDialog = true"
        @editContext="editContextFile"
        @dragStart="handleContextDragStart"
        @dragEnd="handleContextDragEnd"
        @quickCommandDragStart="handleQuickCommandDragStart"
        @quickCommandDragEnd="handleQuickCommandDragEnd"
      />
      <FavoritesPanel v-if="activeTab === 'favorites'" />
      <SettingsPanel
        v-if="activeTab === 'settings'"
        @dragStart="handleProfileDragStart"
        @dragEnd="handleProfileDragEnd"
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

    <!-- New Notebook Dialog -->
    <div v-if="showNewNotebookDialog" class="dialog-overlay" @click="showNewNotebookDialog = false">
      <div class="dialog" @click.stop>
        <h3>{{ t('notebook.newNotebook') }}</h3>
        <input
          v-model="newNotebookName"
          type="text"
          :placeholder="t('notebook.notebookNamePlaceholder')"
          @keydown.enter="handleCreateNotebookEnter"
          ref="notebookNameInput"
        />

        <!-- PDF 文件选择（可选） -->
        <div class="form-group">
          <label>{{ t('notebook.pdfFile') }}：</label>
          <div class="pdf-file-selector">
            <input
              v-model="newNotebookPdfName"
              type="text"
              :placeholder="t('notebook.pdfFilePlaceholder')"
              readonly
              @click="selectPdfFile"
              class="pdf-input"
            />
            <button v-if="newNotebookPdfPath" @click="clearPdfFile" class="clear-pdf-btn" :title="t('common.clear')">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </button>
            <button @click="selectPdfFile" class="browse-btn">{{ t('common.browse') }}</button>
          </div>
        </div>

        <!-- 选择静态上下文（标签方式） -->
        <div class="form-group">
          <label>{{ t('notebook.staticContext') }}：</label>
          <div v-if="contextStore.staticContextFiles.length > 0" class="context-tags-selector">
            <span
              v-for="file in contextStore.staticContextFiles"
              :key="file.id"
              class="context-tag-selectable"
              :class="{ selected: newNotebookStaticContexts.includes(file.id) }"
              :style="{
                backgroundColor: newNotebookStaticContexts.includes(file.id) ? file.color + '40' : 'var(--bg-secondary)',
                borderColor: newNotebookStaticContexts.includes(file.id) ? file.color : 'var(--border-color)',
                color: newNotebookStaticContexts.includes(file.id) ? file.color : 'var(--text-secondary)'
              }"
              @click="toggleStaticContextSelection(file.id)"
            >
              {{ file.name }}
            </span>
          </div>
          <div v-else class="no-context-hint">
            <span>{{ t('notebook.noStaticContext') }}</span>
          </div>
        </div>

        <!-- 选择动态上下文 -->
        <div class="form-group">
          <label>{{ t('notebook.dynamicContext') }}：</label>
          <select v-model="newNotebookDynamicContext">
            <option value="">{{ t('notebook.noDynamicContext') }}</option>
            <option v-for="file in contextStore.dynamicContextFiles" :key="file.id" :value="file.id">
              {{ file.name }}
            </option>
          </select>
        </div>

        <div class="dialog-actions">
          <button @click="showNewNotebookDialog = false" class="cancel-btn">{{ t('common.cancel') }}</button>
          <button @click="createNotebook" class="confirm-btn">{{ t('common.create') }}</button>
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

    <!-- 笔记本删除确认对话框 -->
    <div v-if="showNotebookDeleteConfirm" class="dialog-overlay" @click="showNotebookDeleteConfirm = false">
      <div class="dialog confirm-dialog" @click.stop>
        <h3>{{ t('notebook.deleteConfirmTitle') }}</h3>
        <p>{{ t('notebook.deleteConfirmMessage', { name: notebookToDelete?.name }) }}</p>
        <div class="dialog-actions">
          <button @click="showNotebookDeleteConfirm = false" class="cancel-btn">{{ t('common.cancel') }}</button>
          <button @click="confirmDeleteNotebook" class="delete-btn confirm-delete">{{ t('common.delete') }}</button>
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

    <!-- 搜索对话框 -->
    <SearchDialog
      :visible="showSearchDialog"
      @close="showSearchDialog = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useNotebookStore } from '@/stores/notebookStore'
import { useContextStore } from '@/stores/contextStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useQuickCommandStore } from '@/stores/quickCommandStore'
import SearchDialog from '@/components/SearchDialog.vue'
import NotebooksPanel from '@/components/NotebooksPanel.vue'
import ContextsPanel from '@/components/ContextsPanel.vue'
import FavoritesPanel from '@/components/FavoritesPanel.vue'
import SettingsPanel from '@/components/SettingsPanel.vue'
import type { ContextFile, ContextType } from '@/types/context'
import { CONTEXT_COLORS, type ContextColor } from '@/types/context'
import type { Notebook } from '@/types/notebook'
import type { QuickCommand } from '@/types/quickCommand'

const notebookStore = useNotebookStore()
const contextStore = useContextStore()
const settingsStore = useSettingsStore()
const quickCommandStore = useQuickCommandStore()
const { t } = useI18n()

const contextColors = computed(() => CONTEXT_COLORS)

// 当前激活的 tab
const activeTab = ref<'notebooks' | 'contexts' | 'favorites' | 'settings' | 'search'>('notebooks')

// 对话框状态
const showNewContextDialog = ref(false)
const newContextName = ref('')
const newContextType = ref<ContextType>('static')
const newContextColor = ref<ContextColor>(CONTEXT_COLORS[0])
const newContextContent = ref('')

const showEditContextDialog = ref(false)
const editingContext = ref<ContextFile | undefined>(undefined)

const showNewNotebookDialog = ref(false)
const newNotebookName = ref('')
const newNotebookPdfPath = ref('')
const newNotebookPdfName = ref('')
const newNotebookStaticContexts = ref<string[]>([])
const newNotebookDynamicContext = ref('')
const notebookNameInput = ref<HTMLInputElement | null>(null)

const showDeleteConfirm = ref(false)
const contextToDelete = ref<string | null>(null)
const shouldCloseEditDialogAfterDelete = ref(false)

// 拖拽删除相关
const isDragOverTrash = ref(false)
const draggedNotebook = ref<Notebook | null>(null)
const draggedContext = ref<ContextFile | null>(null)
const draggedProfileId = ref<string | null>(null)
const draggedQuickCommand = ref<QuickCommand | null>(null)
const showNotebookDeleteConfirm = ref(false)
const notebookToDelete = ref<Notebook | null>(null)
const showQuickCommandDeleteConfirm = ref(false)
const quickCommandToDelete = ref<QuickCommand | null>(null)

// 搜索对话框
const showSearchDialog = ref(false)

// 主题切换
const currentTheme = computed(() => settingsStore.settings.general.theme)
const themeOrder: ('dark' | 'light' | 'system')[] = ['dark', 'light', 'system']

function cycleTheme() {
  const currentIndex = themeOrder.indexOf(currentTheme.value)
  const nextIndex = (currentIndex + 1) % themeOrder.length
  const nextTheme = themeOrder[nextIndex]

  settingsStore.updateSettings({
    general: {
      ...settingsStore.settings.general,
      theme: nextTheme
    }
  })
}

function getThemeIcon() {
  switch (currentTheme.value) {
    case 'dark':
      return 'moon'
    case 'light':
      return 'sun'
    case 'system':
      return 'auto'
    default:
      return 'auto'
  }
}

function getThemeLabel() {
  switch (currentTheme.value) {
    case 'dark':
      return t('settings.themeDark')
    case 'light':
      return t('settings.themeLight')
    case 'system':
      return t('settings.themeSystem')
    default:
      return t('settings.themeSystem')
  }
}

onMounted(() => {
  notebookStore.loadNotebooks()
  contextStore.loadContextFiles()
})

// 搜索点击处理
function handleSearchClick() {
  showSearchDialog.value = true
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

// Notebook management
// 处理 Enter 键创建笔记本（检查输入法组合状态）
function handleCreateNotebookEnter(event: KeyboardEvent) {
  if (event.isComposing) return
  event.preventDefault()
  createNotebook()
}

async function createNotebook() {
  let notebookName = newNotebookName.value.trim()
  if (!notebookName && newNotebookPdfPath.value) {
    const fileName = newNotebookPdfPath.value.split(/[/\\]/).pop() || ''
    notebookName = fileName.replace(/\.pdf$/i, '') || 'PDF 笔记本'
  }

  if (!notebookName) return

  const context = {
    staticContextIds: newNotebookStaticContexts.value.length > 0 ? newNotebookStaticContexts.value : undefined,
    dynamicContextId: newNotebookDynamicContext.value || undefined
  }

  const pdfPath = newNotebookPdfPath.value || undefined

  const notebook = await notebookStore.createNotebook(
    notebookName,
    (context.staticContextIds || context.dynamicContextId) ? context : undefined,
    pdfPath
  )

  showNewNotebookDialog.value = false
  newNotebookName.value = ''
  newNotebookPdfPath.value = ''
  newNotebookPdfName.value = ''
  newNotebookStaticContexts.value = []
  newNotebookDynamicContext.value = ''

  // 切换到笔记本 tab
  activeTab.value = 'notebooks'
}

function toggleStaticContextSelection(contextId: string) {
  const index = newNotebookStaticContexts.value.indexOf(contextId)
  if (index === -1) {
    newNotebookStaticContexts.value.push(contextId)
  } else {
    newNotebookStaticContexts.value.splice(index, 1)
  }
}

function clearPdfFile() {
  newNotebookPdfPath.value = ''
  newNotebookPdfName.value = ''
}

async function selectPdfFile() {
  try {
    const result = await window.electronAPI.showOpenDialog({
      title: '选择 PDF 文件',
      filters: [{ name: 'PDF 文件', extensions: ['pdf'] }],
      properties: ['openFile']
    })
    if (result.canceled || !result.filePaths || result.filePaths.length === 0) return
    newNotebookPdfPath.value = result.filePaths[0]
    const fileName = result.filePaths[0].split(/[/\\]/).pop()
    newNotebookPdfName.value = fileName || result.filePaths[0]
  } catch (error) {
    console.error('Failed to select PDF file:', error)
  }
}

// 拖拽删除功能
function handleNotebookDragStart(e: DragEvent, notebook: Notebook) {
  draggedNotebook.value = notebook
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', notebook.id)
    const target = e.target as HTMLElement
    target.style.opacity = '0.5'
  }
}

function handleNotebookDragEnd(e: DragEvent) {
  const target = e.target as HTMLElement
  target.style.opacity = '1'
  draggedNotebook.value = null
  isDragOverTrash.value = false
}

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
  isDragOverTrash.value = false
}

function handleProfileDragStart(e: DragEvent, profileId: string) {
  draggedProfileId.value = profileId
  isDragOverTrash.value = false
}

function handleProfileDragEnd(e: DragEvent) {
  draggedProfileId.value = null
  isDragOverTrash.value = false
}

function handleQuickCommandDragStart(e: DragEvent, cmd: QuickCommand) {
  draggedQuickCommand.value = cmd
  isDragOverTrash.value = false
}

function handleQuickCommandDragEnd(e: DragEvent) {
  draggedQuickCommand.value = null
  isDragOverTrash.value = false
}

function handleSidebarDragOver(e: DragEvent) {
  // Allow drag over sidebar
}

function handleSidebarDrop(e: DragEvent) {
  // Reset state
  isDragOverTrash.value = false
}

function handleTrashDragOver(e: DragEvent) {
  e.preventDefault()
  e.stopPropagation()
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'move'
  }
  isDragOverTrash.value = true
}

function handleTrashDragLeave() {
  isDragOverTrash.value = false
}

function handleTrashDrop(e: DragEvent) {
  e.preventDefault()
  e.stopPropagation()
  isDragOverTrash.value = false

  const profileId = e.dataTransfer?.getData('application/profile')
  if (profileId && draggedProfileId.value && settingsStore.settings.llm.profiles.length > 1) {
    // 删除模型配置，无需确认对话框
    settingsStore.removeProfile(profileId)
    draggedProfileId.value = null
    return
  }

  // 删除快捷指令，显示确认对话框
  if (draggedQuickCommand.value) {
    quickCommandToDelete.value = draggedQuickCommand.value
    showQuickCommandDeleteConfirm.value = true
    return
  }

  const notebookId = e.dataTransfer?.getData('text/plain')
  if (notebookId && draggedNotebook.value) {
    notebookToDelete.value = draggedNotebook.value
    showNotebookDeleteConfirm.value = true
  } else if (draggedContext.value) {
    contextToDelete.value = draggedContext.value.id
    showDeleteConfirm.value = true
  }
}

async function confirmDeleteNotebook() {
  if (notebookToDelete.value) {
    await notebookStore.deleteNotebook(notebookToDelete.value.id)
    showNotebookDeleteConfirm.value = false
    notebookToDelete.value = null
  }
}

async function confirmDeleteQuickCommand() {
  if (quickCommandToDelete.value) {
    await quickCommandStore.deleteQuickCommand(quickCommandToDelete.value.id)
    showQuickCommandDeleteConfirm.value = false
    quickCommandToDelete.value = null
  }
}
</script>

<style scoped>
.home-view {
  height: 100%;
  display: flex;
  background: var(--bg-secondary);
}

/* 侧边栏样式 */
.sidebar {
  width: 180px;
  background: var(--bg-primary);
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--border-color);
  flex-shrink: 0;
}

.sidebar-header {
  padding: 16px;
  border-bottom: 1px solid var(--border-color);
  text-align: center;
}

.logo {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.sidebar-nav {
  flex: 1;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: transparent;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  color: var(--text-secondary);
  font-size: 14px;
  transition: all 0.2s;
  text-align: left;
  width: 100%;
}

.nav-item:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.nav-item.active {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.nav-item svg {
  flex-shrink: 0;
}

.sidebar-trash {
  display: flex;
  align-items: center;
  height: 100px;
  gap: 12px;
  padding: 12px 16px;
  margin: 8px;
  border-radius: 8px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
  border: 2px dashed transparent;
}

.sidebar-trash:hover {
  background: rgba(255, 68, 68, 0.1);
  color: var(--color-error);
}

.sidebar-trash.drag-over {
  background: rgba(255, 68, 68, 0.15);
  border-color: var(--color-error);
  color: var(--color-error);
}

.sidebar-trash svg {
  flex-shrink: 0;
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

.pdf-file-selector {
  display: flex;
  gap: 8px;
  align-items: stretch;
}

.pdf-input {
  flex: 1;
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 14px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  cursor: pointer;
  height: 38px;
  box-sizing: border-box;
}

.pdf-input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.clear-pdf-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
  box-sizing: border-box;
}

.clear-pdf-btn:hover {
  background: var(--color-error);
  border-color: var(--color-error);
  color: white;
}

.browse-btn {
  padding: 0 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  cursor: pointer;
  color: var(--text-primary);
  height: 38px;
  box-sizing: border-box;
}

.browse-btn:hover {
  background: var(--border-color);
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

.context-tags-selector {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  min-height: 44px;
}

.context-tag-selectable {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 12px;
  border: 1px solid;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.2s;
  user-select: none;
}

.context-tag-selectable:hover {
  transform: scale(1.05);
}

.context-tag-selectable.selected {
  font-weight: 600;
}

.no-context-hint {
  padding: 12px;
  color: var(--text-secondary);
  font-size: 13px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
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