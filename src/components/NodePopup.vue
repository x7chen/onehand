<template>
  <div v-if="visible" class="dialog-overlay" @click="handleOverlayClick">
    <div class="dialog node-popup-dialog" @click.stop>
      <div class="popup-header">
        <h3 v-if="nodeData">{{ nodeData.notebook.name }}</h3>
        <h3 v-else>{{ t('common.noteDetails') }}</h3>
        <div class="header-actions">
          <button
            v-if="nodeData"
            class="navigate-btn"
            @click="handleNavigate"
            :title="t('voiceNote.jumpToNote')"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
              <polyline points="15 3 21 3 21 9"/>
              <line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
            <span>{{ t('common.jump') }}</span>
          </button>
          <button class="close-btn" @click="close" :title="t('common.close')">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- Error state -->
      <div v-if="error" class="error-state">
        <svg viewBox="0 0 24 24" width="48" height="48" fill="currentColor" class="error-icon">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
        </svg>
        <p>{{ error }}</p>
        <button class="close-error-btn" @click="close">{{ t('common.close') }}</button>
      </div>

      <!-- Loading state -->
      <div v-else-if="loading" class="loading-state">
        <div class="loading-spinner"></div>
        <p>{{ t('common.loading') }}</p>
      </div>

      <!-- Node content -->
      <div v-else-if="nodeData" class="popup-content">
        <VoiceNote
          :node="nodeData.node"
          :notebook-id="nodeData.notebook.id"
          :show-header="true"
          :is-active="false"
          :popup-mode="true"
          @toggle-context="handleToggleContext"
          @toggle-favorite="handleToggleFavorite"
          @play="handlePlay"
          @delete="handleDelete"
          @update-node="handleUpdateNode"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import VoiceNote from '@/components/VoiceNote.vue'
import { parseDeepLinkUrl, findNodeByNodeId, type NodePopupData } from '@/composables/useDeepLink'
import { useNotebookStore } from '@/stores/notebookStore'
import { getNotebookDataDir } from '@/utils/userFilesPath'
import type { CanvasNode } from '@/types/notebook'

const props = defineProps<{
  visible: boolean
  url?: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'navigate', data: { notebookId: string; nodeId: string }): void
}>()

const notebookStore = useNotebookStore()
const { t } = useI18n()

const loading = ref(false)
const error = ref<string | null>(null)
const nodeData = ref<NodePopupData | null>(null)
const currentAudio = ref<HTMLAudioElement | null>(null)

// Watch for URL changes and load node data
watch(() => props.url, async (newUrl) => {
  if (newUrl && props.visible) {
    await loadNodeData(newUrl)
  }
}, { immediate: true })

// Reset when visibility changes
watch(() => props.visible, (isVisible) => {
  if (isVisible && props.url) {
    loadNodeData(props.url)
  } else if (!isVisible) {
    // Cleanup
    nodeData.value = null
    error.value = null
    if (currentAudio.value) {
      currentAudio.value.pause()
      currentAudio.value = null
    }
  }
})

async function loadNodeData(url: string) {
  loading.value = true
  error.value = null
  nodeData.value = null

  try {
    const linkData = parseDeepLinkUrl(url)
    if (!linkData) {
      error.value = '无效的链接格式'
      loading.value = false
      return
    }

    const result = await findNodeByNodeId(linkData)
    if (!result) {
      error.value = '找不到链接指向的笔记，可能已被删除'
      loading.value = false
      return
    }

    nodeData.value = result
    loading.value = false
  } catch (err) {
    console.error('Error loading node data:', err)
    error.value = '加载笔记失败'
    loading.value = false
  }
}

function close() {
  if (currentAudio.value) {
    currentAudio.value.pause()
    currentAudio.value = null
  }
  emit('close')
}

function handleNavigate() {
  if (!nodeData.value) return

  if (currentAudio.value) {
    currentAudio.value.pause()
    currentAudio.value = null
  }

  emit('navigate', {
    notebookId: nodeData.value.notebook.id,
    nodeId: nodeData.value.node.id
  })
}

function handleOverlayClick(e: MouseEvent) {
  // Only close if clicking on the overlay itself
  if (e.target === e.currentTarget) {
    close()
  }
}

function handleToggleContext(nodeId: string) {
  // Toggle context in the popup (read-only for now)
  console.log('Toggle context:', nodeId)
}

function handleToggleFavorite(nodeId: string) {
  if (!nodeData.value) return

  const node = nodeData.value.node
  if (node) {
    node.isFavorite = !node.isFavorite

    const notebook = nodeData.value.notebook

    // Ensure the notebook is set as current in store
    notebookStore.setCurrentNotebook(notebook)

    // Update in store to persist
    notebookStore.updateNode(nodeId, { isFavorite: node.isFavorite })
  }
}

async function handlePlay(nodeId: string) {
  if (!nodeData.value) return

  const node = nodeData.value.node
  if (!node?.audioPath) return

  if (currentAudio.value) {
    currentAudio.value.pause()
    currentAudio.value = null
  }

  try {
    const notebook = notebookStore.currentNotebook
    if (!notebook || !node.audioPath) return

    const notebookDir = await getNotebookDataDir(notebook.id)
    const audioPath = `${notebookDir}/${node.audioPath}`

    currentAudio.value = new Audio(`file://${audioPath}`)
    await currentAudio.value.play()

    currentAudio.value.onended = () => {
      currentAudio.value = null
    }
  } catch (error) {
    console.error('Failed to play audio:', error)
  }
}

function handleDelete(nodeId: string) {
  // Don't allow delete from popup
  console.log('Delete not allowed from popup:', nodeId)
}

function handleUpdateNode(nodeId: string, updates: Partial<CanvasNode>) {
  if (!nodeData.value) return

  const notebook = nodeData.value.notebook

  // Update local nodeData
  const node = nodeData.value.node
  if (node) {
    Object.assign(node, updates)
  }

  // Ensure the notebook is set as current in store
  notebookStore.setCurrentNotebook(notebook)

  // Update in store to persist
  notebookStore.updateNode(nodeId, updates)
}
</script>

<style scoped>
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3000;
}

.node-popup-dialog {
  background: var(--bg-primary);
  border: none;
  border-radius: 12px;
  min-width: 400px;
  max-width: 650px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.popup-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  border-bottom: 1px solid var(--border-color);
}

.popup-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 500;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.navigate-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.navigate-btn:hover {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: white;
}

.navigate-btn svg {
  flex-shrink: 0;
}

.close-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  color: var(--text-secondary);
  transition: all 0.2s;
  flex-shrink: 0;
}

.close-btn:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.popup-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  position: relative;
}

/* Override VoiceNote positioning for popup context */
.popup-content :deep(.voice-note) {
  position: relative !important;
  left: auto !important;
  top: auto !important;
  width: 100% !important;
  max-width: 100%;
}

.popup-content :deep(.node-header) {
  opacity: 1;
  height: 32px;
  margin-bottom: 8px;
}

.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
}

.error-icon {
  color: var(--color-error);
  margin-bottom: 16px;
}

.error-state p {
  color: var(--text-secondary);
  margin-bottom: 20px;
}

.close-error-btn {
  padding: 8px 24px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.2s;
}

.close-error-btn:hover {
  background: var(--border-color);
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--border-color);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.loading-state p {
  color: var(--text-secondary);
}
</style>