<template>
  <div v-if="visible" class="dialog-overlay" @click="handleOverlayClick">
    <div class="dialog node-popup-dialog" @click.stop>
      <div class="popup-header">
        <h3 v-if="nodeData">{{ nodeData.project.name }}</h3>
        <h3 v-else>节点详情</h3>
        <button class="close-btn" @click="close" title="关闭">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
      </div>

      <!-- Error state -->
      <div v-if="error" class="error-state">
        <svg viewBox="0 0 24 24" width="48" height="48" fill="currentColor" class="error-icon">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
        </svg>
        <p>{{ error }}</p>
        <button class="close-error-btn" @click="close">关闭</button>
      </div>

      <!-- Loading state -->
      <div v-else-if="loading" class="loading-state">
        <div class="loading-spinner"></div>
        <p>加载中...</p>
      </div>

      <!-- Node content -->
      <div v-else-if="nodeData" class="popup-content">
        <VoiceNote
          :node="nodeData.node"
          :project-id="nodeData.project.id"
          :canvas-id="nodeData.canvas.id"
          :show-header="true"
          :is-active="true"
          @toggle-context="handleToggleContext"
          @toggle-favorite="handleToggleFavorite"
          @play="handlePlay"
          @delete="handleDelete"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import VoiceNote from '@/components/VoiceNote.vue'
import { parseDeepLinkUrl, findNodeByDeepLink, type NodePopupData } from '@/composables/useDeepLink'
import { useProjectStore } from '@/stores/projectStore'
import type { DeepLinkData } from '@/composables/useDeepLink'

const props = defineProps<{
  visible: boolean
  url?: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'navigate', data: DeepLinkData): void
}>()

const projectStore = useProjectStore()

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

    const result = await findNodeByDeepLink(linkData)
    if (!result) {
      error.value = '找不到链接指向的节点，可能已被删除'
      loading.value = false
      return
    }

    nodeData.value = result
    loading.value = false
  } catch (err) {
    console.error('Error loading node data:', err)
    error.value = '加载节点失败'
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
  if (nodeData.value) {
    const node = nodeData.value.canvas.nodes.find(n => n.id === nodeId)
    if (node) {
      node.isFavorite = !node.isFavorite
    }
  }
}

async function handlePlay(nodeId: string) {
  if (!nodeData.value) return

  const node = nodeData.value.canvas.nodes.find(n => n.id === nodeId)
  if (!node?.audioPath) return

  if (currentAudio.value) {
    currentAudio.value.pause()
    currentAudio.value = null
  }

  try {
    const appDataPath = await window.electronAPI.getAppPath('userData')
    const audioPath = `${appDataPath}/${node.audioPath}`

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
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
}

.popup-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 500;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
  color: #f44;
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
  border-top-color: #4299e1;
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