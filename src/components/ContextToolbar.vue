<template>
  <div v-if="selectedCount > 0" class="context-toolbar">
    <div class="context-info">
      已选择 {{ selectedCount }} 个上下文
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  selectedCount: number
}>()
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

</style>
