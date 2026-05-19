<template>
  <div class="status-bar">
    <!-- 左侧：上下文编辑状态 -->
    <template v-if="showContextEditDialog">
      <div class="status-item">
        <span class="status-value path-value">{{ t('statusBar.context') }}</span>
      </div>
      <div class="status-separator"></div>
      <div class="status-item">
        <span class="status-value">{{ editingContextName ? t('statusBar.editContext') : t('statusBar.createContext') }}</span>
      </div>
      <div class="status-separator" v-if="editingContextName"></div>
      <div class="status-item" v-if="editingContextName">
        <span class="status-value title-value">{{ editingContextName }}</span>
      </div>
    </template>

    <!-- 快捷指令编辑状态 -->
    <template v-else-if="quickCommandEditingStatus">
      <div class="status-item">
        <span class="status-value path-value">{{ t('statusBar.quickCommand') }}</span>
      </div>
      <div class="status-separator"></div>
      <div class="status-item">
        <span class="status-value">{{ quickCommandEditingStatus.isCreating ? t('statusBar.createQuickCommand') : t('statusBar.editQuickCommand') }}</span>
      </div>
      <div class="status-separator" v-if="quickCommandEditingStatus.name"></div>
      <div class="status-item" v-if="quickCommandEditingStatus.name">
        <span class="status-value title-value">{{ quickCommandEditingStatus.name }}</span>
      </div>
    </template>

    <!-- 笔记本面板 -->
    <template v-else-if="isNotebookPanel">
      <div class="status-item">
        <span class="status-value path-value">{{ notebookViewLabel }}</span>
      </div>
      <div class="status-separator"></div>
      <div class="status-item">
        <span class="status-value">{{ viewModeLabel }}</span>
      </div>
      <template v-if="activeNode">
        <div class="status-separator"></div>
        <div class="status-item title-item">
          <span class="status-label">{{ t('statusBar.title') }}:</span>
          <span class="status-value title-value">{{ displayTitle }}</span>
        </div>
        <div class="status-separator"></div>
        <div class="status-item">
          <span class="status-label">{{ t('statusBar.createdAt') }}:</span>
          <span class="status-value">{{ formatDate(activeNode.createdAt) }}</span>
        </div>
        <div class="status-separator"></div>
        <div class="status-item">
          <span class="status-label">{{ t('statusBar.updatedAt') }}:</span>
          <span class="status-value">{{ formatDate(activeNode.updatedAt || activeNode.createdAt) }}</span>
        </div>
        <div class="status-separator" v-if="activeNode.tags && activeNode.tags.length > 0"></div>
        <div class="status-item" v-if="activeNode.tags && activeNode.tags.length > 0">
          <span class="status-label">{{ t('statusBar.tags') }}:</span>
          <span class="status-value tags-value">
            <span class="tag-badge" v-for="tag in activeNode.tags" :key="tag">{{ tag }}</span>
          </span>
        </div>
        <div class="status-separator"></div>
        <div class="status-item">
          <span class="status-label">{{ t('statusBar.wordCount') }}:</span>
          <span class="status-value">{{ wordCount }}</span>
        </div>
        <div class="status-separator" v-if="activeNode.isFavorite"></div>
        <div class="status-item favorite-item" v-if="activeNode.isFavorite">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" class="favorite-icon">
            <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
          </svg>
        </div>
      </template>
    </template>

    <!-- 标签面板 -->
    <template v-else-if="activeTab === 'tags'">
      <div class="status-item">
        <span class="status-value path-value">{{ t('statusBar.tagsPanel') }}</span>
      </div>
      <div class="status-separator" v-if="selectedTagName"></div>
      <div class="status-item" v-if="selectedTagName">
        <span class="status-value">{{ selectedTagName }}</span>
      </div>
    </template>

    <!-- 设置面板 -->
    <template v-else-if="activeTab === 'settings'">
      <div class="status-item">
        <span class="status-value path-value">{{ t('statusBar.settings') }}</span>
      </div>
      <div class="status-separator" v-if="settingsTabLabel"></div>
      <div class="status-item" v-if="settingsTabLabel">
        <span class="status-value">{{ settingsTabLabel }}</span>
      </div>
    </template>

    <!-- 其他面板 -->
    <template v-else>
      <div class="status-item">
        <span class="status-value path-value">{{ panelLabel }}</span>
      </div>
    </template>

    <!-- 右侧：模型、AI 回答和自动勾选状态（仅笔记本面板时显示） -->
    <template v-if="isNotebookPanel">
      <div class="status-right">
        <!-- 当前模型 -->
        <div class="status-separator"></div>
        <div class="status-item clickable" @click="toggleModelDropdown">
          <span class="status-label">{{ t('statusBar.currentModel') }}:</span>
          <span class="status-value model-value">{{ currentModelName }}</span>
        </div>

        <!-- AI 回答状态 -->
        <div class="status-separator"></div>
        <div class="status-item clickable" @click="toggleAiDropdown">
          <span class="status-label">{{ t('statusBar.aiAnswer') }}:</span>
          <span class="status-value toggle-value" :class="{ enabled: aiAnswerEnabled }">
            {{ aiAnswerEnabled ? t('statusBar.aiAnswerEnabled') : t('statusBar.aiAnswerDisabled') }}
          </span>
        </div>

        <!-- 自动勾选状态 -->
        <div class="status-separator"></div>
        <div class="status-item clickable" @click="toggleAutoSelectDropdown">
          <span class="status-label">{{ t('statusBar.autoSelect') }}:</span>
          <span class="status-value toggle-value" :class="{ enabled: autoSelectNewNote }">
            {{ autoSelectNewNote ? t('statusBar.autoSelectEnabled') : t('statusBar.autoSelectDisabled') }}
          </span>
        </div>
      </div>
    </template>
  </div>

  <!-- 下拉选项框 - 通过 Teleport 定位到标题栏下方，输入框作为下拉框的一部分 -->
  <Teleport to="body">
    <div v-if="showDropdown" class="status-dropdown-overlay" @click="closeDropdown">
      <div class="status-dropdown" :style="dropdownStyle" @click.stop>
        <!-- 输入框作为下拉框的顶部 -->
        <input
          ref="dropdownInputRef"
          v-model="dropdownStore.filterText"
          class="dropdown-input"
          type="text"
          :placeholder="getDropdownPlaceholder()"
          @keydown.escape="closeDropdown"
        />
        <div class="dropdown-options">
          <!-- 模型选择下拉 -->
          <template v-if="dropdownType === 'model'">
            <div
              v-for="profile in filteredProfiles"
              :key="profile.id"
              class="dropdown-option"
              :class="{ selected: activeProfileId === profile.id }"
              @click="selectModel(profile.id)"
            >
              <span class="option-check" v-if="activeProfileId === profile.id">✓</span>
              <span class="option-label">{{ profile.name || t('statusBar.defaultModel') }}</span>
            </div>
            <div v-if="filteredProfiles.length === 0" class="dropdown-option disabled">
              <span class="option-label">{{ t('statusBar.noModelConfig') }}</span>
            </div>
          </template>
          <!-- AI 回答/自动勾选下拉 -->
          <template v-else>
            <div
              class="dropdown-option"
              :class="{ selected: dropdownValue === true }"
              @click="selectOption(true)"
            >
              <span class="option-check" v-if="dropdownValue === true">✓</span>
              <span class="option-label">{{ t('statusBar.aiAnswerEnabled') }}</span>
            </div>
            <div
              class="dropdown-option"
              :class="{ selected: dropdownValue === false }"
              @click="selectOption(false)"
            >
              <span class="option-check" v-if="dropdownValue === false">✓</span>
              <span class="option-label">{{ t('statusBar.aiAnswerDisabled') }}</span>
            </div>
          </template>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, nextTick, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useNotebookStore } from '@/stores/notebookStore'
import { useDropdownStore } from '@/stores/dropdownStore'
import type { LLMProfile } from '@/types/settings'

const props = defineProps<{
  activeTab: string
  viewMode: 'chat' | 'canvas' | 'particle'
  activeNotebookId: string | null
  selectedTagName?: string | null
  settingsTab?: 'general' | 'model'
  showContextEditDialog?: boolean
  editingContextName?: string
  quickCommandEditingStatus?: { isCreating: boolean; name?: string } | null
  aiAnswerEnabled?: boolean
  autoSelectNewNote?: boolean
  allProfiles?: LLMProfile[]
  activeProfileId?: string
}>()

const emit = defineEmits<{
  'update:aiAnswerEnabled': [value: boolean]
  'update:autoSelectNewNote': [value: boolean]
  'select-model': [modelId: string]
}>()

const { t } = useI18n()
const notebookStore = useNotebookStore()
const dropdownStore = useDropdownStore()

const activeNode = computed(() => notebookStore.globalActiveNode)

// 使用 dropdownStore 的状态（排除 search 类型，search 由 TitleBar 处理）
const showDropdown = computed(() => dropdownStore.showDropdown && dropdownStore.dropdownType && dropdownStore.dropdownType !== 'search')
const dropdownType = computed(() => dropdownStore.dropdownType)

// 下拉输入框引用
const dropdownInputRef = ref<HTMLInputElement | null>(null)

// 下拉框样式 - 紧贴标题栏底部
const dropdownStyle = ref<{ top: string; left: string }>({ top: '0px', left: '0px' })

const allProfiles = computed(() => props.allProfiles || [])

const filteredProfiles = computed(() => {
  const profiles = allProfiles.value
  const filter = dropdownStore.filterText.toLowerCase().trim()
  if (!filter) return profiles
  return profiles.filter(p => (p.name || '').toLowerCase().includes(filter))
})

const currentModelName = computed(() => {
  const profile = allProfiles.value.find(p => p.id === props.activeProfileId)
  return profile?.name || t('statusBar.defaultModel')
})

const dropdownValue = computed(() => {
  if (dropdownType.value === 'ai') {
    return props.aiAnswerEnabled ?? false
  }
  return props.autoSelectNewNote ?? false
})

// 是否是笔记本面板
const isNotebookPanel = computed(() => {
  return ['notebooks', 'all-notebooks', 'pdf-notebook'].includes(props.activeTab)
})

// 笔记本视图标签
const notebookViewLabel = computed(() => {
  if (props.activeTab === 'all-notebooks') {
    return t('statusBar.allNotebooks')
  }
  if (props.activeNotebookId) {
    const notebook = notebookStore.notebooks.find(nb => nb.id === props.activeNotebookId)
    return notebook?.name || t('statusBar.unknownNotebook')
  }
  return t('statusBar.notebook')
})

// 视图模式标签
const viewModeLabel = computed(() => {
  if (props.activeTab === 'pdf-notebook') {
    return t('statusBar.pdfReading')
  }
  switch (props.viewMode) {
    case 'chat': return t('statusBar.standardView')
    case 'canvas': return t('statusBar.canvasView')
    case 'particle': return t('statusBar.particleView')
    default: return t('statusBar.standardView')
  }
})

// 设置子标签显示名称
const settingsTabLabel = computed(() => {
  if (!props.settingsTab) return null
  const tabNames: Record<string, string> = {
    'general': t('statusBar.general'),
    'model': t('statusBar.model')
  }
  return tabNames[props.settingsTab] || props.settingsTab
})

// 其他面板标签
const panelLabel = computed(() => {
  switch (props.activeTab) {
    case 'contexts': return t('statusBar.context')
    case 'favorites': return t('statusBar.favorites')
    case 'trash': return t('statusBar.trash')
    default: return props.activeTab
  }
})

const displayTitle = computed(() => {
  if (!activeNode.value) return ''
  return activeNode.value.title || t('statusBar.noTitle')
})

const wordCount = computed(() => {
  if (!activeNode.value) return 0
  const transcript = activeNode.value.transcript || ''
  const agentResult = activeNode.value.agentResult || ''
  const combined = `${transcript} ${agentResult}`
  // 中文按字符计数，英文按单词计数
  const chineseChars = combined.match(/[一-龥]/g) || []
  const englishWords = combined.match(/[a-zA-Z]+/g) || []
  return chineseChars.length + englishWords.length
})

function formatDate(timestamp: number): string {
  const date = new Date(timestamp)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}`
}

// 获取下拉框输入框的 placeholder
function getDropdownPlaceholder(): string {
  switch (dropdownType.value) {
    case 'model':
      return t('statusBar.currentModel')
    case 'ai':
      return t('statusBar.aiAnswer')
    case 'autoSelect':
      return t('statusBar.autoSelect')
    default:
      return t('common.search')
  }
}

// 监听下拉框打开，自动聚焦输入框
watch(showDropdown, (show) => {
  if (show) {
    nextTick(() => {
      dropdownInputRef.value?.focus()
    })
  }
})

function toggleModelDropdown() {
  dropdownStore.openDropdown('model')
  calculateDropdownPosition()
}

function toggleAiDropdown() {
  dropdownStore.openDropdown('ai')
  calculateDropdownPosition()
}

function toggleAutoSelectDropdown() {
  dropdownStore.openDropdown('autoSelect')
  calculateDropdownPosition()
}

function calculateDropdownPosition() {
  // 定位在标题栏下方（下拉框紧贴标题栏）
  const windowWidth = window.innerWidth
  const dropdownWidth = 600
  const left = windowWidth / 2 - dropdownWidth / 2
  dropdownStyle.value = {
    top: '0px', // 标题栏底部
    left: `${left}px`
  }
}

function selectModel(modelId: string) {
  emit('select-model', modelId)
  closeDropdown()
}

function selectOption(value: boolean) {
  if (dropdownType.value === 'ai') {
    emit('update:aiAnswerEnabled', value)
  } else {
    emit('update:autoSelectNewNote', value)
  }
  closeDropdown()
}

function closeDropdown() {
  dropdownStore.closeDropdown()
}
</script>

<style scoped>
.status-bar {
  height: 24px;
  background: var(--bg-secondary);
  border-top: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  padding: 0 12px;
  font-size: var(--font-size-small);
  color: var(--text-secondary);
  flex-shrink: 0;
  gap: 0;
}

.status-right {
  display: flex;
  align-items: center;
  margin-left: auto;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}

.status-item.clickable {
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 4px;
  transition: background 0.2s;
}

.status-item.clickable:hover {
  background: var(--bg-hover);
}

.status-label {
  color: var(--text-tertiary);
  font-size: var(--font-size-mini);
}

.status-value {
  color: var(--text-secondary);
  font-size: var(--font-size-small);
}

.toggle-value {
  font-weight: 500;
}

.toggle-value.enabled {
  color: var(--color-primary);
}

.model-value {
  font-weight: 500;
  color: var(--text-primary);
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.path-value {
  color: var(--color-primary);
  font-weight: 500;
}

.title-value {
  color: var(--text-primary);
  font-weight: 500;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tags-value {
  display: flex;
  gap: 4px;
  overflow: hidden;
}

.tag-badge {
  background: var(--color-primary-light);
  color: var(--color-primary);
  padding: 1px 6px;
  border-radius: 4px;
  font-size: var(--font-size-mini);
  white-space: nowrap;
}

.favorite-item {
  color: var(--color-favorite);
}

.favorite-icon {
  flex-shrink: 0;
}

.status-separator {
  width: 1px;
  height: 14px;
  background: var(--border-color);
  margin: 0 8px;
  flex-shrink: 0;
}

/* 下拉选项框 - 紧贴标题栏底部，输入框作为顶部 */
.status-dropdown-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 10000;
  background: transparent;
}

.status-dropdown {
  position: absolute;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 8px;
  min-width: 600px;
  box-shadow: 0 4px 16px var(--shadow-color);
}

/* 下拉框中的输入框 - 与标题栏输入框样式一致 */
.dropdown-input {
  width: 100%;
  height: 24px;
  padding: 0 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: var(--font-size-body);
  outline: none;
  transition: border-color 0.2s, background 0.2s;
  box-sizing: border-box;
  margin-bottom: 8px;
}

.dropdown-input:focus {
  border-color: var(--color-primary);
  background: var(--bg-secondary);
}

.dropdown-input::placeholder {
  color: var(--text-tertiary);
}

.dropdown-options {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.dropdown-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;
}

.dropdown-option:hover:not(.disabled) {
  background: var(--bg-secondary);
}

.dropdown-option.selected {
  background: var(--color-primary-light);
}

.dropdown-option.disabled {
  cursor: default;
  opacity: 0.6;
}

.option-check {
  width: 16px;
  font-size: var(--font-size-small);
  color: var(--color-primary);
  font-weight: bold;
}

.option-label {
  font-size: var(--font-size-body);
  color: var(--text-primary);
}

/* 深色模式 */
:root.dark .status-bar {
  background: var(--bg-primary);
  border-top-color: var(--border-color);
}

:root.dark .tag-badge {
  background: rgba(66, 153, 225, 0.15);
  color: var(--color-primary);
}
</style>