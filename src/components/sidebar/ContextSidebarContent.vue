<template>
  <div class="context-sidebar-content">
    <!-- 静态上下文区域 -->
    <div class="context-section">
      <div class="section-header">
        <span class="section-title">{{ t('context.static') }}</span>
        <button class="create-btn" @click="handleCreateStatic">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
          </svg>
        </button>
      </div>
      <div class="context-list">
        <div
          v-for="ctx in staticContexts"
          :key="ctx.id"
          class="context-item"
          :class="{ active: selectedContextId === ctx.id }"
          draggable="true"
          @click="handleSelectContext(ctx.id)"
          @dblclick="handleEditContext(ctx)"
          @dragstart="handleDragStart($event, ctx)"
          @dragend="handleDragEnd($event)"
        >
          <span class="color-dot" :style="{ backgroundColor: ctx.color }"></span>
          <span class="item-name">{{ ctx.name }}</span>
        </div>
        <div v-if="staticContexts.length === 0" class="empty-hint">
          {{ t('context.noContexts') }}
        </div>
      </div>
    </div>

    <!-- 动态上下文区域 -->
    <div class="context-section">
      <div class="section-header">
        <span class="section-title">{{ t('context.dynamic') }}</span>
        <button class="create-btn" @click="handleCreateDynamic">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
          </svg>
        </button>
      </div>
      <div class="context-list">
        <div
          v-for="ctx in dynamicContexts"
          :key="ctx.id"
          class="context-item"
          :class="{ active: selectedContextId === ctx.id }"
          draggable="true"
          @click="handleSelectContext(ctx.id)"
          @dblclick="handleEditContext(ctx)"
          @dragstart="handleDragStart($event, ctx)"
          @dragend="handleDragEnd($event)"
        >
          <span class="color-dot" :style="{ backgroundColor: ctx.color }"></span>
          <span class="item-name">{{ ctx.name }}</span>
        </div>
        <div v-if="dynamicContexts.length === 0" class="empty-hint">
          {{ t('context.noContexts') }}
        </div>
      </div>
    </div>

    <!-- 分隔线 -->
    <div class="separator"></div>

    <!-- 快捷指令区域 -->
    <div class="quick-command-section">
      <div class="section-header">
        <span class="section-title">{{ t('quickCommand.title') }}</span>
        <button class="create-btn" @click="handleCreateQuickCommand">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
          </svg>
        </button>
      </div>
      <div class="context-list">
        <div
          v-for="cmd in quickCommands"
          :key="cmd.id"
          class="context-item"
          :class="{ active: selectedQuickCommandId === cmd.id }"
          draggable="true"
          @click="handleSelectQuickCommand(cmd.id)"
          @dblclick="handleEditQuickCommand(cmd)"
          @dragstart="handleQuickCommandDragStart($event, cmd)"
          @dragend="handleQuickCommandDragEnd($event)"
        >
          <span class="color-dot" :style="{ backgroundColor: cmd.color }"></span>
          <span class="item-name">{{ cmd.name }}</span>
        </div>
        <div v-if="quickCommands.length === 0" class="empty-hint">
          {{ t('quickCommand.noCommands') }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { ContextFile } from '@/types/context'
import type { QuickCommand } from '@/types/quickCommand'

const props = defineProps<{
  staticContexts: ContextFile[]
  dynamicContexts: ContextFile[]
  quickCommands: QuickCommand[]
  selectedContextId: string | null
  selectedQuickCommandId: string | null
}>()

const emit = defineEmits<{
  (e: 'create-context', type: 'static' | 'dynamic'): void
  (e: 'select-context', contextId: string | null): void
  (e: 'create-quick-command'): void
  (e: 'select-quick-command', commandId: string | null): void
  (e: 'edit-context', context: ContextFile): void
  (e: 'edit-quick-command', command: QuickCommand): void
  (e: 'drag-start', event: DragEvent, context: ContextFile): void
  (e: 'drag-end', event: DragEvent): void
  (e: 'quick-command-drag-start', event: DragEvent, command: QuickCommand): void
  (e: 'quick-command-drag-end', event: DragEvent): void
}>()

const { t } = useI18n()

function handleCreateStatic() {
  emit('create-context', 'static')
}

function handleCreateDynamic() {
  emit('create-context', 'dynamic')
}

function handleSelectContext(contextId: string) {
  emit('select-context', contextId)
}

function handleCreateQuickCommand() {
  emit('create-quick-command')
}

function handleSelectQuickCommand(commandId: string) {
  emit('select-quick-command', commandId)
}

function handleEditContext(ctx: ContextFile) {
  emit('edit-context', ctx)
}

function handleEditQuickCommand(cmd: QuickCommand) {
  emit('edit-quick-command', cmd)
}

function handleDragStart(e: DragEvent, ctx: ContextFile) {
  emit('drag-start', e, ctx)
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    const target = e.target as HTMLElement
    target.style.opacity = '0.5'
  }
}

function handleDragEnd(e: DragEvent) {
  emit('drag-end', e)
  const target = e.target as HTMLElement
  target.style.opacity = '1'
}

function handleQuickCommandDragStart(e: DragEvent, cmd: QuickCommand) {
  emit('quick-command-drag-start', e, cmd)
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    const target = e.target as HTMLElement
    target.style.opacity = '0.5'
  }
}

function handleQuickCommandDragEnd(e: DragEvent) {
  emit('quick-command-drag-end', e)
  const target = e.target as HTMLElement
  target.style.opacity = '1'
}
</script>

<style scoped>
.context-sidebar-content {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 8px;
  overflow-y: auto;
}

.context-section {
  display: flex;
  flex-direction: column;
  margin-bottom: 8px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-tertiary);
}

.create-btn {
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--color-primary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.create-btn:hover {
  background: var(--color-primary-light);
}

.context-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.context-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.context-item:hover {
  background: var(--bg-secondary);
}

.context-item.active {
  background: var(--bg-secondary);
  border-left: 2px solid var(--color-primary);
  padding-left: 10px;
}

.color-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}

.item-name {
  font-size: 13px;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.empty-hint {
  padding: 12px;
  font-size: 13px;
  color: var(--text-tertiary);
  text-align: center;
}

.separator {
  height: 1px;
  background: var(--border-color);
  margin: 8px 0;
}

.quick-command-section {
  display: flex;
  flex-direction: column;
}
</style>