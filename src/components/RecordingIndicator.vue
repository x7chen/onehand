<template>
  <div 
    class="recording-indicator"
    :style="{ left: x + 'px', top: y + 'px' }"
  >
    <div class="recording-dot"></div>
    <span class="recording-time">{{ formattedTime }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { formatDuration } from '@/utils/helpers'

const props = defineProps<{
  x: number  // Screen coordinates (clientX)
  y: number  // Screen coordinates (clientY)
  duration?: number
}>()

const formattedTime = computed(() => formatDuration(props.duration || 0))
</script>

<style scoped>
.recording-indicator {
  position: fixed; /* Changed from absolute to fixed */
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--bg-primary);
  border-radius: 20px;
  box-shadow: 0 2px 8px var(--shadow-color);
  pointer-events: none;
  z-index: 9999; /* Higher z-index to appear above everything */
  transform: translate(-50%, calc(-100% - 10px));
}

.recording-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--color-recording);
  animation: pulse 1s infinite;
}

.recording-time {
  font-size: var(--font-size-heading);
  font-weight: 500;
  color: var(--text-primary);
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}
</style>
