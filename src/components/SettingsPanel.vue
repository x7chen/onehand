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
          <input
            :value="settingsStore.activeProfile?.apiKey || ''"
            @input="settingsStore.updateActiveProfileField('apiKey', ($event.target as HTMLInputElement).value)"
            type="password"
            placeholder="输入 API Key"
          />
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
          <label>主题</label>
          <select v-model="settingsStore.settings.general.theme">
            <option value="system">跟随系统</option>
            <option value="light">浅色</option>
            <option value="dark">深色</option>
          </select>
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
  border-color: #4299e1;
}
</style>