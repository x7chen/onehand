<template>
  <div class="context-edit-panel">
    <div class="panel-header">
      <h2>{{ editingItem?.name || t('context.contextTags') }}</h2>
      <div class="header-actions">
        <button class="save-btn" @click="handleSave" :disabled="!hasChanges">
          {{ t('common.save') }}
        </button>
        <button class="delete-btn" @click="handleDelete">
          {{ t('common.delete') }}
        </button>
      </div>
    </div>

    <div v-if="editingItem" class="edit-content">
      <!-- 名称 -->
      <div class="form-group">
        <label>{{ t('context.tagName') }}</label>
        <input
          type="text"
          v-model="editedName"
          class="name-input"
          :placeholder="t('context.tagNamePlaceholder')"
        />
      </div>

      <!-- 类型（仅上下文） -->
      <div v-if="editingItem && 'type' in editingItem" class="form-group">
        <label>{{ t('context.type') }}</label>
        <div class="type-display">
          {{ editingItem.type === 'static' ? t('context.static') : t('context.dynamic') }}
        </div>
      </div>

      <!-- 颜色 -->
      <div class="form-group">
        <label>{{ t('context.tagColor') }}</label>
        <div class="color-picker">
          <button
            v-for="color in contextColors"
            :key="color"
            class="color-option"
            :class="{ selected: editedColor === color }"
            :style="{ backgroundColor: color }"
            @click="editedColor = color"
          />
        </div>
      </div>

      <!-- 内容 -->
      <div class="form-group content-group">
        <label>{{ isQuickCommand ? t('quickCommand.content') : t('context.content') }}</label>
        <textarea
          v-model="editedContent"
          class="content-input"
          :placeholder="isQuickCommand ? t('quickCommand.commandContentPlaceholder') : t('context.contentPlaceholder')"
        />
      </div>
    </div>

    <div v-else class="empty-state">
      <svg viewBox="0 0 24 24" width="48" height="48" fill="currentColor" class="empty-icon">
        <path d="M17.63 5.84C17.27 5.33 16.67 5 16 5L5 5.01C3.9 5.01 3 5.9 3 7v10c0 1.1.9 1.99 2 1.99L16 19c.67 0 1.27-.33 1.63-.84L22 12l-4.37-6.16z"/>
      </svg>
      <p>{{ t('context.selectToEdit') }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useContextStore } from '@/stores/contextStore'
import { useQuickCommandStore } from '@/stores/quickCommandStore'
import { CONTEXT_COLORS } from '@/types/context'
import type { ContextFile } from '@/types/context'
import type { QuickCommand } from '@/types/quickCommand'

const props = defineProps<{
  context: ContextFile | null
  quickCommand: QuickCommand | null
}>()

const emit = defineEmits<{
  (e: 'save'): void
  (e: 'delete', itemId: string, type: 'context' | 'quickCommand'): void
}>()

const { t } = useI18n()
const contextStore = useContextStore()
const quickCommandStore = useQuickCommandStore()

const contextColors = CONTEXT_COLORS

// 编辑中的项目
const editingItem = computed(() => props.context || props.quickCommand)
const isQuickCommand = computed(() => props.quickCommand !== null)

// 编辑状态
const editedName = ref('')
const editedColor = ref('')
const editedContent = ref('')

// 是否有修改
const hasChanges = computed(() => {
  if (!editingItem.value) return false
  return editedName.value !== editingItem.value.name ||
         editedColor.value !== editingItem.value.color ||
         editedContent.value !== (editingItem.value as any).content
})

// 监听props变化，更新编辑状态
watch(() => [props.context, props.quickCommand], () => {
  if (props.context) {
    editedName.value = props.context.name
    editedColor.value = props.context.color
    editedContent.value = props.context.content
  } else if (props.quickCommand) {
    editedName.value = props.quickCommand.name
    editedColor.value = props.quickCommand.color
    editedContent.value = props.quickCommand.content
  } else {
    editedName.value = ''
    editedColor.value = ''
    editedContent.value = ''
  }
}, { immediate: true })

async function handleSave() {
  if (!editingItem.value || !hasChanges.value) return

  if (isQuickCommand.value && props.quickCommand) {
    await quickCommandStore.updateQuickCommand(props.quickCommand.id, {
      name: editedName.value,
      color: editedColor.value,
      content: editedContent.value
    })
  } else if (props.context) {
    await contextStore.updateContextFile(props.context.id, {
      name: editedName.value,
      color: editedColor.value,
      content: editedContent.value
    })
  }
  emit('save')
}

function handleDelete() {
  if (!editingItem.value) return

  const itemId = editingItem.value.id
  const type = isQuickCommand.value ? 'quickCommand' : 'context'
  emit('delete', itemId, type)
}
</script>

<style scoped>
.context-edit-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  border-bottom: 1px solid var(--border-color);
}

.panel-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 500;
  color: var(--text-primary);
}

.header-actions {
  display: flex;
  gap: 8px;
}

.save-btn {
  padding: 8px 16px;
  background: var(--color-primary);
  border: none;
  border-radius: 6px;
  color: white;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.save-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.save-btn:not(:disabled):hover {
  opacity: 0.9;
}

.delete-btn {
  padding: 8px 16px;
  background: transparent;
  border: 1px solid var(--color-error);
  border-radius: 6px;
  color: var(--color-error);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.delete-btn:hover {
  background: var(--color-error);
  color: white;
}

.edit-content {
  flex: 1;
  padding: 24px;
  overflow-y: auto;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
}

.name-input {
  width: 100%;
  padding: 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 14px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  box-sizing: border-box;
}

.name-input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.type-display {
  padding: 12px;
  background: var(--bg-secondary);
  border-radius: 6px;
  font-size: 14px;
  color: var(--text-primary);
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
  box-shadow: 0 0 0 2px var(--bg-primary), 0 0 0 4px var(--border-color);
}

.content-group {
  flex: 1;
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

.content-input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px;
}

.empty-icon {
  color: var(--text-tertiary);
  margin-bottom: 16px;
}

.empty-state p {
  color: var(--text-secondary);
  font-size: 14px;
}
</style>