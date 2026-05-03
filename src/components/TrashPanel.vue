<template>
  <div class="trash-panel">
    <div class="panel-header">
      <div class="header-title">
        <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" class="trash-icon">
          <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
        </svg>
        <h2>{{ t('nav.trash') }}</h2>
      </div>
    </div>

    <div class="trash-content">
      <!-- Left sidebar tabs -->
      <div class="trash-sidebar">
        <button :class="{ active: activeTab === 'notes' }" @click="activeTab = 'notes'">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
          </svg>
          <span>{{ t('trash.notes') }}</span>
        </button>
        <button :class="{ active: activeTab === 'notebooks' }" @click="activeTab = 'notebooks'">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z"/>
          </svg>
          <span>{{ t('trash.notebooks') }}</span>
        </button>
        <button :class="{ active: activeTab === 'contexts' }" @click="activeTab = 'contexts'">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M17.63 5.84C17.27 5.33 16.67 5 16 5L5 5.01C3.9 5.01 3 5.9 3 7v10c0 1.1.9 1.99 2 1.99L16 19c.67 0 1.27-.33 1.63-.84L22 12l-4.37-6.16z"/>
          </svg>
          <span>{{ t('trash.contexts') }}</span>
        </button>
        <button :class="{ active: activeTab === 'quickCommands' }" @click="activeTab = 'quickCommands'">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.9959.9959 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
          </svg>
          <span>{{ t('trash.quickCommands') }}</span>
        </button>
      </div>

      <!-- Content area -->
      <div class="trash-items">
        <!-- Notes -->
        <div v-show="activeTab === 'notes'" class="items-section">
          <div class="section-header">
            <span class="section-title">{{ t('trash.notes') }}</span>
            <button v-if="trashNodes.length > 0" class="empty-btn" @click="handleEmptyNotes">
              {{ t('trash.emptyAll') }}
            </button>
          </div>
          <div v-if="trashNodes.length === 0" class="no-items">
            <p>{{ t('trash.noTrashItems') }}</p>
          </div>
          <div v-else class="items-list">
            <div v-for="item in trashNodes" :key="item.nodeId" class="trash-item">
              <div class="item-content">
                <div class="item-name">
                  <span class="source-name">{{ item.sourceNotebookName }}</span>
                  <template v-if="item.pdfPage">
                    <span class="separator">·</span>
                    <span>{{ t('common.pageN', { n: item.pdfPage }) }}</span>
                  </template>
                </div>
                <div class="item-meta">
                  <span class="item-preview">{{ item.preview }}</span>
                  <span class="separator">·</span>
                  <span>{{ formatTime(item.deletedAt) }}</span>
                </div>
              </div>
              <div class="action-buttons">
                <button class="restore-btn" @click.stop="handleRestoreNote(item.nodeId)" :title="t('trash.restore')">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                    <path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/>
                  </svg>
                </button>
                <button class="delete-btn" @click.stop="handleDeleteNotePermanently(item.nodeId)" :title="t('trash.deletePermanently')">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Notebooks -->
        <div v-show="activeTab === 'notebooks'" class="items-section">
          <div class="section-header">
            <span class="section-title">{{ t('trash.notebooks') }}</span>
            <button v-if="notebookStore.trashNotebooks.length > 0" class="empty-btn" @click="handleEmptyNotebooks">
              {{ t('trash.emptyAll') }}
            </button>
          </div>
          <div v-if="notebookStore.trashNotebooks.length === 0" class="no-items">
            <p>{{ t('trash.noTrashItems') }}</p>
          </div>
          <div v-else class="items-list">
            <div v-for="nb in notebookStore.trashNotebooks" :key="nb.originalId" class="trash-item">
              <div class="item-content">
                <div class="item-name">
                  <svg v-if="nb.pdfPath" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                    <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
                  </svg>
                  <svg v-else viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                    <path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z"/>
                  </svg>
                  <span>{{ nb.name }}</span>
                </div>
                <div class="item-meta">
                  <span>{{ nb.nodeCount }} {{ t('notebook.notes') }}</span>
                  <span class="separator">·</span>
                  <span>{{ formatTime(nb.deletedAt) }}</span>
                </div>
              </div>
              <div class="action-buttons">
                <button class="restore-btn" @click.stop="handleRestoreNotebook(nb.originalId)" :title="t('trash.restore')">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                    <path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/>
                  </svg>
                </button>
                <button class="delete-btn" @click.stop="handleDeleteNotebookPermanently(nb.originalId)" :title="t('trash.deletePermanently')">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Contexts -->
        <div v-show="activeTab === 'contexts'" class="items-section">
          <div class="section-header">
            <span class="section-title">{{ t('trash.contexts') }}</span>
            <button v-if="contextStore.trashContextFiles.length > 0" class="empty-btn" @click="handleEmptyContexts">
              {{ t('trash.emptyAll') }}
            </button>
          </div>
          <div v-if="contextStore.trashContextFiles.length === 0" class="no-items">
            <p>{{ t('trash.noTrashItems') }}</p>
          </div>
          <div v-else class="items-list">
            <div v-for="ctx in contextStore.trashContextFiles" :key="ctx.id" class="trash-item">
              <div class="item-content">
                <div class="item-name">
                  <span class="color-dot" :style="{ backgroundColor: ctx.color }"></span>
                  <span>{{ ctx.name }}</span>
                  <span class="type-tag">{{ ctx.type === 'static' ? t('context.static') : t('context.dynamic') }}</span>
                </div>
                <div class="item-meta">
                  <span>{{ t('context.wordCount', { count: ctx.content.length }) }}</span>
                  <span class="separator">·</span>
                  <span>{{ formatTime(ctx.deletedAt) }}</span>
                </div>
              </div>
              <div class="action-buttons">
                <button class="restore-btn" @click.stop="handleRestoreContext(ctx.id)" :title="t('trash.restore')">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                    <path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/>
                  </svg>
                </button>
                <button class="delete-btn" @click.stop="handleDeleteContextPermanently(ctx.id)" :title="t('trash.deletePermanently')">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Quick Commands -->
        <div v-show="activeTab === 'quickCommands'" class="items-section">
          <div class="section-header">
            <span class="section-title">{{ t('trash.quickCommands') }}</span>
            <button v-if="quickCommandStore.trashQuickCommands.length > 0" class="empty-btn" @click="handleEmptyQuickCommands">
              {{ t('trash.emptyAll') }}
            </button>
          </div>
          <div v-if="quickCommandStore.trashQuickCommands.length === 0" class="no-items">
            <p>{{ t('trash.noTrashItems') }}</p>
          </div>
          <div v-else class="items-list">
            <div v-for="cmd in quickCommandStore.trashQuickCommands" :key="cmd.id" class="trash-item">
              <div class="item-content">
                <div class="item-name">
                  <span class="color-dot" :style="{ backgroundColor: cmd.color }"></span>
                  <span>{{ cmd.name }}</span>
                </div>
                <div class="item-meta">
                  <span>{{ t('context.wordCount', { count: cmd.content.length }) }}</span>
                  <span class="separator">·</span>
                  <span>{{ formatTime(cmd.deletedAt) }}</span>
                </div>
              </div>
              <div class="action-buttons">
                <button class="restore-btn" @click.stop="handleRestoreQuickCommand(cmd.id)" :title="t('trash.restore')">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                    <path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/>
                  </svg>
                </button>
                <button class="delete-btn" @click.stop="handleDeleteQuickCommandPermanently(cmd.id)" :title="t('trash.deletePermanently')">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 清空确认对话框 -->
    <div v-if="showConfirmDialog" class="dialog-overlay" @click="showConfirmDialog = false">
      <div class="confirm-dialog" @click.stop>
        <p>{{ confirmMessage }}</p>
        <div class="dialog-actions">
          <button class="cancel-btn" @click="showConfirmDialog = false">{{ t('common.cancel') }}</button>
          <button class="confirm-btn" @click="executeEmpty">{{ t('common.confirm') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useNotebookStore } from '@/stores/notebookStore'
import { useContextStore } from '@/stores/contextStore'
import { useQuickCommandStore } from '@/stores/quickCommandStore'

const notebookStore = useNotebookStore()
const contextStore = useContextStore()
const quickCommandStore = useQuickCommandStore()
const { t } = useI18n()

const activeTab = ref<'notes' | 'notebooks' | 'contexts' | 'quickCommands'>('notes')
const trashNodes = ref<TrashNodeItem[]>([])

// 确认对话框状态
const showConfirmDialog = ref(false)
const confirmMessage = ref('')
let pendingEmptyAction: (() => Promise<void>) | null = null

interface TrashNodeItem {
  nodeId: string
  nodeTitle: string
  pdfPage?: number
  preview: string
  sourceNotebookId: string
  sourceNotebookName: string
  deletedAt: number
}

onMounted(() => {
  loadTrashNodes()
})

watch(() => notebookStore.trashNodes, () => {
  loadTrashNodes()
}, { deep: true })

function loadTrashNodes() {
  const results: TrashNodeItem[] = []

  for (const trashNodeMeta of notebookStore.trashNodes) {
    const node = trashNodeMeta.node
    const fullText = node.transcript || node.agentResult || ''
    const sourceNotebookId = trashNodeMeta.sourceNotebookId || ''
    const sourceNotebook = notebookStore.notebooks.find(n => n.id === sourceNotebookId)
    const sourceNotebookName = sourceNotebook?.name || t('notebook.myNotebooks')
    // 显示前20个字符
    const preview = fullText.slice(0, 20) || t('nodeList.noTitle')

    results.push({
      nodeId: node.id,
      nodeTitle: node.title || '',
      pdfPage: node.pdfPage,
      preview,
      sourceNotebookId,
      sourceNotebookName,
      deletedAt: trashNodeMeta.deletedAt
    })
  }

  // 按删除时间排序（最近的在前）
  results.sort((a, b) => b.deletedAt - a.deletedAt)

  trashNodes.value = results
}

function formatTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return t('notebook.justNow')
  if (minutes < 60) return t('notebook.minutesAgo', { count: minutes })
  if (hours < 24) return t('notebook.hoursAgo', { count: hours })
  return t('notebook.daysAgo', { count: days })
}

async function handleRestoreNote(nodeId: string) {
  await notebookStore.restoreNodeFromTrash(nodeId)
}

async function handleDeleteNotePermanently(nodeId: string) {
  await notebookStore.deleteNodePermanently(nodeId)
}

async function handleRestoreNotebook(originalId: string) {
  await notebookStore.restoreNotebookFromTrash(originalId)
}

async function handleDeleteNotebookPermanently(originalId: string) {
  await notebookStore.deleteNotebookPermanently(originalId)
}

async function handleRestoreContext(contextId: string) {
  await contextStore.restoreContextFromTrash(contextId)
}

async function handleDeleteContextPermanently(contextId: string) {
  await contextStore.deleteContextPermanently(contextId)
}

async function handleRestoreQuickCommand(commandId: string) {
  await quickCommandStore.restoreQuickCommandFromTrash(commandId)
}

async function handleDeleteQuickCommandPermanently(commandId: string) {
  await quickCommandStore.deleteQuickCommandPermanently(commandId)
}

function handleEmptyNotes() {
  confirmMessage.value = t('trash.confirmEmptyNotes')
  pendingEmptyAction = async () => {
    await notebookStore.emptyTrash()
  }
  showConfirmDialog.value = true
}

function handleEmptyNotebooks() {
  confirmMessage.value = t('trash.confirmEmptyNotebooks')
  pendingEmptyAction = async () => {
    for (const nb of [...notebookStore.trashNotebooks]) {
      await notebookStore.deleteNotebookPermanently(nb.originalId)
    }
  }
  showConfirmDialog.value = true
}

function handleEmptyContexts() {
  confirmMessage.value = t('trash.confirmEmptyContexts')
  pendingEmptyAction = async () => {
    for (const ctx of [...contextStore.trashContextFiles]) {
      await contextStore.deleteContextPermanently(ctx.id)
    }
  }
  showConfirmDialog.value = true
}

function handleEmptyQuickCommands() {
  confirmMessage.value = t('trash.confirmEmptyQuickCommands')
  pendingEmptyAction = async () => {
    for (const cmd of [...quickCommandStore.trashQuickCommands]) {
      await quickCommandStore.deleteQuickCommandPermanently(cmd.id)
    }
  }
  showConfirmDialog.value = true
}

async function executeEmpty() {
  if (pendingEmptyAction) {
    await pendingEmptyAction()
    pendingEmptyAction = null
  }
  showConfirmDialog.value = false
}
</script>

<style scoped>
.trash-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.panel-header {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  border-bottom: 1px solid var(--border-color);
  box-sizing: border-box;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 100%;
}

.header-title h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 500;
  color: var(--text-primary);
  line-height: 1;
}

.trash-icon {
  color: var(--text-secondary);
}

.trash-content {
  flex: 1;
  display: flex;
  overflow: hidden;
}

/* Left sidebar tabs */
.trash-sidebar {
  width: 140px;
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  flex-shrink: 0;
}

.trash-sidebar button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
}

.trash-sidebar button:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.trash-sidebar button.active {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.trash-sidebar svg {
  flex-shrink: 0;
}

.trash-sidebar span:first-of-type {
  flex: 1;
}

/* Content area */
.trash-items {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.items-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.section-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.empty-btn {
  padding: 6px 12px;
  background: rgba(255, 68, 68, 0.1);
  border: 1px solid rgba(255, 68, 68, 0.3);
  border-radius: 6px;
  cursor: pointer;
  color: var(--color-error);
  font-size: 13px;
  transition: all 0.2s;
}

.empty-btn:hover {
  background: rgba(255, 68, 68, 0.2);
}

.no-items {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: var(--text-secondary);
}

.items-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.trash-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px;
  background: var(--bg-secondary);
  border-radius: 6px;
  transition: all 0.2s;
}

.trash-item:hover {
  background: var(--border-color);
}

.item-content {
  flex: 1;
  min-width: 0;
}

.item-name {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.item-name svg {
  color: var(--text-secondary);
}

.color-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.type-tag {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--border-color);
  color: var(--text-secondary);
}

.item-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-secondary);
}

.source-name {
  color: var(--color-primary);
  font-weight: 500;
}

.separator {
  opacity: 0.5;
}

.item-preview {
  font-size: 13px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
}

.action-buttons {
  display: flex;
  gap: 8px;
}

.restore-btn,
.delete-btn {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.restore-btn:hover {
  background: var(--color-primary);
  color: white;
}

.delete-btn:hover {
  background: var(--color-error);
  color: white;
}

/* 确认对话框 */
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

.confirm-dialog {
  background: var(--bg-primary);
  padding: 24px;
  border-radius: 12px;
  min-width: 400px;
  max-width: 500px;
}

.confirm-dialog p {
  margin: 0 0 20px 0;
  color: var(--text-primary);
  font-size: 16px;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
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
  background: var(--color-error);
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: white;
}
</style>