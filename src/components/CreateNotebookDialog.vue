<template>
  <div v-if="visible" class="dialog-overlay" @click="$emit('close')">
    <div class="dialog" @click.stop>
      <h3>{{ t('notebook.newNotebook') }}</h3>
      <input
        v-model="notebookName"
        type="text"
        :placeholder="t('notebook.notebookNamePlaceholder')"
        @keydown.enter="handleCreate"
        ref="nameInputRef"
      />

      <!-- PDF 文件选择（可选） -->
      <div class="form-group">
        <label>{{ t('notebook.pdfFile') }}：</label>
        <div class="pdf-file-selector">
          <input
            v-model="pdfFileName"
            type="text"
            :placeholder="t('notebook.pdfFilePlaceholder')"
            readonly
            @click="selectPdfFile"
            class="pdf-input"
          />
          <button v-if="pdfFilePath" @click="clearPdfFile" class="clear-pdf-btn" :title="t('common.clear')">
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
        <div v-if="staticContextFiles.length > 0" class="context-tags-selector">
          <span
            v-for="file in staticContextFiles"
            :key="file.id"
            class="context-tag-selectable"
            :class="{ selected: selectedStaticContexts.includes(file.id) }"
            :style="{
              backgroundColor: selectedStaticContexts.includes(file.id) ? file.color + '40' : 'var(--bg-secondary)',
              borderColor: selectedStaticContexts.includes(file.id) ? file.color : 'var(--border-color)',
              color: selectedStaticContexts.includes(file.id) ? file.color : 'var(--text-secondary)'
            }"
            @click="toggleStaticContext(file.id)"
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
        <select v-model="selectedDynamicContext">
          <option value="">{{ t('notebook.noDynamicContext') }}</option>
          <option v-for="file in dynamicContextFiles" :key="file.id" :value="file.id">
            {{ file.name }}
          </option>
        </select>
      </div>

      <div class="dialog-actions">
        <button @click="$emit('close')" class="cancel-btn">{{ t('common.cancel') }}</button>
        <button @click="handleCreate" class="confirm-btn">{{ t('common.create') }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ContextFile } from '@/types/context'

const { t } = useI18n()

const props = defineProps<{
  visible: boolean
  staticContextFiles: ContextFile[]
  dynamicContextFiles: ContextFile[]
}>()

const emit = defineEmits<{
  'close': []
  'create': [data: {
    name: string
    pdfPath?: string
    staticContextIds: string[]
    dynamicContextId?: string
  }]
}>()

// 状态
const notebookName = ref('')
const pdfFilePath = ref('')
const pdfFileName = ref('')
const selectedStaticContexts = ref<string[]>([])
const selectedDynamicContext = ref('')
const nameInputRef = ref<HTMLInputElement | null>(null)

// 监听对话框打开，自动聚焦输入框
watch(() => props.visible, (newValue) => {
  if (newValue) {
    nextTick(() => {
      nameInputRef.value?.focus()
    })
  }
})

// PDF 文件选择
async function selectPdfFile() {
  const result = await window.electronAPI.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
  })

  if (result && !result.canceled && result.filePaths.length > 0) {
    pdfFilePath.value = result.filePaths[0]
    const fileName = result.filePaths[0].split('/').pop() || result.filePaths[0].split('\\').pop() || ''
    pdfFileName.value = fileName
  }
}

function clearPdfFile() {
  pdfFilePath.value = ''
  pdfFileName.value = ''
}

// 静态上下文选择
function toggleStaticContext(contextId: string) {
  const index = selectedStaticContexts.value.indexOf(contextId)
  if (index === -1) {
    selectedStaticContexts.value.push(contextId)
  } else {
    selectedStaticContexts.value.splice(index, 1)
  }
}

// 创建笔记本
function handleCreate() {
  // 如果名称为空且没有PDF文件，不允许创建
  if (!notebookName.value.trim() && !pdfFilePath.value) return

  emit('create', {
    name: notebookName.value.trim(),
    pdfPath: pdfFilePath.value || undefined,
    staticContextIds: selectedStaticContexts.value,
    dynamicContextId: selectedDynamicContext.value || undefined
  })

  // 重置状态
  notebookName.value = ''
  pdfFilePath.value = ''
  pdfFileName.value = ''
  selectedStaticContexts.value = []
  selectedDynamicContext.value = ''
}
</script>

<style scoped>
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
  z-index: 2001;
}

.dialog h3 {
  margin-bottom: 16px;
  font-size: 18px;
  color: var(--text-primary);
}

.dialog input[type="text"],
.dialog select {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 14px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  box-sizing: border-box;
  margin-bottom: 12px;
}

.dialog input[type="text"]:focus,
.dialog select:focus {
  outline: none;
  border-color: var(--color-primary);
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

.pdf-file-selector {
  display: flex;
  gap: 8px;
  align-items: center;
}

.pdf-input {
  flex: 1;
  cursor: pointer;
}

.clear-pdf-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 4px;
  background: var(--bg-secondary);
  cursor: pointer;
  color: var(--text-secondary);
  transition: all 0.2s;
}

.clear-pdf-btn:hover {
  background: var(--color-error-light);
  color: var(--color-error);
}

.browse-btn {
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-secondary);
  cursor: pointer;
  color: var(--text-primary);
  font-size: 13px;
  transition: all 0.2s;
}

.browse-btn:hover {
  background: var(--border-color);
}

.context-tags-selector {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.context-tag-selectable {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 12px;
  border: 1px solid;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.context-tag-selectable:hover {
  transform: scale(1.05);
}

.context-tag-selectable.selected {
  font-weight: 600;
}

.no-context-hint {
  font-size: 13px;
  color: var(--text-secondary);
  font-style: italic;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 20px;
}

.cancel-btn {
  padding: 8px 16px;
  background: var(--bg-secondary);
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: var(--text-secondary);
  transition: all 0.2s;
}

.cancel-btn:hover {
  background: var(--border-color);
}

.confirm-btn {
  padding: 8px 16px;
  background: var(--color-primary);
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: white;
  transition: all 0.2s;
}

.confirm-btn:hover {
  background: var(--color-primary-hover);
}
</style>