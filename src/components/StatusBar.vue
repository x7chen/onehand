<template>
  <div class="status-bar">
    <!-- 上下文编辑状态 -->
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
      <div class="status-separator" v-if="settingsSubTabLabel"></div>
      <div class="status-item" v-if="settingsSubTabLabel">
        <span class="status-value">{{ settingsSubTabLabel }}</span>
      </div>
    </template>

    <!-- 其他面板 -->
    <template v-else>
      <div class="status-item">
        <span class="status-value path-value">{{ panelLabel }}</span>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useNotebookStore } from '@/stores/notebookStore'

const props = defineProps<{
  activeTab: string
  viewMode: 'chat' | 'canvas' | 'particle'
  activeNotebookId: string | null
  selectedTagName?: string | null
  settingsSubTab?: string | null
  showContextEditDialog?: boolean
  editingContextName?: string
  quickCommandEditingStatus?: { isCreating: boolean; name?: string } | null
}>()

const { t } = useI18n()
const notebookStore = useNotebookStore()

const activeNode = computed(() => notebookStore.globalActiveNode)

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
const settingsSubTabLabel = computed(() => {
  if (!props.settingsSubTab) return null
  const subTabNames: Record<string, string> = {
    'general': t('statusBar.general'),
    'model': t('statusBar.model')
  }
  return subTabNames[props.settingsSubTab] || props.settingsSubTab
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

.status-item {
  display: flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}

.status-label {
  color: var(--text-tertiary);
  font-size: 11px;
}

.status-value {
  color: var(--text-secondary);
  font-size: 12px;
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