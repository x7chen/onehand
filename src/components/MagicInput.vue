<template>
  <MagicInputDialog
    :visible="isOpen"
    :initial-text="initialText"
    :show-correct="showCorrect"
    :node-id="nodeId"
    @update:visible="handleUpdateVisible"
    @save="handleSave"
    @cancel="handleCancel"
  />
</template>

<script setup lang="ts">
import MagicInputDialog from './MagicInputDialog.vue'

const props = defineProps<{
  isOpen: boolean
  initialText?: string
  showCorrect?: boolean
  nodeId?: string
}>()

const emit = defineEmits<{
  save: [text: string]
  cancel: []
}>()

// 处理 visible 更新
function handleUpdateVisible(value: boolean) {
  // MagicInputDialog 内部会处理关闭，这里仅用于同步状态
  // 由于 isOpen 是单向的，我们不需要做什么
}

// 处理保存
function handleSave(text: string) {
  emit('save', text)
}

// 处理取消
function handleCancel() {
  emit('cancel')
}
</script>
