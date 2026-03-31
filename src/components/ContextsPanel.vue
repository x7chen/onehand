<template>
  <div class="contexts-panel">
    <div class="panel-header">
      <h2>上下文标签</h2>
      <button @click="$emit('newContext')" class="new-context-btn">
        + 新建标签
      </button>
    </div>

    <div v-if="contextStore.contextFiles.length === 0" class="empty-state">
      <p>暂无上下文标签，创建一个作为笔记本背景知识或动态积累内容吧！</p>
    </div>

    <div v-else class="contexts-container">
      <!-- 静态上下文标签 -->
      <div v-if="contextStore.staticContextFiles.length > 0" class="context-category">
        <h3>静态上下文</h3>
        <div class="tags-wrapper">
          <div
            v-for="file in contextStore.staticContextFiles"
            :key="file.id"
            class="context-tag"
            draggable="true"
            :style="{ backgroundColor: file.color + '20', borderColor: file.color }"
            @dblclick="$emit('editContext', file)"
            @dragstart="$emit('dragStart', $event, file)"
            @dragend="$emit('dragEnd', $event)"
          >
            <span class="tag-name" :style="{ color: file.color }">{{ file.name }}</span>
          </div>
        </div>
      </div>

      <!-- 动态上下文标签 -->
      <div v-if="contextStore.dynamicContextFiles.length > 0" class="context-category">
        <h3>动态上下文</h3>
        <div class="tags-wrapper">
          <div
            v-for="file in contextStore.dynamicContextFiles"
            :key="file.id"
            class="context-tag"
            draggable="true"
            :style="{ backgroundColor: file.color + '20', borderColor: file.color }"
            @dblclick="$emit('editContext', file)"
            @dragstart="$emit('dragStart', $event, file)"
            @dragend="$emit('dragEnd', $event)"
          >
            <span class="tag-name" :style="{ color: file.color }">{{ file.name }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useContextStore } from '@/stores/contextStore'
import type { ContextFile } from '@/types/context'

const emit = defineEmits<{
  (e: 'newContext'): void
  (e: 'editContext', file: ContextFile): void
  (e: 'dragStart', event: DragEvent, file: ContextFile): void
  (e: 'dragEnd', event: DragEvent): void
}>()

const contextStore = useContextStore()
</script>

<style scoped>
.contexts-panel {
  height: 100%;
  padding: 24px;
  overflow-y: auto;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.panel-header h2 {
  font-size: 20px;
  color: var(--text-primary);
}

.new-context-btn {
  padding: 10px 20px;
  background: #66bb6a;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: white;
  font-weight: 500;
  transition: background 0.2s;
}

.new-context-btn:hover {
  background: #4caf50;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: var(--text-secondary);
}

.contexts-container {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.context-category h3 {
  font-size: 16px;
  color: var(--text-secondary);
  margin-bottom: 16px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.tags-wrapper {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.context-tag {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 20px;
  border: 2px solid;
  cursor: pointer;
  transition: all 0.2s;
  user-select: none;
}

.context-tag:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}

.tag-name {
  font-size: 14px;
  font-weight: 500;
}
</style>