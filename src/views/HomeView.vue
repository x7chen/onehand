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
            </p>
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
        <div class="dialog-actions">
          <button @click="showNewProjectDialog = false" class="cancel-btn">取消</button>
          <button @click="createProject" class="confirm-btn">创建</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useProjectStore } from '@/stores/projectStore'

const router = useRouter()
const projectStore = useProjectStore()

const showNewProjectDialog = ref(false)
const newProjectName = ref('')
const projectNameInput = ref<HTMLInputElement | null>(null)

onMounted(() => {
  projectStore.loadProjects()
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

async function createProject() {
  if (!newProjectName.value.trim()) return
  
  const project = await projectStore.createProject(newProjectName.value)
  showNewProjectDialog.value = false
  newProjectName.value = ''
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

.projects-section {
  max-width: 1200px;
  margin: 0 auto;
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

.dialog input {
  width: 100%;
  padding: 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 14px;
  margin-bottom: 16px;
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
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
