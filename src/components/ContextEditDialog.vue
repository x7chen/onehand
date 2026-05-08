<template>
  <Teleport to="body">
    <Transition name="dialog-fade">
      <div v-if="visible" class="context-edit-overlay" @click="handleOverlayClick">
        <div class="context-edit-dialog" @click.stop>
          <!-- 头部 -->
          <div class="dialog-header">
            <h3>{{ isNew ? t('context.newContext') : t('context.editTag') }}</h3>
            <button class="close-btn" @click="handleCancel">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </button>
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
          <div class="dialog-footer">
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
              <button class="save-btn" @click="handleSave">
                {{ t('common.save') }}
              </button>
            </div>
            <button v-if="isNew" class="save-btn" @click="handleSave" :disabled="!editingName.trim()">
              {{ t('common.create') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import MarkdownEditor from './MarkdownEditor.vue'
import { CONTEXT_COLORS, type ContextColor, type ContextType } from '@/types/context'
import type { ContextFile } from '@/types/context'

const props = defineProps<{
  visible: boolean
  context?: ContextFile | null
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  'save': [data: { name: string; type: ContextType; color: ContextColor; content: string }]
  'delete': []
  'cancel': []
}>()

const { t } = useI18n()

// 编辑器引用
const editorRef = ref<InstanceType<typeof MarkdownEditor> | null>(null)

// 是否是新建
const isNew = computed(() => !props.context)

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

// 监听 visible 变化，初始化编辑数据
watch(() => props.visible, (newVal) => {
  if (newVal) {
    if (props.context) {
      // 编辑现有上下文 - 保留原有类型
      editingName.value = props.context.name
      editingType.value = props.context.type
      editingColor.value = CONTEXT_COLORS.includes(props.context.color as ContextColor)
        ? props.context.color as ContextColor
        : CONTEXT_COLORS[0]
      editingContent.value = props.context.content
    } else {
      // 新建上下文 - 默认静态类型
      editingName.value = ''
      editingType.value = 'static'
      editingColor.value = CONTEXT_COLORS[0]
      editingContent.value = ''
    }
    // 强制重新渲染编辑器，使其加载新的 initialValue
    editorKey.value++
  }
})

// 点击 overlay
function handleOverlayClick(e: MouseEvent) {
  // 只有直接点击 overlay 才关闭
  if (e.target === e.currentTarget) {
    handleCancel()
  }
}

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
    content
  })
  emit('update:visible', false)
}

// 删除
function handleDelete() {
  emit('delete')
  emit('update:visible', false)
}

// 取消
function handleCancel() {
  emit('cancel')
  emit('update:visible', false)
}
</script>

<style scoped>
.context-edit-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3000;
}

.context-edit-dialog {
  background: var(--bg-primary);
  border-radius: 12px;
  width: 90%;
  max-width: 800px;
  height: 800px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
}

.dialog-header h3 {
  font-size: 18px;
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
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.name-input {
  padding: 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 14px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  outline: none;
}

.name-input:focus {
  border-color: var(--color-primary);
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

.dialog-footer {
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
  font-size: 14px;
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
  font-size: 14px;
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
  font-size: 14px;
  font-weight: 500;
}

.save-btn:hover {
  background: var(--color-primary-hover);
}

.save-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 过渡动画 */
.dialog-fade-enter-active,
.dialog-fade-leave-active {
  transition: opacity 0.2s ease;
}

.dialog-fade-enter-from,
.dialog-fade-leave-to {
  opacity: 0;
}
</style>