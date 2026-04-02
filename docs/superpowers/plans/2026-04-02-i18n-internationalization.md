# 国际化支持 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为应用添加中英文国际化支持，用户可在设置中切换语言，界面立即响应更新。

**Architecture:** 使用 vue-i18n 作为国际化框架，翻译文件内置在应用中。创建 i18n 配置模块监听 settingsStore 语言变化，动态切换 locale。所有组件硬编码文本替换为 `$t()` 调用。

**Tech Stack:** vue-i18n, Pinia (settingsStore), Electron IPC (系统语言检测)

---

## File Structure

| 文件 | 责任 |
|------|------|
| `src/i18n/index.ts` | i18n 实例创建、语言切换监听、系统语言检测 |
| `src/locales/zh.ts` | 中文翻译字典 |
| `src/locales/en.ts` | 英文翻译字典 |
| `src/main.ts` | 注册 i18n 插件 |
| `electron/main.js` | 添加 getLocale IPC handler |
| `electron/preload.js` | 添加 getLocale API |
| `src/vite-env.d.ts` | 添加 getLocale 类型声明 |
| `src/components/*.vue` | 替换硬编码文本 |
| `src/views/*.vue` | 替换硬编码文本 |

---

### Task 1: 安装 vue-i18n 依赖

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 安装 vue-i18n**

```bash
npm install vue-i18n
```

- [ ] **Step 2: 验证安装成功**

检查 package.json dependencies 中包含 vue-i18n。

---

### Task 2: 创建翻译文件

**Files:**
- Create: `src/locales/zh.ts`
- Create: `src/locales/en.ts`

- [ ] **Step 1: 创建目录结构**

```bash
mkdir -p src/locales
```

- [ ] **Step 2: 创建中文翻译文件 `src/locales/zh.ts`**

```typescript
export default {
  common: {
    search: '搜索',
    cancel: '取消',
    save: '保存',
    delete: '删除',
    create: '创建',
    confirm: '确认',
    browse: '浏览',
    close: '关闭',
    minimize: '最小化',
    maximize: '最大化',
    restore: '恢复',
    loading: '加载中...',
    noData: '暂无数据',
    irreversible: '此操作不可恢复',
  },
  nav: {
    notebooks: '笔记本',
    contexts: '上下文',
    favorites: '收藏夹',
    settings: '设置',
    trash: '回收站',
  },
  settings: {
    title: '设置',
    llmConfig: '大模型配置',
    provider: '服务提供商',
    apiKey: 'API Key',
    apiKeyPlaceholder: '输入 API Key',
    baseUrl: 'Base URL',
    baseUrlPlaceholder: 'API 基础地址',
    model: '模型',
    modelPlaceholder: '模型名称',
    modelProfile: '模型',
    addProfile: '添加配置',
    generalSettings: '其他设置',
    language: '界面语言',
    languageSystem: '跟随系统',
    languageZh: '中文',
    languageEn: 'English',
    theme: '深浅色模式',
    themeSystem: '跟随系统',
    themeLight: '浅色',
    themeDark: '深色',
    colorTheme: '颜色主题',
    colorThemeDefault: '默认（蓝色）',
    colorThemeGreen: '绿色',
    colorThemePurple: '紫色',
    colorThemeOrange: '橙色',
    colorThemeRed: '红色',
    colorThemeCustom: '自定义',
    customThemeFile: '自定义主题文件',
    customThemePlaceholder: '选择CSS文件...',
    customThemeHint: 'CSS文件应定义 :root 变量，如 --color-primary、--color-success 等',
    selectFile: '选择文件',
    show: '显示',
    hide: '隐藏',
    profileCopy: '副本',
  },
  notebook: {
    newNotebook: '新建笔记本',
    notebookName: '笔记本名称',
    notebookNamePlaceholder: '输入笔记本名称',
    pdfFile: 'PDF 文件（可选）',
    pdfFilePlaceholder: '选择 PDF 文件...',
    noPdf: '不使用 PDF',
    staticContext: '静态上下文（可选，可多选）',
    dynamicContext: '动态上下文（可选）',
    noStaticContext: '暂无静态上下文，请先创建',
    deleteConfirmTitle: '确认删除笔记本',
    deleteConfirmMessage: '确定要删除笔记本 "{name}" 吗？此操作不可恢复。',
  },
  context: {
    static: '静态上下文',
    dynamic: '动态上下文',
    newContext: '新建上下文文件',
    contextType: '类型：',
    staticDesc: '静态上下文（固定背景知识、术语表、笔记本说明等）',
    dynamicDesc: '动态上下文（使用过程中动态积累的内容）',
    editTag: '编辑上下文标签',
    tagName: '标签名称：',
    tagColor: '标签颜色：',
    tagContent: '标签内容：',
    noDynamicContext: '当前笔记未关联动态上下文文件。',
    createHint: '拖拽文字到 Header 右侧区域可自动创建。',
    deleteConfirmTitle: '确认删除',
    deleteConfirmMessage: '确定要删除这个上下文文件吗？此操作不可恢复。',
  },
  canvas: {
    clickToView: '点击左侧笔记查看详情',
    pdfNotFound: '未找到 PDF 文件',
  },
  voiceNote: {
    recording: '录音中',
    transcribing: '转写中',
    processing: '处理中',
    retryTranscribe: '重新转写',
    retryProcess: '重新处理',
    transcriptEmpty: '转写结果为空',
    duration: '时长',
  },
  title: {
    appTitle: 'OneHand',
  },
}
```

- [ ] **Step 3: 创建英文翻译文件 `src/locales/en.ts`**

```typescript
export default {
  common: {
    search: 'Search',
    cancel: 'Cancel',
    save: 'Save',
    delete: 'Delete',
    create: 'Create',
    confirm: 'Confirm',
    browse: 'Browse',
    close: 'Close',
    minimize: 'Minimize',
    maximize: 'Maximize',
    restore: 'Restore',
    loading: 'Loading...',
    noData: 'No data',
    irreversible: 'This action cannot be undone',
  },
  nav: {
    notebooks: 'Notebooks',
    contexts: 'Contexts',
    favorites: 'Favorites',
    settings: 'Settings',
    trash: 'Trash',
  },
  settings: {
    title: 'Settings',
    llmConfig: 'LLM Configuration',
    provider: 'Provider',
    apiKey: 'API Key',
    apiKeyPlaceholder: 'Enter API Key',
    baseUrl: 'Base URL',
    baseUrlPlaceholder: 'API base URL',
    model: 'Model',
    modelPlaceholder: 'Model name',
    modelProfile: 'Model',
    addProfile: 'Add Profile',
    generalSettings: 'General Settings',
    language: 'Interface Language',
    languageSystem: 'Follow System',
    languageZh: '中文',
    languageEn: 'English',
    theme: 'Theme Mode',
    themeSystem: 'Follow System',
    themeLight: 'Light',
    themeDark: 'Dark',
    colorTheme: 'Color Theme',
    colorThemeDefault: 'Default (Blue)',
    colorThemeGreen: 'Green',
    colorThemePurple: 'Purple',
    colorThemeOrange: 'Orange',
    colorThemeRed: 'Red',
    colorThemeCustom: 'Custom',
    customThemeFile: 'Custom Theme File',
    customThemePlaceholder: 'Select CSS file...',
    customThemeHint: 'CSS file should define :root variables like --color-primary, --color-success, etc.',
    selectFile: 'Select File',
    show: 'Show',
    hide: 'Hide',
    profileCopy: 'Copy',
  },
  notebook: {
    newNotebook: 'New Notebook',
    notebookName: 'Notebook Name',
    notebookNamePlaceholder: 'Enter notebook name',
    pdfFile: 'PDF File (Optional)',
    pdfFilePlaceholder: 'Select PDF file...',
    noPdf: 'No PDF',
    staticContext: 'Static Context (Optional, Multiple)',
    dynamicContext: 'Dynamic Context (Optional)',
    noStaticContext: 'No static context available, please create first',
    deleteConfirmTitle: 'Confirm Delete Notebook',
    deleteConfirmMessage: 'Are you sure you want to delete notebook "{name}"? This action cannot be undone.',
  },
  context: {
    static: 'Static Context',
    dynamic: 'Dynamic Context',
    newContext: 'New Context File',
    contextType: 'Type:',
    staticDesc: 'Static context (fixed background knowledge, glossary, notebook description, etc.)',
    dynamicDesc: 'Dynamic context (content accumulated during usage)',
    editTag: 'Edit Context Tag',
    tagName: 'Tag Name:',
    tagColor: 'Tag Color:',
    tagContent: 'Tag Content:',
    noDynamicContext: 'Current note has no associated dynamic context file.',
    createHint: 'Drag text to the header right area to auto-create.',
    deleteConfirmTitle: 'Confirm Delete',
    deleteConfirmMessage: 'Are you sure you want to delete this context file? This action cannot be undone.',
  },
  canvas: {
    clickToView: 'Click a note on the left to view details',
    pdfNotFound: 'PDF file not found',
  },
  voiceNote: {
    recording: 'Recording',
    transcribing: 'Transcribing',
    processing: 'Processing',
    retryTranscribe: 'Retry Transcribe',
    retryProcess: 'Retry Process',
    transcriptEmpty: 'Transcript is empty',
    duration: 'Duration',
  },
  title: {
    appTitle: 'OneHand',
  },
}
```

---

### Task 3: 创建 i18n 配置模块

**Files:**
- Create: `src/i18n/index.ts`

- [ ] **Step 1: 创建目录**

```bash
mkdir -p src/i18n
```

- [ ] **Step 2: 创建 i18n 配置文件 `src/i18n/index.ts`**

```typescript
import { createI18n } from 'vue-i18n'
import zh from '@/locales/zh'
import en from '@/locales/en'

// 语言映射
const messages = {
  zh,
  en,
}

// 获取系统语言
async function getSystemLocale(): Promise<string> {
  try {
    if (window.electronAPI?.getSystemLocale) {
      const locale = await window.electronAPI.getSystemLocale()
      // zh-CN, zh-TW, zh-HK -> zh, 其他 -> en
      if (locale.startsWith('zh')) {
        return 'zh'
      }
      return 'en'
    }
  } catch {
    // ignore
  }
  // 默认中文
  return 'zh'
}

// 创建 i18n 实例
const i18n = createI18n({
  legacy: false, // 使用 Composition API 模式
  locale: 'zh',
  fallbackLocale: 'en',
  messages,
})

// 监听 settingsStore 语言变化并切换
export async function initI18n(getLanguage: () => string) {
  const language = getLanguage()

  if (language === 'system') {
    const systemLocale = await getSystemLocale()
    i18n.global.locale.value = systemLocale as 'zh' | 'en'
  } else {
    i18n.global.locale.value = language as 'zh' | 'en'
  }
}

// 切换语言
export async function switchLocale(language: string) {
  if (language === 'system') {
    const systemLocale = await getSystemLocale()
    i18n.global.locale.value = systemLocale as 'zh' | 'en'
  } else {
    i18n.global.locale.value = language as 'zh' | 'en'
  }
}

export default i18n
```

---

### Task 4: 添加 Electron 系统语言 API

**Files:**
- Modify: `electron/main.js`
- Modify: `electron/preload.js`
- Modify: `src/vite-env.d.ts`

- [ ] **Step 1: 在 electron/main.js 添加 getSystemLocale handler**

在文件末尾（约第 610 行后）添加：

```javascript
// 获取系统语言
ipcMain.handle('get-system-locale', () => {
  return app.getLocale()
})
```

- [ ] **Step 2: 在 electron/preload.js 添加 API**

在 `windowIsMaximized` 后添加：

```javascript
// 获取系统语言
getSystemLocale: () => ipcRenderer.invoke('get-system-locale')
```

- [ ] **Step 3: 在 src/vite-env.d.ts 添加类型声明**

在 `ElectronAPI` interface 中添加：

```typescript
// 获取系统语言
getSystemLocale: () => Promise<string>
```

---

### Task 5: 在 main.ts 注册 i18n 并初始化

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: 读取当前 main.ts**

查看现有 import 和 app.use 结构。

- [ ] **Step 2: 添加 i18n 导入和注册**

在 import 区域添加：

```typescript
import i18n, { initI18n } from '@/i18n'
```

在 `app.use(pinia)` 后添加：

```typescript
app.use(i18n)
```

在 `app.mount('#app')` 前添加初始化：

```typescript
// 初始化国际化
import { useSettingsStore } from '@/stores/settingsStore'
const settingsStore = useSettingsStore()
await settingsStore.loadSettings()
await initI18n(() => settingsStore.settings.general.language)
```

- [ ] **Step 3: 验证完整 main.ts 结构**

确保顺序正确：pinia -> i18n -> router -> mount。

---

### Task 6: 在 settingsStore 添加语言切换监听

**Files:**
- Modify: `src/stores/settingsStore.ts`

- [ ] **Step 1: 导入 switchLocale**

在文件顶部添加：

```typescript
import { switchLocale } from '@/i18n'
```

- [ ] **Step 2: 在 updateSettings 函数中触发语言切换**

修改 `updateSettings` 函数，在保存前检查语言变化：

```typescript
function updateSettings(newSettings: Partial<Settings>) {
  const oldLanguage = settings.value.general.language
  settings.value = deepMerge(settings.value, newSettings)

  // 如果语言设置变化，触发 i18n 切换
  if (newSettings.general?.language && newSettings.general.language !== oldLanguage) {
    switchLocale(newSettings.general.language)
  }

  saveSettings()
}
```

---

### Task 7: 修改 TitleBar.vue

**Files:**
- Modify: `src/components/TitleBar.vue`

- [ ] **Step 1: 导入 useI18n**

在 script setup 中添加：

```typescript
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
```

- [ ] **Step 2: 替换按钮 title 属性**

将：
```vue
<button class="control-btn minimize" @click="minimize" title="最小化">
<button class="control-btn maximize" @click="maximize" :title="isMaximized ? '恢复' : '最大化'">
<button class="control-btn close" @click="close" title="关闭">
```

改为：
```vue
<button class="control-btn minimize" @click="minimize" :title="t('common.minimize')">
<button class="control-btn maximize" @click="maximize" :title="isMaximized ? t('common.restore') : t('common.maximize')">
<button class="control-btn close" @click="close" :title="t('common.close')">
```

---

### Task 8: 修改 SettingsPanel.vue

**Files:**
- Modify: `src/components/SettingsPanel.vue`

- [ ] **Step 1: 导入 useI18n**

```typescript
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
```

- [ ] **Step 2: 替换标题和分组标题**

将：
```vue
<h2>设置</h2>
<h3>大模型配置</h3>
<h3>其他设置</h3>
```

改为：
```vue
<h2>{{ t('settings.title') }}</h2>
<h3>{{ t('settings.llmConfig') }}</h3>
<h3>{{ t('settings.generalSettings') }}</h3>
```

- [ ] **Step 3: 替换表单标签**

将：
```vue
<label>服务提供商</label>
<label>API Key</label>
<label>Base URL</label>
<label>模型</label>
<label>界面语言</label>
<label>深浅色模式</label>
<label>颜色主题</label>
<label>自定义主题文件</label>
```

改为：
```vue
<label>{{ t('settings.provider') }}</label>
<label>{{ t('settings.apiKey') }}</label>
<label>{{ t('settings.baseUrl') }}</label>
<label>{{ t('settings.model') }}</label>
<label>{{ t('settings.language') }}</label>
<label>{{ t('settings.theme') }}</label>
<label>{{ t('settings.colorTheme') }}</label>
<label>{{ t('settings.customThemeFile') }}</label>
```

- [ ] **Step 4: 替换 placeholder**

将：
```vue
placeholder="输入 API Key"
placeholder="API 基础地址"
placeholder="模型名称"
placeholder="选择CSS文件..."
```

改为：
```vue
:placeholder="t('settings.apiKeyPlaceholder')"
:placeholder="t('settings.baseUrlPlaceholder')"
:placeholder="t('settings.modelPlaceholder')"
:placeholder="t('settings.customThemePlaceholder')"
```

- [ ] **Step 5: 替换下拉选项**

将：
```vue
<option value="system">跟随系统</option>
<option value="zh">中文</option>
<option value="en">English</option>
<option value="system">跟随系统</option>
<option value="light">浅色</option>
<option value="dark">深色</option>
```

改为：
```vue
<option value="system">{{ t('settings.languageSystem') }}</option>
<option value="zh">{{ t('settings.languageZh') }}</option>
<option value="en">{{ t('settings.languageEn') }}</option>
<option value="system">{{ t('settings.themeSystem') }}</option>
<option value="light">{{ t('settings.themeLight') }}</option>
<option value="dark">{{ t('settings.themeDark') }}</option>
```

- [ ] **Step 6: 替换按钮和提示文本**

将：
```vue
title="添加配置"
:title="showApiKey ? '隐藏' : '显示'"
title="默认（蓝色）"
title="绿色"
title="紫色"
title="橙色"
title="红色"
title="自定义"
选择文件
<p class="theme-hint">CSS文件应定义 :root 变量，如 --color-primary、--color-success 等</p>
```

改为：
```vue
:title="t('settings.addProfile')"
:title="showApiKey ? t('settings.hide') : t('settings.show')"
:title="t('settings.colorThemeDefault')"
:title="t('settings.colorThemeGreen')"
:title="t('settings.colorThemePurple')"
:title="t('settings.colorThemeOrange')"
:title="t('settings.colorThemeRed')"
:title="t('settings.colorThemeCustom')"
{{ t('settings.selectFile') }}
<p class="theme-hint">{{ t('settings.customThemeHint') }}</p>
```

- [ ] **Step 7: 替换 predefinedThemes 的 label**

将：
```typescript
const predefinedThemes: { value: BuiltinTheme; label: string; color: string }[] = [
  { value: 'default', label: '默认（蓝色）', color: '#4299e1' },
  { value: 'green', label: '绿色', color: '#48bb78' },
  { value: 'purple', label: '紫色', color: '#9f7aea' },
  { value: 'orange', label: '橙色', color: '#ed8936' },
  { value: 'red', label: '红色', color: '#e53e3e' }
]
```

改为使用 computed：
```typescript
const predefinedThemes = computed(() => [
  { value: 'default', label: t('settings.colorThemeDefault'), color: '#4299e1' },
  { value: 'green', label: t('settings.colorThemeGreen'), color: '#48bb78' },
  { value: 'purple', label: t('settings.colorThemePurple'), color: '#9f7aea' },
  { value: 'orange', label: t('settings.colorThemeOrange'), color: '#ed8936' },
  { value: 'red', label: t('settings.colorThemeRed'), color: '#e53e3e' }
])
```

---

### Task 9: 修改 HomeView.vue

**Files:**
- Modify: `src/views/HomeView.vue`

- [ ] **Step 1: 导入 useI18n**

```typescript
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
```

- [ ] **Step 2: 替换导航标签**

将：
```vue
<span>搜索</span>
<span>笔记本</span>
<span>上下文</span>
<span>收藏夹</span>
<span>设置</span>
<span>回收站</span>
```

改为：
```vue
<span>{{ t('common.search') }}</span>
<span>{{ t('nav.notebooks') }}</span>
<span>{{ t('nav.contexts') }}</span>
<span>{{ t('nav.favorites') }}</span>
<span>{{ t('nav.settings') }}</span>
<span>{{ t('nav.trash') }}</span>
```

- [ ] **Step 3: 替换新建上下文对话框**

将：
```vue
<h3>新建上下文文件</h3>
<label>类型：</label>
<option value="static">静态上下文（固定背景知识、术语表、笔记本说明等）</option>
<option value="dynamic">动态上下文（使用过程中动态积累的内容）</option>
<button @click="showNewContextDialog = false" class="cancel-btn">取消</button>
<button @click="createContextFile" class="confirm-btn">创建</button>
```

改为：
```vue
<h3>{{ t('context.newContext') }}</h3>
<label>{{ t('context.contextType') }}</label>
<option value="static">{{ t('context.staticDesc') }}</option>
<option value="dynamic">{{ t('context.dynamicDesc') }}</option>
<button @click="showNewContextDialog = false" class="cancel-btn">{{ t('common.cancel') }}</button>
<button @click="createContextFile" class="confirm-btn">{{ t('common.create') }}</button>
```

- [ ] **Step 4: 替换编辑上下文对话框**

将：
```vue
<h3>编辑上下文标签</h3>
<label>标签名称：</label>
<label>标签颜色：</label>
<label>标签内容：</label>
<button @click="confirmDeleteContext(editingContext.id, true)" class="delete-btn">删除</button>
<button @click="closeEditDialog" class="cancel-btn">取消</button>
<button @click="saveContextEdit" class="confirm-btn">保存</button>
```

改为：
```vue
<h3>{{ t('context.editTag') }}</h3>
<label>{{ t('context.tagName') }}</label>
<label>{{ t('context.tagColor') }}</label>
<label>{{ t('context.tagContent') }}</label>
<button @click="confirmDeleteContext(editingContext.id, true)" class="delete-btn">{{ t('common.delete') }}</button>
<button @click="closeEditDialog" class="cancel-btn">{{ t('common.cancel') }}</button>
<button @click="saveContextEdit" class="confirm-btn">{{ t('common.save') }}</button>
```

- [ ] **Step 5: 替换新建笔记本对话框**

将：
```vue
<h3>新建笔记本</h3>
<label>笔记本名称：</label>
placeholder="输入笔记本名称"
<label>PDF 文件（可选）：</label>
placeholder="选择 PDF 文件..."
<button @click="selectPdfFile" class="browse-btn">浏览</button>
<label>静态上下文（可选，可多选）：</label>
<span>暂无静态上下文，请先创建</span>
<label>动态上下文（可选）：</label>
<button @click="showNewNotebookDialog = false" class="cancel-btn">取消</button>
<button @click="createNotebook" class="confirm-btn">创建</button>
```

改为：
```vue
<h3>{{ t('notebook.newNotebook') }}</h3>
<label>{{ t('notebook.notebookName') }}</label>
:placeholder="t('notebook.notebookNamePlaceholder')"
<label>{{ t('notebook.pdfFile') }}</label>
:placeholder="t('notebook.pdfFilePlaceholder')"
<button @click="selectPdfFile" class="browse-btn">{{ t('common.browse') }}</button>
<label>{{ t('notebook.staticContext') }}</label>
<span>{{ t('notebook.noStaticContext') }}</span>
<label>{{ t('notebook.dynamicContext') }}</label>
<button @click="showNewNotebookDialog = false" class="cancel-btn">{{ t('common.cancel') }}</button>
<button @click="createNotebook" class="confirm-btn">{{ t('common.create') }}</button>
```

- [ ] **Step 6: 替换删除确认对话框**

将：
```vue
<h3>确认删除</h3>
<p>确定要删除这个上下文文件吗？此操作不可恢复。</p>
<button @click="showDeleteConfirm = false" class="cancel-btn">取消</button>
<button @click="deleteContextFile" class="delete-btn confirm-delete">删除</button>
<h3>确认删除笔记本</h3>
<p>确定要删除笔记本 "{{ notebookToDelete?.name }}" 吗？此操作不可恢复。</p>
<button @click="showNotebookDeleteConfirm = false" class="cancel-btn">取消</button>
<button @click="confirmDeleteNotebook" class="delete-btn confirm-delete">删除</button>
```

改为：
```vue
<h3>{{ t('context.deleteConfirmTitle') }}</h3>
<p>{{ t('context.deleteConfirmMessage') }}</p>
<button @click="showDeleteConfirm = false" class="cancel-btn">{{ t('common.cancel') }}</button>
<button @click="deleteContextFile" class="delete-btn confirm-delete">{{ t('common.delete') }}</button>
<h3>{{ t('notebook.deleteConfirmTitle') }}</h3>
<p>{{ t('notebook.deleteConfirmMessage', { name: notebookToDelete?.name }) }}</p>
<button @click="showNotebookDeleteConfirm = false" class="cancel-btn">{{ t('common.cancel') }}</button>
<button @click="confirmDeleteNotebook" class="delete-btn confirm-delete">{{ t('common.delete') }}</button>
```

---

### Task 10: 修改 CanvasView.vue

**Files:**
- Modify: `src/views/CanvasView.vue`

- [ ] **Step 1: 导入 useI18n**

```typescript
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
```

- [ ] **Step 2: 替换动态上下文相关文本**

将：
```vue
<span v-else>动态上下文</span>
<p>当前笔记未关联动态上下文文件。</p>
<p class="hint">拖拽文字到 Header 右侧区域可自动创建。</p>
<button @click="showDynamicContextEditor = false" class="cancel-btn">取消</button>
<button @click="saveDynamicContextEdit" class="confirm-btn">保存</button>
```

改为：
```vue
<span v-else>{{ t('context.dynamic') }}</span>
<p>{{ t('context.noDynamicContext') }}</p>
<p class="hint">{{ t('context.createHint') }}</p>
<button @click="showDynamicContextEditor = false" class="cancel-btn">{{ t('common.cancel') }}</button>
<button @click="saveDynamicContextEdit" class="confirm-btn">{{ t('common.save') }}</button>
```

---

### Task 11: 修改 NodeListView.vue

**Files:**
- Modify: `src/views/NodeListView.vue`

- [ ] **Step 1: 导入 useI18n**

```typescript
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
```

- [ ] **Step 2: 替换动态上下文相关文本**

将：
```vue
<span v-else>动态上下文</span>
<p>当前笔记未关联动态上下文文件。</p>
<p class="hint">拖拽文字到 Header 右侧区域可自动创建。</p>
<button @click="showDynamicContextEditor = false" class="cancel-btn">取消</button>
<button @click="saveDynamicContextEdit" class="confirm-btn">保存</button>
```

改为：
```vue
<span v-else>{{ t('context.dynamic') }}</span>
<p>{{ t('context.noDynamicContext') }}</p>
<p class="hint">{{ t('context.createHint') }}</p>
<button @click="showDynamicContextEditor = false" class="cancel-btn">{{ t('common.cancel') }}</button>
<button @click="saveDynamicContextEdit" class="confirm-btn">{{ t('common.save') }}</button>
```

---

### Task 12: 修改 PdfReaderView.vue

**Files:**
- Modify: `src/views/PdfReaderView.vue`

- [ ] **Step 1: 导入 useI18n**

```typescript
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
```

- [ ] **Step 2: 替换文本**

将：
```vue
<p>未找到 PDF 文件</p>
<span v-else>动态上下文</span>
<p>当前笔记未关联动态上下文文件。</p>
<p class="hint">拖拽文字到 Header 右侧区域可自动创建。</p>
<button @click="showDynamicContextEditor = false" class="cancel-btn">取消</button>
<button @click="saveDynamicContextEdit" class="confirm-btn">保存</button>
```

改为：
```vue
<p>{{ t('canvas.pdfNotFound') }}</p>
<span v-else>{{ t('context.dynamic') }}</span>
<p>{{ t('context.noDynamicContext') }}</p>
<p class="hint">{{ t('context.createHint') }}</p>
<button @click="showDynamicContextEditor = false" class="cancel-btn">{{ t('common.cancel') }}</button>
<button @click="saveDynamicContextEdit" class="confirm-btn">{{ t('common.save') }}</button>
```

---

### Task 13: 修改 ChatPanel.vue

**Files:**
- Modify: `src/components/ChatPanel.vue`

- [ ] **Step 1: 导入 useI18n**

```typescript
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
```

- [ ] **Step 2: 替换提示文本**

将：
```vue
<p>点击左侧笔记查看详情</p>
```

改为：
```vue
<p>{{ t('canvas.clickToView') }}</p>
```

---

### Task 14: 编译检查和测试

**Files:**
- 无文件修改，仅运行命令

- [ ] **Step 1: 运行 TypeScript 编译检查**

```bash
npx vue-tsc --noEmit
```

Expected: 无错误输出

- [ ] **Step 2: 运行开发模式测试**

```bash
npm run dev
```

Expected: 应用启动，界面显示中文

- [ ] **Step 3: 测试语言切换**

在设置中将语言切换为 English，验证界面立即变为英文。

---

### Task 15: 提交更改

- [ ] **Step 1: 添加文件到 git**

```bash
git add package.json package-lock.json src/i18n/ src/locales/ src/main.ts src/stores/settingsStore.ts electron/main.js electron/preload.js src/vite-env.d.ts src/components/ src/views/
```

- [ ] **Step 2: 提交**

```bash
git commit -m "feat: add i18n internationalization support (zh/en)

- Add vue-i18n dependency
- Create zh.ts and en.ts translation files
- Add i18n configuration module with locale switching
- Add getSystemLocale IPC for system language detection
- Replace hardcoded text in all Vue components with $t()
- Support immediate language switching without restart

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---