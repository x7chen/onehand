<template>
  <div class="contexts-panel">
    <div class="panel-header">
      <h2>{{ t('context.contextTags') }}</h2>
      <button @click="$emit('newContext')" class="new-context-btn">
        + {{ t('context.newTag') }}
      </button>
    </div>

    <div v-if="contextStore.contextFiles.length === 0" class="empty-state">
      <p>{{ t('context.noContexts') }}</p>
    </div>

    <div v-else class="contexts-container">
      <!-- 静态上下文标签 -->
      <div v-if="contextStore.staticContextFiles.length > 0" class="context-category">
        <h3>{{ t('context.static') }}</h3>
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
        <h3>{{ t('context.dynamic') }}</h3>
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

    <!-- 快捷指令区域 -->
    <div class="quick-command-section">
      <div class="panel-header">
        <h2>{{ t('quickCommand.title') }}</h2>
        <button @click="showNewQuickCommandDialog = true" class="new-context-btn">
          + {{ t('quickCommand.newCommand') }}
        </button>
      </div>

      <div v-if="quickCommandStore.quickCommands.length === 0" class="empty-state">
        <p>{{ t('quickCommand.noCommands') }}</p>
      </div>

      <div v-else class="tags-wrapper">
        <div
          v-for="cmd in quickCommandStore.quickCommands"
          :key="cmd.id"
          class="context-tag quick-command-tag"
          draggable="true"
          :style="{ backgroundColor: cmd.color + '20', borderColor: cmd.color }"
          @dblclick="editQuickCommand(cmd)"
          @dragstart="handleQuickCommandDragStart($event, cmd)"
          @dragend="handleQuickCommandDragEnd($event)"
        >
          <span class="tag-name" :style="{ color: cmd.color }">{{ cmd.name }}</span>
        </div>
      </div>
    </div>

    <!-- 新建快捷指令对话框 -->
    <div v-if="showNewQuickCommandDialog" class="dialog-overlay" @click="showNewQuickCommandDialog = false">
      <div class="dialog" @click.stop>
        <h3>{{ t('quickCommand.newCommand') }}</h3>
        <input
          v-model="newQuickCommandName"
          type="text"
          :placeholder="t('quickCommand.commandNamePlaceholder')"
        />
        <textarea
          v-model="newQuickCommandContent"
          :placeholder="t('quickCommand.commandContentPlaceholder')"
          class="content-input"
        ></textarea>
        <div class="form-group">
          <label>{{ t('context.tagColor') }}</label>
          <div class="color-picker">
            <button
              v-for="color in QUICK_COMMAND_COLORS"
              :key="color"
              class="color-option"
              :class="{ selected: newQuickCommandColor === color }"
              :style="{ backgroundColor: color }"
              @click="newQuickCommandColor = color"
            />
          </div>
        </div>
        <div class="dialog-actions">
          <button @click="showNewQuickCommandDialog = false" class="cancel-btn">{{ t('common.cancel') }}</button>
          <button @click="createQuickCommand" class="confirm-btn">{{ t('common.create') }}</button>
        </div>
      </div>
    </div>

    <!-- 编辑快捷指令对话框 -->
    <div v-if="showEditQuickCommandDialog && editingQuickCommand" class="dialog-overlay" @click="showEditQuickCommandDialog = false">
      <div class="dialog" @click.stop>
        <h3>{{ t('quickCommand.editCommand') }}</h3>
        <input
          v-model="editingQuickCommand.name"
          type="text"
          :placeholder="t('quickCommand.commandNamePlaceholder')"
        />
        <textarea
          v-model="editingQuickCommand.content"
          :placeholder="t('quickCommand.commandContentPlaceholder')"
          class="content-input"
        ></textarea>
        <div class="form-group">
          <label>{{ t('context.tagColor') }}</label>
          <div class="color-picker">
            <button
              v-for="color in QUICK_COMMAND_COLORS"
              :key="color"
              class="color-option"
              :class="{ selected: editingQuickCommand.color === color }"
              :style="{ backgroundColor: color }"
              @click="editingQuickCommand.color = color"
            />
          </div>
        </div>
        <div class="dialog-actions">
          <button @click="showEditQuickCommandDialog = false" class="cancel-btn">{{ t('common.cancel') }}</button>
          <button @click="saveQuickCommandEdit" class="confirm-btn">{{ t('common.save') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useContextStore } from '@/stores/contextStore'
import { useQuickCommandStore } from '@/stores/quickCommandStore'
import { QUICK_COMMAND_COLORS } from '@/types/quickCommand'
import type { ContextFile } from '@/types/context'
import type { QuickCommand } from '@/types/quickCommand'

const { t } = useI18n()

const emit = defineEmits<{
  (e: 'newContext'): void
  (e: 'editContext', file: ContextFile): void
  (e: 'dragStart', event: DragEvent, file: ContextFile): void
  (e: 'dragEnd', event: DragEvent): void
  (e: 'quickCommandDragStart', event: DragEvent, cmd: QuickCommand): void
  (e: 'quickCommandDragEnd', event: DragEvent): void
}>()

const contextStore = useContextStore()
const quickCommandStore = useQuickCommandStore()

// 加载快捷指令
onMounted(() => {
  quickCommandStore.loadQuickCommands()
})

// 快捷指令相关状态
const showNewQuickCommandDialog = ref(false)
const newQuickCommandName = ref('')
const newQuickCommandContent = ref('')
const newQuickCommandColor = ref(quickCommandStore.getNextColor())

const showEditQuickCommandDialog = ref(false)
const editingQuickCommand = ref<QuickCommand | null>(null)

// 创建快捷指令
async function createQuickCommand() {
  if (!newQuickCommandName.value.trim()) return

  await quickCommandStore.createQuickCommand(
    newQuickCommandName.value.trim(),
    newQuickCommandContent.value.trim()
  )

  showNewQuickCommandDialog.value = false
  newQuickCommandName.value = ''
  newQuickCommandContent.value = ''
  newQuickCommandColor.value = quickCommandStore.getNextColor()
}

// 编辑快捷指令
function editQuickCommand(cmd: QuickCommand) {
  editingQuickCommand.value = { ...cmd }
  showEditQuickCommandDialog.value = true
}

// 保存快捷指令编辑
async function saveQuickCommandEdit() {
  if (!editingQuickCommand.value) return

  await quickCommandStore.updateQuickCommand(
    editingQuickCommand.value.id,
    {
      name: editingQuickCommand.value.name,
      content: editingQuickCommand.value.content,
      color: editingQuickCommand.value.color
    }
  )

  showEditQuickCommandDialog.value = false
  editingQuickCommand.value = null
}

// 删除快捷指令
async function deleteQuickCommand(cmd: QuickCommand) {
  await quickCommandStore.deleteQuickCommand(cmd.id)

  if (showEditQuickCommandDialog.value && editingQuickCommand.value?.id === cmd.id) {
    showEditQuickCommandDialog.value = false
    editingQuickCommand.value = null
  }
}

// 快捷指令拖拽
function handleQuickCommandDragStart(e: DragEvent, cmd: QuickCommand) {
  emit('quickCommandDragStart', e, cmd)
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    const target = e.target as HTMLElement
    target.style.opacity = '0.5'
  }
}

function handleQuickCommandDragEnd(e: DragEvent) {
  emit('quickCommandDragEnd', e)
  const target = e.target as HTMLElement
  target.style.opacity = '1'
}
</script>

<style scoped>
.contexts-panel {
  height: 100%;
  padding: 24px;
  overflow-y: auto;
  box-sizing: border-box;
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
  background: var(--color-primary);
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: white;
  font-weight: 500;
  transition: background 0.2s;
}

.new-context-btn:hover {
  background: var(--color-primary-hover);
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

/* 快捷指令区域 */
.quick-command-section {
  margin-top: 48px;
  padding-top: 24px;
  border-top: 1px solid var(--border-color);
}

/* 对话框样式 */
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.dialog {
  background: var(--bg-primary);
  padding: 24px;
  border-radius: 12px;
  min-width: 400px;
  max-width: 500px;
}

.dialog h3 {
  margin-bottom: 16px;
  font-size: 20px;
  color: var(--text-primary);
}

.dialog input[type="text"] {
  width: 100%;
  padding: 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 14px;
  margin-bottom: 16px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  box-sizing: border-box;
}

.content-input {
  width: 100%;
  min-height: 150px;
  padding: 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 14px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  resize: vertical;
  font-family: inherit;
  line-height: 1.6;
  box-sizing: border-box;
  margin-bottom: 16px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  color: var(--text-secondary);
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
  box-shadow: 0 0 0 2px var(--bg-secondary), 0 0 0 4px var(--border-color);
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 12px;
  margin-top: 20px;
}

.cancel-btn {
  padding: 8px 16px;
  background: var(--bg-secondary);
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: var(--text-secondary);
}

.confirm-btn {
  padding: 8px 16px;
  background: var(--color-primary);
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: white;
}
</style>