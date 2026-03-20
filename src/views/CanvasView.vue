<template>
  <div class="canvas-view">
    <CanvasHeader
      :project-name="projectStore.currentProject?.name || ''"
      :static-context-files="staticContextFiles"
      :all-static-context-files="contextStore.staticContextFiles"
      :dynamic-context-file="dynamicContextFile"
      v-model:global-hide-ai-result="globalHideAiResult"
      v-model:ai-answer-enabled="aiAnswerEnabled"
      :is-all-context-selected="isAllContextSelected"
      @back="goBack"
      @reset-viewport="handleResetViewport"
      @auto-layout="handleAutoLayout"
      @toggle-all-context="handleToggleAllContext"
      @invert-selection="handleInvertSelection"
      @open-dynamic-context-editor="openDynamicContextEditor"
      @toggle-static-context="toggleStaticContext"
      @dynamic-context-drop="handleDynamicContextDrop"
    />

    <CanvasArea
      ref="canvasAreaRef"
      :global-hide-ai-result="globalHideAiResult"
      :ai-answer-enabled="aiAnswerEnabled"
      :static-context-files="staticContextFiles"
      :dynamic-context-file="dynamicContextFile"
    />

    <!-- 动态上下文编辑器 -->
    <div v-if="showDynamicContextEditor" class="dialog-overlay" @click="showDynamicContextEditor = false">
      <div class="dialog dynamic-context-editor-dialog" @click.stop>
        <h3>
          <span v-if="dynamicContextFile">{{ dynamicContextFile.name }}</span>
          <span v-else>动态上下文</span>
        </h3>
        <div v-if="!dynamicContextFile" class="no-dynamic-context">
          <p>当前项目未关联动态上下文文件。</p>
          <p class="hint">拖拽文字到 Header 右侧区域可自动创建。</p>
        </div>
        <textarea
          v-else
          v-model="dynamicContextEditContent"
          placeholder="动态上下文内容（Markdown 格式）"
          class="content-input"
        ></textarea>
        <div class="dialog-actions" v-if="dynamicContextFile">
          <button @click="showDynamicContextEditor = false" class="cancel-btn">取消</button>
          <button @click="saveDynamicContextEdit" class="confirm-btn">保存</button>
        </div>
        <div class="dialog-actions" v-else>
          <button @click="showDynamicContextEditor = false" class="confirm-btn">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useProjectStore } from '@/stores/projectStore'
import { useContextStore } from '@/stores/contextStore'
import CanvasHeader from '@/components/CanvasHeader.vue'
import CanvasArea from '@/components/CanvasArea.vue'
import type { ContextFile } from '@/types/context'

const router = useRouter()
const route = useRoute()
const projectStore = useProjectStore()
const contextStore = useContextStore()

// CanvasArea 组件引用
const canvasAreaRef = ref<InstanceType<typeof CanvasArea> | null>(null)

// 全局 AI 回答隐藏状态
const globalHideAiResult = ref(false)

// AI 回答开关状态（默认开启）
const aiAnswerEnabled = ref(true)

// 动态上下文编辑器
const showDynamicContextEditor = ref(false)
const dynamicContextEditContent = ref('')

// 静态上下文
const staticContextFiles = computed(() => {
  const staticContextIds = projectStore.currentProject?.context?.staticContextIds || []
  return staticContextIds.map(id => contextStore.getContextFileById(id)).filter(Boolean) as ContextFile[]
})

// 动态上下文
const dynamicContextFile = computed(() => {
  const dynamicContextId = projectStore.currentProject?.context?.dynamicContextId
  if (dynamicContextId) {
    return contextStore.getContextFileById(dynamicContextId)
  }
  return undefined
})

// 已选择上下文数量
const selectedContextCount = computed(() =>
  projectStore.currentCanvas?.nodes.filter(n => n.selectedAsContext).length || 0
)

// 已完成节点数量
const completedNodesCount = computed(() =>
  projectStore.currentCanvas?.nodes.filter(n => n.transcriptStatus === 'done').length || 0
)

// 是否全选
const isAllContextSelected = computed(() =>
  completedNodesCount.value > 0 && selectedContextCount.value === completedNodesCount.value
)

onMounted(async () => {
  await contextStore.loadContextFiles()

  const projectId = route.params.projectId as string
  const project = projectStore.projects.find(p => p.id === projectId)
  if (project) {
    projectStore.setCurrentProject(project)
  }

  // 添加键盘事件监听
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
})

// 键盘事件处理 - 方向键选择节点
function handleKeyDown(event: KeyboardEvent) {
  // 如果正在输入框中输入，不处理
  const target = event.target as HTMLElement
  if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') {
    return
  }

  const nodes = projectStore.currentCanvas?.nodes || []
  if (!nodes || nodes.length === 0) return

  // 上/左：上一个节点，下/右：下一个节点
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' ||
      event.key === 'ArrowUp' || event.key === 'ArrowDown') {
    event.preventDefault()

    // 按创建时间排序
    const sortedNodes = [...nodes].sort((a, b) => a.createdAt - b.createdAt)

    const currentActiveId = canvasAreaRef.value?.activeNodeId
    const currentIndex = currentActiveId
      ? sortedNodes.findIndex(n => n.id === currentActiveId)
      : -1

    let newIndex: number
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      newIndex = currentIndex <= 0 ? sortedNodes.length - 1 : currentIndex - 1
    } else {
      newIndex = currentIndex >= sortedNodes.length - 1 ? 0 : currentIndex + 1
    }

    const newActiveNode = sortedNodes[newIndex]
    canvasAreaRef.value?.setActiveNodeId(newActiveNode.id)
  }
}

function goBack() {
  projectStore.cleanupEmptyPages()
  canvasAreaRef.value?.cancelTextEdit()
  router.push('/')
}

function handleResetViewport() {
  canvasAreaRef.value?.handleResetViewport()
}

function handleAutoLayout() {
  canvasAreaRef.value?.handleAutoLayout()
}

function handleToggleAllContext() {
  if (!projectStore.currentProject || !projectStore.currentCanvas) return

  if (isAllContextSelected.value) {
    for (const node of projectStore.currentCanvas.nodes) {
      node.selectedAsContext = false
    }
  } else {
    for (const node of projectStore.currentCanvas.nodes) {
      if (node.transcriptStatus === 'done') {
        node.selectedAsContext = true
      }
    }
  }
  projectStore.saveProject(projectStore.currentProject)
}

function handleInvertSelection() {
  if (!projectStore.currentProject || !projectStore.currentCanvas) return

  for (const node of projectStore.currentCanvas.nodes) {
    if (node.transcriptStatus === 'done') {
      node.selectedAsContext = !node.selectedAsContext
    }
  }
  projectStore.saveProject(projectStore.currentProject)
}

// 静态上下文选择
async function toggleStaticContext(contextId: string) {
  if (!projectStore.currentProject) return

  const currentIds = projectStore.currentProject.context?.staticContextIds || []
  const newIds = currentIds.includes(contextId)
    ? currentIds.filter(id => id !== contextId)
    : [...currentIds, contextId]

  if (!projectStore.currentProject.context) {
    projectStore.currentProject.context = {}
  }

  if (newIds.length > 0) {
    if (!projectStore.currentProject.context.staticContextIds) {
      projectStore.currentProject.context.staticContextIds = []
    }
    projectStore.currentProject.context.staticContextIds.splice(0, projectStore.currentProject.context.staticContextIds.length, ...newIds)
  } else {
    projectStore.currentProject.context.staticContextIds = undefined
  }

  await projectStore.saveProject(projectStore.currentProject)
}

// 动态上下文编辑
function openDynamicContextEditor() {
  if (dynamicContextFile.value) {
    dynamicContextEditContent.value = dynamicContextFile.value.content
  }
  showDynamicContextEditor.value = true
}

function saveDynamicContextEdit() {
  if (dynamicContextFile.value) {
    contextStore.updateContextFile(dynamicContextFile.value.id, {
      content: dynamicContextEditContent.value
    })
  }
  showDynamicContextEditor.value = false
}

// 动态上下文拖拽处理
async function handleDynamicContextDrop(text: string) {
  const project = projectStore.currentProject
  if (!project) return

  if (!project.context?.dynamicContextId) {
    const newContext = await contextStore.createContextFile(
      `${project.name}`,
      'dynamic',
      text,
      project.id
    )

    project.context = {
      ...project.context,
      dynamicContextId: newContext.id
    }
    await projectStore.saveProject(project)
  } else {
    await contextStore.appendToDynamicContext(
      project.context.dynamicContextId,
      text
    )
  }
}
</script>

<style scoped>
.canvas-view {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-secondary);
}

/* 对话框通用样式 */
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

.dynamic-context-editor-dialog {
  min-width: 600px;
  max-width: 800px;
}

.dialog h3 {
  margin-bottom: 16px;
  font-size: 20px;
  color: var(--text-primary);
}

.no-dynamic-context {
  padding: 20px;
  text-align: center;
  color: var(--text-secondary);
}

.no-dynamic-context .hint {
  font-size: 13px;
  margin-top: 8px;
  font-style: italic;
  color: var(--text-secondary);
}

.content-input {
  width: 100%;
  min-height: 300px;
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
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
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
  background: #4299e1;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: white;
}
</style>