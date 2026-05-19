<template>
  <div class="context-edit-panel">
    <!-- 头部 -->
    <div class="panel-header">
      <h3>{{ isNew ? (isQuickCommand ? t('quickCommand.newCommand') : t('context.newContext')) : (isQuickCommand ? t('quickCommand.editCommand') : t('context.editTag')) }}</h3>
    </div>

    <!-- 名称输入 -->
    <div class="form-row">
      <input
        v-model="editingName"
        type="text"
        class="name-input"
        :placeholder="t('context.contextNamePlaceholder')"
      />
    </div>

    <!-- 类型选择（新建或编辑上下文时） -->
    <div v-if="!isQuickCommand" class="form-row">
      <label class="form-label">{{ t('context.type') }}</label>
      <div class="type-selector">
        <button
          class="type-option"
          :class="{ active: editingType === 'static' }"
          @click="editingType = 'static'"
        >
          {{ t('context.static') }}
        </button>
        <button
          class="type-option"
          :class="{ active: editingType === 'dynamic' }"
          @click="editingType = 'dynamic'"
        >
          {{ t('context.dynamic') }}
        </button>
      </div>
    </div>

    <!-- Markdown 编辑器 -->
    <div class="form-row editor-row">
      <div class="editor-container">
        <MarkdownEditor
          :key="editorKey"
          ref="editorRef"
          :initial-value="editingContent"
          @change="handleContentChange"
        />
      </div>
    </div>

    <!-- 颜色选择 -->
    <div class="form-row">
      <label class="form-label">{{ t('context.tagColor') }}</label>
      <div class="color-picker">
        <button
          v-for="color in contextColors"
          :key="color"
          class="color-option"
          :class="{ selected: editingColor === color }"
          :style="{ backgroundColor: color }"
          @click="editingColor = color"
        />
      </div>
    </div>

    <!-- 操作按钮 -->
    <div class="panel-footer">
      <button v-if="!isNew" class="delete-btn" @click="handleDelete">
        {{ t('common.delete') }}
      </button>
      <button v-if="isNew" class="cancel-btn" @click="handleCancel">
        {{ t('common.cancel') }}
      </button>
      <div v-if="!isNew" class="footer-right">
        <button class="cancel-btn" @click="handleCancel">
          {{ t('common.cancel') }}
        </button>
        <button class="save-btn" @click="handleSave" :disabled="!editingName.trim()">
          {{ t('common.save') }}
        </button>
      </div>
      <button v-if="isNew" class="save-btn" @click="handleSave" :disabled="!editingName.trim()">
        {{ t('common.create') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import MarkdownEditor from './MarkdownEditor.vue'
import { CONTEXT_COLORS, type ContextColor, type ContextType } from '@/types/context'
import type { ContextFile } from '@/types/context'
import type { QuickCommand } from '@/types/quickCommand'

const props = defineProps<{
  context: ContextFile | null
  quickCommand: QuickCommand | null
  isCreating?: 'static' | 'dynamic' | 'quickCommand' | false
}>()

const emit = defineEmits<{
  (e: 'save', data: { name: string; type: ContextType; color: ContextColor; content: string; isNew: boolean }): void
  (e: 'delete', itemId: string, type: 'context' | 'quickCommand'): void
  (e: 'cancel'): void
}>()

const { t } = useI18n()

// 编辑器引用
const editorRef = ref<InstanceType<typeof MarkdownEditor> | null>(null)

// 是否是新建
const isNew = computed(() => props.isCreating !== false && props.isCreating !== undefined)
const isQuickCommand = computed(() => props.isCreating === 'quickCommand' || props.quickCommand !== null)

// 预设颜色
const contextColors = computed(() => CONTEXT_COLORS)

// 编辑状态
const editingName = ref('')
const editingType = ref<ContextType>('static')
const editingColor = ref<ContextColor>(CONTEXT_COLORS[0])
const editingContent = ref('')
const editorKey = ref(0) // 用于强制重新渲染编辑器

// 内容变化回调
function handleContentChange(value: string) {
  editingContent.value = value
}

// 监听 props 变化，初始化编辑数据
watch(() => [props.context, props.quickCommand, props.isCreating], () => {
  if (props.context) {
    // 编辑现有上下文
    editingName.value = props.context.name
    editingType.value = props.context.type
    editingColor.value = CONTEXT_COLORS.includes(props.context.color as ContextColor)
      ? props.context.color as ContextColor
      : CONTEXT_COLORS[0]
    editingContent.value = props.context.content
  } else if (props.quickCommand) {
    // 编辑现有快捷指令
    editingName.value = props.quickCommand.name
    editingType.value = 'static' // 快捷指令没有类型
    editingColor.value = CONTEXT_COLORS.includes(props.quickCommand.color as ContextColor)
      ? props.quickCommand.color as ContextColor
      : CONTEXT_COLORS[0]
    editingContent.value = props.quickCommand.content
  } else if (props.isCreating) {
    // 新建
    editingName.value = ''
    editingColor.value = CONTEXT_COLORS[0]
    editingContent.value = ''
    if (props.isCreating === 'static') {
      editingType.value = 'static'
    } else if (props.isCreating === 'dynamic') {
      editingType.value = 'dynamic'
    } else if (props.isCreating === 'quickCommand') {
      editingType.value = 'static'
    }
  }
  // 强制重新渲染编辑器
  editorKey.value++
}, { immediate: true })

// 保存
function handleSave() {
  const name = editingName.value.trim()
  if (!name) return

  // 从编辑器获取最新内容
  const content = editorRef.value?.getMarkdown() || editingContent.value

  emit('save', {
    name,
    type: editingType.value,
    color: editingColor.value,
    content,
    isNew: isNew.value
  })
}

// 删除
function handleDelete() {
  if (props.context) {
    emit('delete', props.context.id, 'context')
  } else if (props.quickCommand) {
    emit('delete', props.quickCommand.id, 'quickCommand')
  }
}

// 取消
function handleCancel() {
  emit('cancel')
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
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
}

.panel-header h3 {
  font-size: var(--font-size-title);
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
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

.form-row {
  display: flex;
  flex-direction: column;
  padding: 12px 24px;
}

.form-label {
  font-size: var(--font-size-heading);
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.name-input {
  padding: 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: var(--font-size-heading);
  background: var(--bg-secondary);
  color: var(--text-primary);
  outline: none;
}

.name-input:focus {
  border-color: var(--color-primary);
}

.type-selector {
  display: flex;
  gap: 12px;
}

.type-option {
  padding: 10px 20px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  font-size: var(--font-size-heading);
  cursor: pointer;
  transition: all 0.2s;
}

.type-option:hover {
  border-color: var(--color-primary);
  color: var(--text-primary);
}

.type-option.active {
  border-color: var(--color-primary);
  background: var(--color-primary);
  color: white;
}

.type-display {
  padding: 12px;
  background: var(--bg-secondary);
  border-radius: 6px;
  font-size: var(--font-size-heading);
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

.editor-row {
  flex: 1;
  min-height: 200px;
  display: flex;
  flex-direction: column;
}

.editor-container {
  flex: 1;
  min-height: 200px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-primary);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.panel-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px;
}

.footer-right {
  display: flex;
  gap: 12px;
}

.delete-btn {
  padding: 10px 20px;
  background: rgba(255, 68, 68, 0.1);
  border: 1px solid rgba(255, 68, 68, 0.3);
  border-radius: 6px;
  cursor: pointer;
  color: var(--color-error);
  font-size: var(--font-size-heading);
  transition: all 0.2s;
}

.delete-btn:hover {
  background: rgba(255, 68, 68, 0.2);
}

.cancel-btn {
  padding: 10px 20px;
  background: var(--bg-secondary);
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: var(--text-secondary);
  font-size: var(--font-size-heading);
}

.cancel-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.save-btn {
  padding: 10px 20px;
  background: var(--color-primary);
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: white;
  font-size: var(--font-size-heading);
  font-weight: 500;
}

.save-btn:hover {
  background: var(--color-primary-hover);
}

.save-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>