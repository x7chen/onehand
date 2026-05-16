<template>
  <div class="status-bar" v-if="activeNode">
    <div class="status-item title-item">
      <span class="status-label">标题:</span>
      <span class="status-value title-value">{{ displayTitle }}</span>
    </div>
    <div class="status-separator"></div>
    <div class="status-item">
      <span class="status-label">笔记本:</span>
      <span class="status-value">{{ notebookName }}</span>
    </div>
    <div class="status-separator"></div>
    <div class="status-item">
      <span class="status-label">创建:</span>
      <span class="status-value">{{ formatDate(activeNode.createdAt) }}</span>
    </div>
    <div class="status-separator"></div>
    <div class="status-item">
      <span class="status-label">修改:</span>
      <span class="status-value">{{ formatDate(activeNode.updatedAt || activeNode.createdAt) }}</span>
    </div>
    <div class="status-separator"></div>
    <div class="status-item" v-if="activeNode.tags && activeNode.tags.length > 0">
      <span class="status-label">标签:</span>
      <span class="status-value tags-value">
        <span class="tag-badge" v-for="tag in activeNode.tags" :key="tag">{{ tag }}</span>
      </span>
    </div>
    <div class="status-separator" v-if="activeNode.tags && activeNode.tags.length > 0"></div>
    <div class="status-item">
      <span class="status-label">字数:</span>
      <span class="status-value">{{ wordCount }}</span>
    </div>
    <div class="status-separator"></div>
    <div class="status-item favorite-item" v-if="activeNode.isFavorite">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" class="favorite-icon">
        <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
      </svg>
    </div>
  </div>
  <div class="status-bar empty" v-else>
    <span class="empty-text">无激活笔记</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useNotebookStore } from '@/stores/notebookStore'
import { useTagStore } from '@/stores/tagStore'

const notebookStore = useNotebookStore()
const tagStore = useTagStore()

const activeNode = computed(() => notebookStore.globalActiveNode)
const activeNodeNotebook = computed(() => notebookStore.globalActiveNodeNotebook)

const displayTitle = computed(() => {
  if (!activeNode.value) return ''
  return activeNode.value.title || '无标题'
})

const notebookName = computed(() => {
  if (!activeNodeNotebook.value) return '未知笔记本'
  return activeNodeNotebook.value.name
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

.status-bar.empty {
  justify-content: center;
}

.empty-text {
  color: var(--text-tertiary);
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