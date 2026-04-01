<template>
  <div class="settings-panel">
    <div class="panel-header">
      <h2>设置</h2>
    </div>

    <div class="settings-content">
      <!-- LLM Settings -->
      <section class="settings-section">
        <h3>大模型配置</h3>

        <!-- Profile Tabs -->
        <div class="profile-tabs">
          <div
            v-for="profile in settingsStore.settings.llm.profiles"
            :key="profile.id"
            class="profile-tab"
            :class="{ active: profile.id === settingsStore.settings.llm.activeProfileId }"
            @click="settingsStore.switchProfile(profile.id)"
          >
            <span
              class="tab-name"
              @dblclick="startRename(profile.id)"
            >
              {{ profile.name }}
            </span>
            <input
              v-if="renamingProfileId === profile.id"
              v-model="renameValue"
              class="rename-input"
              ref="renameInput"
              @blur="finishRename"
              @keyup.enter="finishRename"
              @keyup.escape="cancelRename"
            />
            <button
              v-if="settingsStore.settings.llm.profiles.length > 1"
              class="tab-close"
              @click.stop="settingsStore.removeProfile(profile.id)"
              title="删除配置"
            >
              ×
            </button>
          </div>
          <button
            class="profile-tab add-tab"
            @click="settingsStore.addProfile()"
            title="添加配置"
          >
            +
          </button>
        </div>

        <div class="form-group">
          <label>服务提供商</label>
          <select v-model="settingsStore.settings.llm.provider">
            <option value="custom">OpenAI兼容API</option>
          </select>
        </div>

        <div class="form-group">
          <label>API Key</label>
          <div class="password-input-wrapper">
            <input
              :value="settingsStore.activeProfile?.apiKey || ''"
              @input="settingsStore.updateActiveProfileField('apiKey', ($event.target as HTMLInputElement).value)"
              :type="showApiKey ? 'text' : 'password'"
              placeholder="输入 API Key"
            />
            <button
              type="button"
              class="password-toggle-btn"
              @click="showApiKey = !showApiKey"
              :title="showApiKey ? '隐藏' : '显示'"
            >
              <svg v-if="showApiKey" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/>
              </svg>
              <svg v-else viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
              </svg>
            </button>
          </div>
        </div>

        <div class="form-group">
          <label>Base URL</label>
          <input
            :value="settingsStore.activeProfile?.baseUrl || ''"
            @input="settingsStore.updateActiveProfileField('baseUrl', ($event.target as HTMLInputElement).value)"
            type="text"
            placeholder="API 基础地址"
          />
        </div>

        <div class="form-group">
          <label>模型</label>
          <input
            :value="settingsStore.activeProfile?.model || ''"
            @input="settingsStore.updateActiveProfileField('model', ($event.target as HTMLInputElement).value)"
            type="text"
            placeholder="模型名称"
          />
        </div>
      </section>

      <!-- General Settings -->
      <section class="settings-section">
        <h3>其他设置</h3>

        <div class="form-group">
          <label>界面语言</label>
          <select v-model="settingsStore.settings.general.language">
            <option value="system">跟随系统</option>
            <option value="zh">中文</option>
            <option value="en">English</option>
          </select>
        </div>

        <div class="form-group">
          <label>深浅色模式</label>
          <select v-model="settingsStore.settings.general.theme">
            <option value="system">跟随系统</option>
            <option value="light">浅色</option>
            <option value="dark">深色</option>
          </select>
        </div>

        <div class="form-group">
          <label>颜色主题</label>
          <div class="theme-selector">
            <select v-model="settingsStore.settings.general.colorTheme" class="theme-select">
              <option value="default">默认（蓝色）</option>
              <option value="green">绿色</option>
              <option value="purple">紫色</option>
              <option value="orange">橙色</option>
              <option value="red">红色</option>
              <option value="custom">自定义...</option>
            </select>
            <div class="theme-preview" :style="{ backgroundColor: 'var(--color-primary)' }"></div>
          </div>
        </div>

        <div v-if="settingsStore.settings.general.colorTheme === 'custom'" class="form-group">
          <label>自定义主题文件</label>
          <div class="custom-theme-row">
            <input
              :value="settingsStore.settings.general.customThemePath || ''"
              type="text"
              placeholder="选择CSS文件..."
              readonly
              class="custom-theme-path"
            />
            <button class="select-theme-btn" @click="selectCustomThemeFile">
              选择文件
            </button>
          </div>
          <p class="theme-hint">CSS文件应定义 :root 变量，如 --color-primary、--color-success 等</p>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch, onMounted } from 'vue'
import { useSettingsStore } from '@/stores/settingsStore'

const settingsStore = useSettingsStore()

const renamingProfileId = ref<string | null>(null)
const renameValue = ref('')
const renameInput = ref<HTMLInputElement | null>(null)
const showApiKey = ref(false)

onMounted(async () => {
  if (!settingsStore.isLoaded) {
    await settingsStore.loadSettings()
  }
})

watch(
  () => settingsStore.settings,
  () => {
    if (settingsStore.isLoaded) {
      settingsStore.saveSettings()
    }
  },
  { deep: true }
)

function startRename(profileId: string) {
  const profile = settingsStore.settings.llm.profiles.find(p => p.id === profileId)
  if (profile) {
    renamingProfileId.value = profileId
    renameValue.value = profile.name
    nextTick(() => {
      renameInput.value?.focus()
      renameInput.value?.select()
    })
  }
}

function finishRename() {
  if (renamingProfileId.value && renameValue.value.trim()) {
    settingsStore.updateProfileName(renamingProfileId.value, renameValue.value.trim())
  }
  renamingProfileId.value = null
  renameValue.value = ''
}

function cancelRename() {
  renamingProfileId.value = null
  renameValue.value = ''
}

// 选择自定义主题文件
async function selectCustomThemeFile() {
  const result = await window.electronAPI.showOpenDialog({
    filters: [{ name: 'CSS文件', extensions: ['css'] }],
    properties: ['openFile']
  })

  if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
    settingsStore.updateSettings({
      general: {
        ...settingsStore.settings.general,
        customThemePath: result.filePaths[0]
      }
    })
  }
}
</script>

<style scoped>
.settings-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.panel-header {
  padding: 24px;
  border-bottom: 1px solid var(--border-color);
}

.panel-header h2 {
  margin: 0;
  font-size: 20px;
  color: var(--text-primary);
}

.settings-content {
  flex: 1;
  padding: 24px;
  overflow-y: auto;
}

.settings-section {
  background: var(--bg-primary);
  padding: 24px;
  border-radius: 12px;
  margin-bottom: 24px;
  box-shadow: 0 2px 8px var(--shadow-color);
}

.settings-section h3 {
  font-size: 18px;
  color: var(--text-primary);
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-color);
}

.profile-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 20px;
}

.profile-tab {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
}

.profile-tab:hover {
  background: var(--bg-hover);
}

.profile-tab.active {
  background: var(--accent-color);
  border-color: var(--accent-color);
  color: white;
}

.tab-name {
  font-size: 14px;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rename-input {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  padding: 8px 12px;
  border: 2px solid var(--accent-color);
  border-radius: 6px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 14px;
  box-sizing: border-box;
  z-index: 1;
}

.tab-close {
  margin-left: 8px;
  width: 16px;
  height: 16px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  padding: 0;
  border-radius: 50%;
}

.tab-close:hover {
  background: rgba(255, 255, 255, 0.2);
  color: white;
}

.profile-tab.active .tab-close:hover {
  background: rgba(255, 255, 255, 0.3);
}

.add-tab {
  min-width: 36px;
  justify-content: center;
  font-size: 16px;
  font-weight: bold;
  color: var(--text-secondary);
}

.add-tab:hover {
  color: var(--accent-color);
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.form-group input[type="text"],
.form-group input[type="password"],
.form-group input[type="number"],
.form-group select {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 14px;
  transition: border-color 0.2s;
  background: var(--bg-secondary);
  color: var(--text-primary);
  box-sizing: border-box;
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: var(--color-primary);
}

/* 主题选择样式 */
.theme-selector {
  display: flex;
  align-items: center;
  gap: 12px;
}

.theme-select {
  flex: 1;
}

.theme-preview {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  border: 2px solid var(--border-color);
  flex-shrink: 0;
}

.custom-theme-row {
  display: flex;
  gap: 8px;
}

.custom-theme-path {
  flex: 1;
  background: var(--bg-secondary);
}

.select-theme-btn {
  padding: 10px 16px;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;
}

.select-theme-btn:hover {
  background: var(--color-primary-hover);
}

.theme-hint {
  margin-top: 8px;
  font-size: 12px;
  color: var(--text-secondary);
}

.password-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.password-input-wrapper input {
  flex: 1;
  padding-right: 40px;
}

.password-toggle-btn {
  position: absolute;
  right: 8px;
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 4px 8px;
  font-size: 14px;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.password-toggle-btn:hover {
  opacity: 1;
}
</style>