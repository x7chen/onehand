<template>
  <div v-if="visible" class="dialog-overlay" @click="handleOverlayClick">
    <div class="skipped-dialog" @click.stop>
      <div class="dialog-header">
        <h3>{{ t('common.skippedNodesTitle') }}</h3>
        <button class="close-btn" @click="close" :title="t('common.close')">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
      </div>
      <div class="dialog-body">
        <p class="hint-text">{{ t('common.skippedNodesHint') }}</p>
        <div class="skipped-list">
          <div
            v-for="node in skippedNodes"
            :key="`${node.nodeId}-${node.fieldType}`"
            class="skipped-item"
            @click="openNode(node)"
          >
            <div class="item-meta">
              <span class="notebook-name">{{ node.notebookName }}</span>
              <template v-if="node.pdfPage">
                <span class="separator">·</span>
                <span class="canvas-name">{{ t('common.pageN', { n: node.pdfPage }) }}</span>
              </template>
              <template v-if="node.nodeTitle">
                <span class="separator">·</span>
                <span class="node-title">{{ node.nodeTitle }}</span>
              </template>
              <span class="separator">·</span>
              <span class="field-type">{{ node.fieldType === 'transcript' ? t('common.transcript') : t('common.agentResult') }}</span>
            </div>
            <div class="item-reason">{{ node.reason }}</div>
          </div>
        </div>
        <div v-if="skippedNodes.length === 0" class="empty-state">
          <p>{{ t('common.noSkippedNodes') }}</p>
        </div>
      </div>
    </div>

    <!-- Node Popup -->
    <NodePopup
      :visible="showNodePopup"
      :url="selectedNodeUrl"
      @close="closeNodePopup"
      @navigate="handleNavigate"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import NodePopup from '@/components/NodePopup.vue'
import { useNotebookStore } from '@/stores/notebookStore'
import { generateDeepLinkUrl } from '@/composables/useDeepLink'
import type { SkippedIndexNode } from '@/types/embedding'

const props = defineProps<{
  visible: boolean
  skippedNodes: SkippedIndexNode[]
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const { t } = useI18n()
const router = useRouter()
const notebookStore = useNotebookStore()

const showNodePopup = ref(false)
const selectedNodeUrl = ref('')

function handleOverlayClick(e: MouseEvent) {
  if (e.target === e.currentTarget) {
    close()
  }
}

function close() {
  emit('close')
}

function openNode(node: SkippedIndexNode) {
  selectedNodeUrl.value = generateDeepLinkUrl(node.nodeId)
  showNodePopup.value = true
}

function closeNodePopup() {
  showNodePopup.value = false
  selectedNodeUrl.value = ''
}

function handleNavigate(data: { notebookId: string; nodeId: string }) {
  const notebook = notebookStore.notebooks.find(p => p.id === data.notebookId)
  if (notebook) {
    notebookStore.setCurrentNotebook(notebook)

    if (notebook.pdfPath) {
      router.push(`/pdf/${data.notebookId}?nodeId=${data.nodeId}`)
    } else {
      router.push(`/multi-chat/${data.notebookId}?nodeId=${data.nodeId}`)
    }
  }

  closeNodePopup()
  close()
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
  z-index: 2600;
}

.skipped-dialog {
  background: var(--bg-primary);
  border-radius: 12px;
  width: 90%;
  max-width: 800px;
  max-height: 70vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
}

.dialog-header h3 {
  margin: 0;
  font-size: var(--font-size-title);
  font-weight: 500;
  color: var(--text-primary);
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
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.close-btn:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.dialog-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.hint-text {
  color: var(--text-secondary);
  font-size: var(--font-size-body);
  margin-bottom: 12px;
}

.skipped-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.skipped-item {
  padding: 12px;
  background: var(--bg-secondary);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.skipped-item:hover {
  background: var(--border-color);
}

.item-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  font-size: var(--font-size-small);
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.item-meta .separator {
  opacity: 0.5;
}

.item-meta .notebook-name {
  color: var(--color-primary);
  font-weight: 500;
}

.item-meta .node-title {
  font-weight: 500;
}

.item-meta .field-type {
  color: rgba(255, 152, 0, 0.8);
}

.item-reason {
  font-size: var(--font-size-body);
  color: var(--text-secondary);
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
}

.empty-state p {
  color: var(--text-secondary);
}
</style>