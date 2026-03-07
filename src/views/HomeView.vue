<template>
  <div class="home-view">
    <div class="header">
      <h1>Handbook - 智能语音笔记</h1>
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
          <h2>上下文文件</h2>
          <div class="header-actions">
            <button @click="showNewContextDialog = true" class="new-context-btn">
              + 新建上下文
            </button>
          </div>
        </div>

        <div v-if="contextStore.contextFiles.length === 0" class="empty-state">
          <p>暂无上下文文件，创建一个作为项目背景知识或动态积累内容吧！</p>
        </div>

        <div v-else class="contexts-grid">
          <!-- 静态上下文 -->
          <div v-if="contextStore.staticContextFiles.length > 0" class="context-category">
            <h3>静态上下文</h3>
            <div class="context-cards">
              <div
                v-for="file in contextStore.staticContextFiles"
                :key="file.id"
                class="context-card static"
              >
                <div class="context-card-header">
                  <span class="context-type-badge static">静态</span>
                  <h4>{{ file.name }}</h4>
                </div>
                <p class="context-preview">{{ file.content.slice(0, 100) }}{{ file.content.length > 100 ? '...' : '' }}</p>
                <div class="context-card-actions">
                  <button @click="editContextFile(file)" class="edit-btn">编辑</button>
                  <button @click="confirmDeleteContext(file.id)" class="delete-btn">删除</button>
                </div>
              </div>
            </div>
          </div>

          <!-- 动态上下文 -->
          <div v-if="contextStore.dynamicContextFiles.length > 0" class="context-category">
            <h3>动态上下文</h3>
            <div class="context-cards">
              <div
                v-for="file in contextStore.dynamicContextFiles"
                :key="file.id"
                class="context-card dynamic"
              >
                <div class="context-card-header">
                  <span class="context-type-badge dynamic">动态</span>
                  <h4>{{ file.name }}</h4>
                </div>
                <p class="context-preview">{{ file.content.slice(0, 100) }}{{ file.content.length > 100 ? '...' : '' }}</p>
                <div class="context-card-actions">
                  <button @click="editContextFile(file)" class="edit-btn">编辑</button>
                  <button @click="confirmDeleteContext(file.id)" class="delete-btn">删除</button>
                </div>
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
            @click="openProject(project.id)"
          >
            <h3>{{ project.name }}</h3>
            <p class="project-info">
              {{ project.canvas.nodes.length }} 个笔记 · {{ formatDate(project.updatedAt) }}
              <span v-if="project.context?.staticContextId || project.context?.dynamicContextId" class="context-indicator">
                · 
                <span v-if="project.context.staticContextId" title="静态上下文">📄</span>
                <span v-if="project.context.dynamicContextId" title="动态上下文">📝</span>
              </span>
            </p>
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
    <div v-if="showEditContextDialog" class="dialog-overlay" @click="closeEditDialog">
      <div class="dialog edit-dialog" @click.stop>
        <h3>编辑上下文文件</h3>
        <input
          v-model="editingContext.name"
          type="text"
          placeholder="文件名"
          class="name-input"
        />
        <textarea
          v-model="editingContext.content"
          placeholder="上下文内容（Markdown 格式）"
          class="content-input"
        ></textarea>
        <div class="dialog-actions">
          <button @click="closeEditDialog" class="cancel-btn">取消</button>
          <button @click="saveContextEdit" class="confirm-btn">保存</button>
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
        
        <!-- 选择静态上下文 -->
        <div class="form-group">
          <label>静态上下文（可选）：</label>
          <select v-model="newProjectStaticContext">
            <option value="">无</option>
            <option v-for="file in contextStore.staticContextFiles" :key="file.id" :value="file.id">
              {{ file.name }}
            </option>
          </select>
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
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useProjectStore } from '@/stores/projectStore'
import { useContextStore } from '@/stores/contextStore'
import type { ContextFile, ContextType } from '@/types/context'

const router = useRouter()
const projectStore = useProjectStore()
const contextStore = useContextStore()

const showNewContextDialog = ref(false)
const newContextName = ref('')
const newContextType = ref<ContextType>('static')

const showEditContextDialog = ref(false)
const editingContext = ref<ContextFile | null>(null)

const showNewProjectDialog = ref(false)
const newProjectName = ref('')
const newProjectStaticContext = ref('')
const newProjectDynamicContext = ref('')
const projectNameInput = ref<HTMLInputElement | null>(null)

const showDeleteConfirm = ref(false)
const contextToDelete = ref<string | null>(null)

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

  await contextStore.createContextFile(
    newContextName.value.trim(),
    newContextType.value
  )
  
  showNewContextDialog.value = false
  newContextName.value = ''
  newContextType.value = 'static'
}

function editContextFile(file: ContextFile) {
  editingContext.value = { ...file }
  showEditContextDialog.value = true
}

function closeEditDialog() {
  showEditContextDialog.value = false
  editingContext.value = null
}

async function saveContextEdit() {
  if (!editingContext.value) return
  
  await contextStore.updateContextFile(editingContext.value.id, {
    name: editingContext.value.name,
    content: editingContext.value.content
  })
  
  closeEditDialog()
}

function confirmDeleteContext(contextId: string) {
  contextToDelete.value = contextId
  showDeleteConfirm.value = true
}

async function deleteContextFile() {
  if (!contextToDelete.value) return
  
  await contextStore.deleteContextFile(contextToDelete.value)
  showDeleteConfirm.value = false
  contextToDelete.value = null
}

// Project management
async function createProject() {
  if (!newProjectName.value.trim()) return

  const context = {
    staticContextId: newProjectStaticContext.value || undefined,
    dynamicContextId: newProjectDynamicContext.value || undefined
  }

  const project = await projectStore.createProject(
    newProjectName.value,
    (context.staticContextId || context.dynamicContextId) ? context : undefined
  )

  showNewProjectDialog.value = false
  newProjectName.value = ''
  newProjectStaticContext.value = ''
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

function openSettings() {
  router.push('/settings')
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

.contexts-grid {
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

.context-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

.context-card {
  background: var(--bg-primary);
  padding: 16px;
  border-radius: 12px;
  box-shadow: 0 2px 8px var(--shadow-color);
  transition: transform 0.2s, box-shadow 0.2s;
  border-left: 4px solid transparent;
}

.context-card.static {
  border-left-color: #66bb6a;
}

.context-card.dynamic {
  border-left-color: #4299e1;
}

.context-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px var(--shadow-color);
}

.context-card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.context-type-badge {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.context-type-badge.static {
  background: rgba(102, 187, 106, 0.2);
  color: #66bb6a;
}

.context-type-badge.dynamic {
  background: rgba(66, 153, 225, 0.2);
  color: #4299e1;
}

.context-card h4 {
  font-size: 16px;
  color: var(--text-primary);
  margin: 0;
  flex: 1;
}

.context-preview {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 12px;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.context-card-actions {
  display: flex;
  gap: 8px;
}

.edit-btn {
  flex: 1;
  padding: 6px 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  cursor: pointer;
  color: var(--text-secondary);
  transition: all 0.2s;
}

.edit-btn:hover {
  background: var(--border-color);
  color: var(--text-primary);
}

.delete-btn {
  flex: 1;
  padding: 6px 12px;
  background: rgba(255, 68, 68, 0.1);
  border: 1px solid rgba(255, 68, 68, 0.3);
  border-radius: 4px;
  cursor: pointer;
  color: #f44;
  transition: all 0.2s;
}

.delete-btn:hover {
  background: rgba(255, 68, 68, 0.2);
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
}

.project-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px var(--shadow-color);
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

.confirm-delete {
  background: #f44;
  border: none;
}

.confirm-delete:hover {
  background: #d32f2f;
}
</style>
