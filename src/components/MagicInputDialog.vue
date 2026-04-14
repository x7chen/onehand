<template>
  <Teleport to="body">
    <Transition name="magic-input-fade">
      <div v-if="visible" class="magic-input-overlay" @click="handleOverlayClick">
        <div class="magic-input-container-wrapper">
          <div class="magic-input-container" :class="{ shake: isShaking }" @click.stop>
            <MagicInputCore
              ref="magicInputCoreRef"
              v-model="inputText"
              :initial-text="initialText"
              :show-correct="showCorrect"
              :show-cancel="true"
              :node-id="nodeId"
              @save="handleSave"
              @cancel="handleCancel"
              @input="handleInput"
            />
          </div>

          <!-- Toast 消息提示 -->
          <Transition name="toast-fade">
            <div v-if="showToast" class="toast-message">
              {{ toastMessage }}
            </div>
          </Transition>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import MagicInputCore from './MagicInputCore.vue'

const props = withDefaults(defineProps<{
  visible: boolean
  initialText?: string
  showCorrect?: boolean
  nodeId?: string
}>(), {
  visible: false,
  initialText: '',
  showCorrect: true,
  nodeId: undefined
})

const emit = defineEmits<{
  'update:visible': [value: boolean]
  'save': [text: string]
  'cancel': []
}>()

const { t } = useI18n()

// MagicInputCore 引用
const magicInputCoreRef = ref<InstanceType<typeof MagicInputCore> | null>(null)

// 输入文本
const inputText = ref('')

// Toast 消息
const showToast = ref(false)
const toastMessage = ref('')
let toastTimer: number | null = null

// 抖动动画
const isShaking = ref(false)

// 初始文本（用于检测变化）
const initialTextSnapshot = ref('')

// 监听 visible 变化
watch(() => props.visible, (newVal) => {
  if (newVal) {
    inputText.value = props.initialText || ''
    initialTextSnapshot.value = inputText.value
    showToast.value = false
    nextTick(() => {
      // 聚焦并选中文本
      if (magicInputCoreRef.value?.textareaRef) {
        magicInputCoreRef.value.textareaRef.focus()
        magicInputCoreRef.value.textareaRef.select()
      }
    })
  }
})

// 检查文本是否有变化
function hasTextChanges(): boolean {
  return inputText.value !== initialTextSnapshot.value
}

// 显示 toast 消息
function showToastMessage(message: string) {
  toastMessage.value = message
  showToast.value = true
  if (toastTimer) {
    clearTimeout(toastTimer)
  }
  toastTimer = window.setTimeout(() => {
    showToast.value = false
  }, 2000)
}

// 触发抖动动画
function triggerShake() {
  isShaking.value = true
  setTimeout(() => {
    isShaking.value = false
  }, 500)
}

// 处理点击 overlay（非内容区域）
function handleOverlayClick() {
  if (hasTextChanges()) {
    triggerShake()
    showToastMessage(t('common.unsavedChanges'))
  } else {
    handleCancel()
  }
}

// 处理保存
function handleSave(text: string) {
  emit('save', text)
  emit('update:visible', false)
}

// 处理取消
function handleCancel() {
  emit('cancel')
  emit('update:visible', false)
}

// 处理输入（可以用于记录等）
function handleInput() {
  // 可以在这里添加额外的处理逻辑
}
</script>

<style scoped>
.magic-input-overlay {
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

.magic-input-container-wrapper {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  max-height: 80vh;
}

.magic-input-container {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 90%;
  max-width: 800px;
  max-height: 80vh;
  background: var(--bg-primary);
  padding: 8px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  box-sizing: border-box;
  overflow: hidden;
}

/* 确保 MagicInputCore 在弹出框中正确填充高度 */
.magic-input-container :deep(.magic-input-core) {
  display: flex;
  flex-direction: column;
  max-height: calc(80vh - 16px);
}

.magic-input-container :deep(.magic-input-textarea) {
  min-height: 100px;
  max-height: 600px;
  flex: 0 1 auto;
}

/* 过渡动画 */
.magic-input-fade-enter-active,
.magic-input-fade-leave-active {
  transition: opacity 0.2s ease;
}

.magic-input-fade-enter-from,
.magic-input-fade-leave-to {
  opacity: 0;
}

/* 抖动动画 */
.magic-input-container.shake {
  animation: shake 0.5s ease-in-out;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
  20%, 40%, 60%, 80% { transform: translateX(4px); }
}

/* Toast 消息 */
.toast-message {
  position: absolute;
  top: -40px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--color-warning-bg, rgba(234, 179, 8, 0.15));
  border: 1px solid var(--color-warning, #eab308);
  color: var(--color-warning, #eab308);
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 14px;
  white-space: nowrap;
  z-index: 20;
}

.toast-fade-enter-active,
.toast-fade-leave-active {
  transition: opacity 0.3s ease;
}

.toast-fade-enter-from,
.toast-fade-leave-to {
  opacity: 0;
}
</style>
