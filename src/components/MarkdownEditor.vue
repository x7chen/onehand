<template>
  <SimpleMarkdownEditor
    ref="innerRef"
    :initial-value="initialValue"
    @change="handleChange"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import SimpleMarkdownEditor from './SimpleMarkdownEditor.vue'

const props = withDefaults(defineProps<{
  initialValue?: string
  readonly?: boolean
}>(), {
  initialValue: '',
  readonly: false
})

const emit = defineEmits<{
  change: [value: string]
  save: [value: string]
}>()

const innerRef = ref<InstanceType<typeof SimpleMarkdownEditor> | null>(null)

function handleChange(value: string) {
  emit('change', value)
}

// 获取当前markdown内容
function getMarkdown(): string {
  return innerRef.value?.getMarkdown() || ''
}

// 设置markdown内容
function setMarkdown(markdown: string) {
  innerRef.value?.setMarkdown(markdown)
}

// 暴露方法
defineExpose({
  getMarkdown,
  setMarkdown
})
</script>

<style scoped>
/* 编辑器样式在内部组件中定义 */
</style>