# OneHand (oneday_v2) - 项目上下文文档

## 项目概述

**OneHand** 是一款基于 **Electron + Vue 3** 开发的桌面语音笔记应用，支持**离线语音转写**和**AI 智能回答**功能。

### 核心技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Electron | 28.0.0 | 桌面应用框架 |
| Vue | 3.5.29 | 前端框架 |
| TypeScript | 5.9.3 | 类型系统 |
| Vite | 5.4.21 | 构建工具 |
| Pinia | 2.3.1 | 状态管理 |
| Vue Router | 4.6.4 | 路由管理 |
| Sherpa-ONNX | 1.12.29 | 离线语音识别 |
| Marked | 17.0.4 | Markdown 渲染 |
| Highlight.js | 11.11.1 | 代码高亮 |
| KaTeX | 0.16.25 | LaTeX 公式渲染 |
| Mermaid | 11.6.0 | 流程图/图表渲染 |

### 主要功能

- 🎤 **离线语音识别** - 基于 Sherpa-ONNX 的 Paraformer 中文语音识别模型
- 🤖 **AI 智能回答** - 结合静态/动态上下文生成智能回答
- 📝 **无限画布** - 自由拖拽、排版笔记节点，支持多页面管理
- 🏷️ **上下文管理** - 静态背景知识与动态积累内容管理
- ⭐ **收藏功能** - 标记重要笔记
- 🎨 **深色/浅色主题** - 自适应系统主题

---

## 重要提示

  开发过程中，npm安装换成cnpm指令安装，避免npm安装时出现网络问题。cnpm已安装到全局环境。

## 目录结构

```
oneday_v2/
├── electron/                 # Electron 主进程
│   ├── main.js              # 主进程入口，IPC 处理
│   └── preload.js           # 预加载脚本（暴露 electronAPI）
├── src/                      # Vue 前端源码
│   ├── components/          # 可复用组件
│   │   ├── VoiceNote.vue    # 语音笔记节点组件
│   │   ├── InfiniteCanvas.vue # 无限画布组件
│   │   ├── ContextToolbar.vue # 上下文工具栏
│   │   └── RecordingIndicator.vue # 录音指示器
│   ├── views/               # 页面视图
│   │   ├── HomeView.vue     # 主页（项目/上下文管理）
│   │   ├── CanvasView.vue   # 画布视图
│   │   └── SettingsView.vue # 设置页面
│   ├── stores/              # Pinia 状态管理
│   │   ├── projectStore.ts  # 项目管理（多页画布、节点 CRUD）
│   │   ├── contextStore.ts  # 上下文管理（静态/动态标签）
│   │   └── settingsStore.ts # 设置管理（主题、API 配置）
│   ├── types/               # TypeScript 类型定义
│   ├── composables/         # 组合式函数（如 useTheme）
│   ├── utils/               # 工具函数
│   ├── router/              # 路由配置
│   ├── App.vue              # 根组件
│   └── main.ts              # Vue 入口文件
├── build/                    # 构建资源
│   └── models/              # 语音识别模型（自动下载）
├── scripts/                  # 构建脚本
│   └── download-model.js    # 模型下载脚本
├── release/                  # 构建输出目录
├── doc/                      # 项目文档
├── index.html               # HTML 入口
├── package.json             # 项目配置
├── vite.config.ts           # Vite 配置
├── tsconfig.json            # TypeScript 配置
├── tsconfig.electron.json   # Electron TS 配置
└── electron-builder.yml     # Electron 打包配置
```

---

## 开发与构建命令

### 开发模式

```bash
# 安装依赖
cnpm install

# 开发模式：编译并启动 Electron（自动下载模型）
npm run electron:dev
# 或简写为
npm run dev
```

> **注意**：开发模式会先执行完整构建（TypeScript 检查 + Vite 构建），然后启动 Electron 应用。

### 构建应用

```bash
# 构建所有平台（Windows + macOS）
npm run build

# 仅构建 Windows 版本
npm run electron:build:win

# 仅构建 macOS 版本
npm run electron:build:mac

# 构建为目录（不打包，用于测试）
npm run build:dir
```

### 其他脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | 开发模式运行 Electron 应用 |
| `npm run electron:dev` | 同上 |
| `npm run build` | 构建并打包应用 |
| `npm run preview` | 预览构建产物 |
| `npm run download-model` | 手动下载语音识别模型 |

构建产物位于 `release/` 目录。

---

## 技术架构详解

### IPC 通信机制

前端通过 `window.electronAPI` 与 Electron 主进程通信：

```typescript
// 前端调用示例
const result = await window.electronAPI.saveFile(filePath, data)
const audioResult = await window.electronAPI.transcribeAudio(audioData, mimeType, config)

// 主进程处理 (electron/main.js)
ipcMain.handle('save-file', async (event, filePath, data) => { ... })
ipcMain.handle('transcribe-audio', async (event, audioData, mimeType, config) => { ... })
```

**可用的 IPC 接口：**

| 方法 | 说明 |
|------|------|
| `saveFile(filePath, data)` | 保存文本文件 |
| `saveFileBuffer(filePath, buffer)` | 保存二进制文件 |
| `readFile(filePath, encoding)` | 读取文件 |
| `selectDirectory()` | 选择目录对话框 |
| `getAppPath(name)` | 获取应用路径（如 userData） |
| `exists(filePath)` | 检查文件是否存在 |
| `mkdir(dirPath)` | 创建目录 |
| `setTheme(isDark)` | 设置窗口主题 |
| `readConfig()` / `saveConfig(data)` | 读写配置文件 |
| `transcribeAudio(audioData, mimeType, config)` | 语音转写 |

### 语音识别流程

```
录音 (Web Audio API)
    ↓
保存为 WAV 文件 (16kHz 单声道)
    ↓
Sherpa-ONNX Paraformer 模型 (build/models/)
    ↓
离线语音转文字
    ↓
显示转写结果 + 触发 AI 回答
```

**模型路径配置：**
- 开发环境：`project/build/models/sherpa-onnx-paraformer-zh-small-2024-03-09/`
- 生产环境：`resources/app/build/models/` 或 `resources/build/models/`

### 数据存储结构

**存储位置：**
- Windows: `%APPDATA%/OneHand/`
- macOS: `~/Library/Application Support/OneHand/`

**数据文件：**
- 项目数据：`{userData}/projects/projects.json`
- 上下文数据：`{userData}/contexts/contexts.json`
- 上下文内容：`{userData}/contexts/{id}.md`
- 语音文件：与项目数据同目录

### 状态管理 (Pinia Stores)

#### projectStore.ts
- 项目管理（创建、删除、切换）
- 多页画布管理（`canvases` 数组，`currentCanvasIndex`）
- 节点 CRUD（`addNode`、`updateNode`、`removeNode`）
- 画布导航（`goToPrevPage`、`goToNextPage`、`addNewPage`）
- 自动清理空页机制

#### contextStore.ts
- 静态上下文：固定背景知识、术语表
- 动态上下文：可积累的内容
- 标签颜色分类

#### settingsStore.ts
- 主题设置（深色/浅色）
- API 配置（AI 回答后端）

---

## 开发指南

### 添加新功能

1. **组件**：在 `src/components/` 创建新组件
2. **状态管理**：在 `src/stores/` 添加 Pinia store
3. **类型定义**：在 `src/types/` 添加 TypeScript 接口
4. **IPC 处理**：在 `electron/main.js` 添加 `ipcMain.handle`，在 `preload.js` 暴露 API

### 代码规范

- **TypeScript**：严格模式，`paths` 别名 `@/*` 指向 `src/*`
- **Vue**：使用 Composition API + `<script setup lang="ts">`
- **命名**：
  - 组件：PascalCase（如 `VoiceNote.vue`）
  - Store：camelCase + Store 后缀（如 `projectStore.ts`）
  - 类型：PascalCase（如 `CanvasNode`、`Project`）

### Markdown 渲染增强

VoiceNote 组件支持增强的 Markdown 渲染功能：

#### 代码高亮
使用 Highlight.js 自动检测代码语言并高亮：

\`\`\`javascript
// 自动高亮
const foo = () => {
  console.log('Hello, World!')
}
\`\`\`

#### LaTeX 公式
支持行内公式 `$...$` 和块级公式 `$$...$$`：

- 行内：$E = mc^2$
- 块级：$$\\sum_{i=1}^{n} x_i$$

#### Mermaid 图表
使用 \`\`\`mermaid 代码块绘制流程图、时序图等：

\`\`\`mermaid
graph TD
  A[开始] --> B{条件}
  B -->|是 | C[执行]
  B -->|否 | D[结束]
\`\`\`

**实现文件**：`src/utils/markdownRenderer.ts`
- `renderMarkdown(markdown)`: 渲染 Markdown 为 HTML
- `renderMermaidCharts(container)`: 在组件挂载后渲染 Mermaid 图表

### 主题系统

通过 CSS 变量实现深色/浅色主题切换：

```css
:root {
  --bg-primary: #ffffff;
  --text-primary: #333333;
  /* ... */
}

:root.dark {
  --bg-primary: #1a1a1a;
  --text-primary: #e0e0e0;
  /* ... */
}
```

使用 `useTheme` composable 管理主题状态。

---

## 关键文件说明

### electron/main.js
- Electron 主进程入口
- 创建 BrowserWindow
- 初始化 Sherpa-ONNX 语音识别器
- 处理所有 IPC 请求

### electron/preload.js
- 使用 `contextBridge` 暴露安全的 API 给渲染进程
- 所有 `window.electronAPI` 方法在此定义

### src/stores/projectStore.ts
- 核心业务逻辑
- 多页画布数据结构：`CanvasPage[]` + `currentCanvasIndex`
- 节点操作自动保存到文件系统

### scripts/download-model.js
- 自动下载 Paraformer 语音识别模型
- 在 `npm install`、`npm run build` 等命令中自动执行
- 模型来源：GitHub Releases

---

## 常见问题

### 模型下载失败
- 检查网络连接，GitHub 可能需要代理
- 手动下载：https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-paraformer-zh-small-2024-03-09.tar.bz2
- 解压到 `build/models/` 目录

### 开发时端口冲突
- 开发模式使用构建后的静态文件，不启动 Vite 开发服务器

### 数据备份
备份 `{userData}/OneHand/` 目录即可保存所有项目和上下文数据。

---

## 相关文档

- [README.md](./README.md) - 完整使用说明
- [doc/UI_elements.md](./doc/UI_elements.md) - UI 元素设计文档
- [docs/](./docs/) - 其他项目文档
