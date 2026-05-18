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

  <!-- 下拉选项框 - 通过 Teleport 定位到标题栏中心 -->
  <Teleport to="body">
    <div v-if="showDropdown" class="status-dropdown-overlay" @click="closeDropdown">
      <div class="status-dropdown" :style="dropdownStyle" @click.stop>
        <div class="dropdown-title">{{ dropdownTitle }}</div>
        <div class="dropdown-options">
          <!-- 模型选择下拉 -->
          <template v-if="dropdownType === 'model'">
            <div
              v-for="profile in allProfiles"
              :key="profile.id"
              class="dropdown-option"
              :class="{ selected: activeProfileId === profile.id }"
              @click="selectModel(profile.id)"
            >
              <span class="option-check" v-if="activeProfileId === profile.id">✓</span>
              <span class="option-label">{{ profile.name || t('statusBar.defaultModel') }}</span>
            </div>
            <div v-if="allProfiles.length === 0" class="dropdown-option disabled">
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
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useNotebookStore } from '@/stores/notebookStore'
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

const activeNode = computed(() => notebookStore.globalActiveNode)

// 下拉选项状态
const showDropdown = ref(false)
const dropdownType = ref<'ai' | 'autoSelect' | 'model'>('ai')
const dropdownStyle = ref<{ top: string; left: string }>({ top: '0px', left: '0px' })

const allProfiles = computed(() => props.allProfiles || [])

const currentModelName = computed(() => {
  const profile = allProfiles.value.find(p => p.id === props.activeProfileId)
  return profile?.name || t('statusBar.defaultModel')
})

const dropdownTitle = computed(() => {
  if (dropdownType.value === 'ai') {
    return t('statusBar.aiAnswer')
  }
  if (dropdownType.value === 'model') {
    return t('statusBar.currentModel')
  }
  return t('statusBar.autoSelect')
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

function toggleModelDropdown() {
  dropdownType.value = 'model'
  showDropdown.value = true
  calculateDropdownPosition()
}

function toggleAiDropdown() {
  dropdownType.value = 'ai'
  showDropdown.value = true
  calculateDropdownPosition()
}

function toggleAutoSelectDropdown() {
  dropdownType.value = 'autoSelect'
  showDropdown.value = true
  calculateDropdownPosition()
}

function calculateDropdownPosition() {
  // 定位在标题栏中心位置（标题栏高度 32px）
  const windowWidth = window.innerWidth
  const dropdownWidth = 600
  const left = windowWidth / 2 - dropdownWidth / 2
  dropdownStyle.value = {
    top: '32px',
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
  showDropdown.value = false
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
  font-size: 12px;
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
  font-size: 11px;
}

.status-value {
  color: var(--text-secondary);
  font-size: 12px;
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
  font-size: 11px;
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

/* 下拉选项框 */
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

.dropdown-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  padding: 4px 8px;
  margin-bottom: 4px;
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
  font-size: 12px;
  color: var(--color-primary);
  font-weight: bold;
}

.option-label {
  font-size: 13px;
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