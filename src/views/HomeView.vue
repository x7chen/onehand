<template>
  <div class="home-view">
    <div class="header">
      <h1>onehand - 智能语音笔记</h1>
      <button @click="openSettings" class="settings-btn">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
          <path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
        </svg>
        设置
      </button>
    </div>

    <div class="content">
      <!-- 上下文文件管理区域 -->
      <div class="contexts-section">
        <div class="section-header">
          <h2>上下文标签</h2>
          <div class="header-actions">
            <button @click="showNewContextDialog = true" class="new-context-btn">
              + 新建标签
            </button>
          </div>
        </div>

        <div v-if="contextStore.contextFiles.length === 0" class="empty-state">
          <p>暂无上下文标签，创建一个作为项目背景知识或动态积累内容吧！</p>
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
                :style="{ backgroundColor: file.color + '20', borderColor: file.color }"
                @dblclick="editContextFile(file)"
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
                :style="{ backgroundColor: file.color + '20', borderColor: file.color }"
                @dblclick="editContextFile(file)"
              >
                <span class="tag-name" :style="{ color: file.color }">{{ file.name }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 项目列表区域 -->
      <div class="projects-section">
        <div class="section-header">
          <h2>我的项目</h2>
          <button @click="showNewProjectDialog = true" class="new-project-btn">
            + 新建项目
          </button>
        </div>

        <div v-if="projectStore.projects.length === 0" class="empty-state">
          <p>暂无项目，创建一个新项目开始记录吧！</p>
        </div>

        <div v-else class="projects-grid">
          <div
            v-for="project in projectStore.projects"
            :key="project.id"
            class="project-card"
            draggable="true"
            @dragstart="handleProjectDragStart($event, project)"
            @dragend="handleProjectDragEnd"
          >
            <div class="project-card-content" @click="openProject(project.id)">
              <h3>{{ project.name }}</h3>
              <p class="project-info">
                {{ (project.canvases?.[0]?.nodes?.length || project.canvas?.nodes?.length || 0) }} 个笔记 · {{ formatDate(project.updatedAt) }}
                <span v-if="project.context?.staticContextIds?.length || project.context?.dynamicContextId" class="context-indicator">
                  ·
                  <span v-if="project.context.staticContextIds?.length" :title="`静态上下文 (${project.context.staticContextIds.length}个)`">
                    📄{{ project.context.staticContextIds.length > 1 ? `(${project.context.staticContextIds.length})` : '' }}
                  </span>
                  <span v-if="project.context.dynamicContextId" title="动态上下文">📝</span>
                </span>
              </p>
            </div>
            <div class="project-card-actions">
              <button class="chat-btn" @click.stop="openChat(project.id)" title="对话模式">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                  <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- New Context Dialog -->
    <div v-if="showNewContextDialog" class="dialog-overlay" @click="showNewContextDialog = false">
      <div class="dialog" @click.stop>
        <h3>新建上下文文件</h3>
        <input
          v-model="newContextName"
          type="text"
          placeholder="上下文文件名"
          @keyup.enter="createContextFile"
        />
        <div class="form-group">
          <label>类型：</label>
          <select v-model="newContextType">
            <option value="static">静态上下文（固定背景知识、术语表、项目说明等）</option>
            <option value="dynamic">动态上下文（使用过程中动态积累的内容）</option>
          </select>
        </div>
        <div class="dialog-actions">
          <button @click="showNewContextDialog = false" class="cancel-btn">取消</button>
          <button @click="createContextFile" class="confirm-btn">创建</button>
        </div>
      </div>
    </div>

    <!-- Edit Context Dialog -->
    <div v-if="showEditContextDialog && editingContext" class="dialog-overlay" @click="closeEditDialog">
      <div class="dialog edit-dialog" @click.stop>
        <div class="edit-dialog-header">
          <h3>编辑上下文标签</h3>
          <button @click="closeEditDialog" class="close-btn" title="关闭">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>
        
        <div class="edit-form">
          <div class="form-group">
            <label>标签名称：</label>
            <input
              v-model="editingContext.name"
              type="text"
              placeholder="标签名称"
              class="name-input"
            />
          </div>
          
          <div class="form-group">
            <label>标签颜色：</label>
            <div class="color-picker">
              <button
                v-for="color in contextColors"
                :key="color"
                class="color-option"
                :class="{ selected: editingContext.color === color }"
                :style="{ backgroundColor: color }"
                @click="editingContext.color = color"
                :title="color"
              />
            </div>
          </div>
          
          <div class="form-group">
            <label>标签内容：</label>
            <textarea
              v-model="editingContext.content"
              placeholder="上下文内容（Markdown 格式）"
              class="content-input"
            ></textarea>
          </div>
        </div>
        
        <div class="dialog-actions">
          <button @click="confirmDeleteContext(editingContext.id, true)" class="delete-btn">删除</button>
          <div class="dialog-actions-right">
            <button @click="closeEditDialog" class="cancel-btn">取消</button>
            <button @click="saveContextEdit" class="confirm-btn">保存</button>
          </div>
        </div>
      </div>
    </div>

    <!-- New Project Dialog -->
    <div v-if="showNewProjectDialog" class="dialog-overlay" @click="showNewProjectDialog = false">
      <div class="dialog" @click.stop>
        <h3>新建项目</h3>
        <input
          v-model="newProjectName"
          type="text"
          placeholder="项目名称"
          @keyup.enter="createProject"
          ref="projectNameInput"
        />
        
        <!-- 选择静态上下文（多选） -->
        <div class="form-group">
          <label>静态上下文（可选，可多选）：</label>
          <div class="checkbox-list">
            <label class="checkbox-item" v-for="file in contextStore.staticContextFiles" :key="file.id">
              <input
                type="checkbox"
                :value="file.id"
                v-model="newProjectStaticContexts"
              />
              <span class="checkbox-label">{{ file.name }}</span>
            </label>
          </div>
        </div>

        <!-- 选择动态上下文 -->
        <div class="form-group">
          <label>动态上下文（可选）：</label>
          <select v-model="newProjectDynamicContext">
            <option value="">无</option>
            <option v-for="file in contextStore.dynamicContextFiles" :key="file.id" :value="file.id">
              {{ file.name }}
            </option>
          </select>
        </div>

        <div class="dialog-actions">
          <button @click="showNewProjectDialog = false" class="cancel-btn">取消</button>
          <button @click="createProject" class="confirm-btn">创建</button>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Dialog -->
    <div v-if="showDeleteConfirm" class="dialog-overlay" @click="showDeleteConfirm = false">
      <div class="dialog confirm-dialog" @click.stop>
        <h3>确认删除</h3>
        <p>确定要删除这个上下文文件吗？此操作不可恢复。</p>
        <div class="dialog-actions">
          <button @click="showDeleteConfirm = false" class="cancel-btn">取消</button>
          <button @click="deleteContextFile" class="delete-btn confirm-delete">删除</button>
        </div>
      </div>
    </div>

    <!-- 垃圾桶区域 -->
    <div
      class="trash-zone"
      :class="{ 'drag-over': isDragOverTrash }"
      @dragover="handleTrashDragOver"
      @dragleave="handleTrashDragLeave"
      @drop="handleTrashDrop"
    >
      <svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor" class="trash-icon">
        <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
      </svg>
      <span class="trash-text">拖拽到此处删除</span>
    </div>

    <!-- 项目删除确认对话框 -->
    <div v-if="showProjectDeleteConfirm" class="dialog-overlay" @click="showProjectDeleteConfirm = false">
      <div class="dialog confirm-dialog" @click.stop>
        <h3>确认删除项目</h3>
        <p>确定要删除项目 "{{ projectToDelete?.name }}" 吗？此操作不可恢复。</p>
        <div class="dialog-actions">
          <button @click="showProjectDeleteConfirm = false" class="cancel-btn">取消</button>
          <button @click="confirmDeleteProject" class="delete-btn confirm-delete">删除</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useProjectStore } from '@/stores/projectStore'
import { useContextStore } from '@/stores/contextStore'
import type { ContextFile, ContextType } from '@/types/context'
import { CONTEXT_COLORS } from '@/types/context'
import type { Project } from '@/types/project'

const router = useRouter()
const projectStore = useProjectStore()
const contextStore = useContextStore()

const contextColors = computed(() => CONTEXT_COLORS)

const showNewContextDialog = ref(false)
const newContextName = ref('')
const newContextType = ref<ContextType>('static')

const showEditContextDialog = ref(false)
const editingContext = ref<ContextFile | undefined>(undefined)

const showNewProjectDialog = ref(false)
const newProjectName = ref('')
const newProjectStaticContexts = ref<string[]>([])
const newProjectDynamicContext = ref('')
const projectNameInput = ref<HTMLInputElement | null>(null)

const showDeleteConfirm = ref(false)
const contextToDelete = ref<string | null>(null)
const shouldCloseEditDialogAfterDelete = ref(false)

// 拖拽删除相关
const isDragOverTrash = ref(false)
const draggedProject = ref<Project | null>(null)
const showProjectDeleteConfirm = ref(false)
const projectToDelete = ref<Project | null>(null)

onMounted(() => {
  projectStore.loadProjects()
  contextStore.loadContextFiles()
})

function formatDate(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`

  return date.toLocaleDateString('zh-CN')
}

// Context file management
async function createContextFile() {
  if (!newContextName.value.trim()) return

  const newFile = await contextStore.createContextFile(
    newContextName.value.trim(),
    newContextType.value
  )

  showNewContextDialog.value = false
  newContextName.value = ''
  newContextType.value = 'static'
  
  // 新建后自动进入编辑对话框
  editingContext.value = { ...newFile }
  showEditContextDialog.value = true
}

function editContextFile(file: ContextFile) {
  editingContext.value = { ...file }
  showEditContextDialog.value = true
}

function closeEditDialog() {
  showEditContextDialog.value = false
  editingContext.value = undefined
}

async function saveContextEdit() {
  if (!editingContext.value) return

  await contextStore.updateContextFile(editingContext.value.id, {
    name: editingContext.value.name,
    color: editingContext.value.color,
    content: editingContext.value.content
  })

  closeEditDialog()
}

function confirmDeleteContext(contextId: string, fromEditDialog = false) {
  contextToDelete.value = contextId
  shouldCloseEditDialogAfterDelete.value = fromEditDialog
  showDeleteConfirm.value = true
}

async function deleteContextFile() {
  if (!contextToDelete.value) return

  await contextStore.deleteContextFile(contextToDelete.value)
  showDeleteConfirm.value = false
  contextToDelete.value = null
  
  // 如果是从编辑对话框删除的，关闭编辑对话框
  if (shouldCloseEditDialogAfterDelete.value) {
    shouldCloseEditDialogAfterDelete.value = false
    closeEditDialog()
  }
}

// Project management
async function createProject() {
  if (!newProjectName.value.trim()) return

  const context = {
    staticContextIds: newProjectStaticContexts.value.length > 0 ? newProjectStaticContexts.value : undefined,
    dynamicContextId: newProjectDynamicContext.value || undefined
  }

  const project = await projectStore.createProject(
    newProjectName.value,
    (context.staticContextIds || context.dynamicContextId) ? context : undefined
  )

  showNewProjectDialog.value = false
  newProjectName.value = ''
  newProjectStaticContexts.value = []
  newProjectDynamicContext.value = ''
  openProject(project.id)
}

function openProject(projectId: string) {
  const project = projectStore.projects.find(p => p.id === projectId)
  if (project) {
    projectStore.setCurrentProject(project)
    router.push(`/canvas/${projectId}`)
  }
}

function openChat(projectId: string) {
  const project = projectStore.projects.find(p => p.id === projectId)
  if (project) {
    projectStore.setCurrentProject(project)
    router.push(`/chat/${projectId}`)
  }
}

function openSettings() {
  router.push('/settings')
}

// 项目拖拽删除功能
function handleProjectDragStart(e: DragEvent, project: Project) {
  draggedProject.value = project
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', project.id)
    // 设置拖拽时的半透明效果
    const target = e.target as HTMLElement
    target.style.opacity = '0.5'
  }
}

function handleProjectDragEnd(e: DragEvent) {
  const target = e.target as HTMLElement
  target.style.opacity = '1'
  draggedProject.value = null
  isDragOverTrash.value = false
}

function handleTrashDragOver(e: DragEvent) {
  e.preventDefault()
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'move'
  }
  isDragOverTrash.value = true
}

function handleTrashDragLeave() {
  isDragOverTrash.value = false
}

function handleTrashDrop(e: DragEvent) {
  e.preventDefault()
  isDragOverTrash.value = false

  const projectId = e.dataTransfer?.getData('text/plain')
  if (projectId && draggedProject.value) {
    projectToDelete.value = draggedProject.value
    showProjectDeleteConfirm.value = true
  }
}

async function confirmDeleteProject() {
  if (projectToDelete.value) {
    await projectStore.deleteProject(projectToDelete.value.id)
    showProjectDeleteConfirm.value = false
    projectToDelete.value = null
  }
}
</script>

<style scoped>
.home-view {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-secondary);
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 12px;
  background: var(--bg-primary);
  box-shadow: 0 2px 4px var(--shadow-color);
}

.header h1 {
  font-size: 24px;
  color: var(--text-primary);
}

.settings-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: var(--bg-secondary);
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: var(--text-secondary);
  transition: background 0.2s;
}

.settings-btn:hover {
  background: var(--border-color);
}

.content {
  flex: 1;
  padding: 40px;
  overflow-y: auto;
}

.contexts-section,
.projects-section {
  max-width: 1200px;
  margin: 0 auto 40px;
  width: 100%;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.section-header h2 {
  font-size: 20px;
  color: var(--text-primary);
}

.header-actions {
  display: flex;
  gap: 12px;
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

.new-project-btn {
  padding: 10px 20px;
  background: #4299e1;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: white;
  font-weight: 500;
  transition: background 0.2s;
}

.new-project-btn:hover {
  background: #3182ce;
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

.projects-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}

.project-card {
  background: var(--bg-primary);
  padding: 20px;
  border-radius: 12px;
  box-shadow: 0 2px 8px var(--shadow-color);
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  display: flex;
  align-items: center;
  gap: 12px;
}

.project-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px var(--shadow-color);
}

.project-card-content {
  flex: 1;
  min-width: 0;
}

.project-card-actions {
  flex-shrink: 0;
  display: flex;
  gap: 8px;
}

.chat-btn {
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 8px;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.chat-btn:hover {
  background: #4299e1;
  color: white;
}

.project-card h3 {
  font-size: 18px;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.project-info {
  font-size: 14px;
  color: var(--text-secondary);
}

.context-indicator {
  margin-left: 4px;
}

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

.edit-dialog {
  min-width: 600px;
  max-width: 800px;
}

.edit-dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.edit-dialog-header h3 {
  margin: 0;
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  color: var(--text-secondary);
  transition: background 0.2s;
}

.close-btn:hover {
  background: var(--border-color);
}

.edit-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
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

.confirm-dialog {
  min-width: 350px;
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

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  color: var(--text-secondary);
}

.form-group select {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 14px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  cursor: pointer;
}

.checkbox-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-secondary);
  max-height: 200px;
  overflow-y: auto;
}

.checkbox-item {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background 0.2s;
}

.checkbox-item:hover {
  background: var(--border-color);
}

.checkbox-item input[type="checkbox"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.checkbox-label {
  font-size: 14px;
  color: var(--text-primary);
  cursor: pointer;
  flex: 1;
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

.name-input {
  margin-bottom: 12px !important;
}

.dialog-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 20px;
}

.dialog-actions-right {
  display: flex;
  gap: 12px;
}

.delete-btn {
  padding: 8px 16px;
  background: rgba(255, 68, 68, 0.1);
  border: 1px solid rgba(255, 68, 68, 0.3);
  border-radius: 6px;
  cursor: pointer;
  color: #f44;
  transition: all 0.2s;
}

.delete-btn:hover {
  background: rgba(255, 68, 68, 0.2);
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

.confirm-delete {
  background: #f44;
  border: none;
}

.confirm-delete:hover {
  background: #d32f2f;
}

/* 垃圾桶区域样式 */
.trash-zone {
  position: fixed;
  left: 24px;
  bottom: 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 16px 24px;
  background: var(--bg-primary);
  border: 2px dashed var(--border-color);
  border-radius: 12px;
  color: var(--text-secondary);
  transition: all 0.3s ease;
  z-index: 100;
  cursor: pointer;
  box-shadow: 0 2px 8px var(--shadow-color);
}

.trash-zone:hover {
  border-color: #f44;
  color: #f44;
  transform: scale(1.05);
}

.trash-zone.drag-over {
  border-color: #f44;
  background: rgba(255, 68, 68, 0.1);
  color: #f44;
  transform: scale(1.1);
}

.trash-icon {
  transition: transform 0.3s ease;
}

.trash-zone.drag-over .trash-icon {
  transform: rotate(-15deg) scale(1.1);
}

.trash-text {
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}

/* 拖拽时的项目卡片样式 */
.project-card {
  cursor: grab;
  user-select: none;
}

.project-card:active {
  cursor: grabbing;
}

.project-card[draggable="true"] {
  -webkit-user-drag: element;
}
</style>
