<template>
  <div v-if="selectedCount > 0" class="context-toolbar">
    <div class="context-info">
      已选择 {{ selectedCount }} 个上下文
    </div>
    <button class="clear-btn" @click="clearSelection">
      清空选择
    </button>
    <button class="ask-btn" @click="askWithContent">
      结合新录音提问
    </button>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  selectedCount: number
}>()

const emit = defineEmits<{
  (e: 'clear'): void
  (e: 'ask'): void
}>()

function clearSelection() {
  emit('clear')
}

function askWithContent() {
  emit('ask')
}
</script>

<style scoped>
.context-toolbar {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  background: var(--bg-primary);
  border-radius: 12px;
  box-shadow: 0 4px 12px var(--shadow-color);
  z-index: 1000;
}

.context-info {
  font-size: 14px;
  color: var(--text-secondary);
}

.clear-btn {
  padding: 8px 16px;
  background: var(--bg-secondary);
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  color: var(--text-secondary);
  transition: background 0.2s;
}

.clear-btn:hover {
  background: var(--border-color);
}

.ask-btn {
  padding: 8px 16px;
  background: #4299e1;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  color: white;
  font-weight: 500;
  transition: background 0.2s;
}

.ask-btn:hover {
  background: #3182ce;
}
</style>
