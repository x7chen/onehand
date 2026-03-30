<template>
  <div class="settings-panel">
    <div class="panel-header">
      <h2>设置</h2>
    </div>

    <div class="settings-content">
      <!-- LLM Settings -->
      <section class="settings-section">
        <h3>大模型配置</h3>

        <div class="form-group">
          <label>服务提供商</label>
          <select v-model="settingsStore.settings.llm.provider">
            <option value="custom">OpenAI兼容API</option>
          </select>
        </div>

        <div class="form-group">
          <label>API Key</label>
          <input
            v-model="settingsStore.settings.llm.apiKey"
            type="password"
            placeholder="输入 API Key"
          />
        </div>

        <div class="form-group">
          <label>Base URL</label>
          <input
            v-model="settingsStore.settings.llm.baseUrl"
            type="text"
            placeholder="API 基础地址"
          />
        </div>

        <div class="form-group">
          <label>模型</label>
          <input
            v-model="settingsStore.settings.llm.model"
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
import { watch, onMounted } from 'vue'
import { useSettingsStore } from '@/stores/settingsStore'

const settingsStore = useSettingsStore()

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