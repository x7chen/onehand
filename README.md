# OneHand - 智能语音笔记桌面应用

<div align="center">

![Version](https://img.shields.io/badge/version-0.4.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Electron](https://img.shields.io/badge/Electron-28.0.0-47848F?logo=electron)
![Vue](https://img.shields.io/badge/Vue-3.5.29-4FC08D?logo=vue.js)

**一款支持离线语音识别的智能笔记应用**

[功能特性](#功能特性) • [快速开始](#快速开始) • [使用说明](#使用说明) • [技术架构](#技术架构)

</div>

---

## 📖 项目简介

OneHand 是一款基于 Electron + Vue 3 开发的桌面语音笔记应用，支持**离线语音转写**和**AI 智能回答**功能。用户可以通过录音快速记录想法，应用会自动将语音转换为文字，并结合上下文提供 AI 回答。所有语音识别均在本地完成，无需联网，保护隐私。

### 核心功能

- 🎤 **离线语音识别** - 基于 Sherpa-ONNX 的 Paraformer 中文语音识别模型
- 🤖 **AI 智能回答** - 结合静态/动态上下文，为语音笔记生成智能回答
- 📝 **无限画布** - 自由拖拽、排版笔记节点，支持多页面管理
- 🏷️ **上下文管理** - 静态背景知识与动态积累内容管理
- ⭐ **收藏功能** - 标记重要笔记，方便快速查找
- 🎨 **深色/浅色主题** - 自适应系统主题，支持手动切换

---

## ✨ 功能特性

### 语音笔记
- 一键录音，实时语音转文字
- 支持录音播放、时长显示
- 转写内容支持 Markdown 格式渲染
- 双击可编辑转写内容和 AI 回答
- 支持文本笔记直接创建

### AI 回答
- 流式输出 AI 回答，实时查看生成进度
- 支持折叠/展开长内容
- 可隐藏/显示 AI 回答区域
- 支持重新生成 AI 回答
- 支持编辑 AI 回答内容

### 画布管理
- 无限画布，自由拖拽笔记节点
- 自动排版功能，一键整理笔记布局
- 多页面支持，分页管理不同主题
- 节点收藏功能，快速标记重要内容
- 拖拽删除，将节点拖到垃圾桶即可删除

### 上下文系统
- **静态上下文**：固定背景知识、术语表、项目说明等
- **动态上下文**：动态积累的内容，可持续追加
- 创建项目时可选择关联上下文
- 支持标签颜色分类，快速识别

### 项目管理
- 创建/删除项目
- 项目卡片展示，显示笔记数量和更新时间
- 支持拖拽项目到垃圾桶删除
- 相对时间显示（刚刚、X 分钟前、X 小时前等）

---

## 🚀 快速开始

### 环境要求

- Node.js >= 18
- npm >= 9
- 支持 Windows / macOS

### 安装依赖

```bash
cnpm install
```

### 开发模式

```bash
# 开发模式：编译并启动 Electron（自动下载模型）
npm run electron:dev
# 或简写为
npm run dev
```

> **注意**：开发模式会先执行完整构建（TypeScript 检查 + Vite 构建），然后启动 Electron 应用。

### 构建应用

```bash
# 构建所有平台
npm run build

# 仅构建 Windows 版本
npm run electron:build:win

# 仅构建 macOS 版本
npm run electron:build:mac

# 构建为目录（不打包）
npm run build:dir
```

构建产物位于 `release/` 目录。

### 可用脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | 开发模式运行 Electron 应用 |
| `npm run electron:dev` | 同上 |
| `npm run build` | 构建并打包应用 |
| `npm run preview` | 预览构建产物 |
| `npm run download-model` | 手动下载语音识别模型 |

---

## 📁 项目结构

```
oneday_v2/
├── electron/                 # Electron 主进程
│   ├── main.js              # 主进程入口，IPC 处理
│   └── preload.js           # 预加载脚本
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
│   │   ├── projectStore.ts  # 项目管理
│   │   ├── contextStore.ts  # 上下文管理
│   │   └── settingsStore.ts # 设置管理
│   ├── types/               # TypeScript 类型定义
│   ├── composables/         # 组合式函数
│   ├── utils/               # 工具函数
│   ├── router/              # 路由配置
│   ├── App.vue              # 根组件
│   └── main.ts              # 入口文件
├── build/                    # 构建资源
│   └── models/              # 语音识别模型（自动下载）
├── scripts/                  # 构建脚本
│   └── download-model.js    # 模型下载脚本
├── release/                  # 构建输出目录
├── doc/                      # 项目文档
└── package.json             # 项目配置
```

---

## 💡 使用说明

### 创建项目

1. 在主页点击「新建项目」按钮
2. 输入项目名称
3. （可选）选择静态上下文和动态上下文
4. 点击「创建」，自动进入画布视图

### 录音笔记

1. 在画布视图中，按空格键开始录音
2. 再次按空格键停止录音
3. 录音会自动转写为文字，并生成 AI 回答

### 文本笔记

1. 按 `T` 键创建文本笔记
2. 输入内容后按 `Enter` 保存

### 上下文管理

#### 创建上下文标签

1. 在主页点击「新建标签」
2. 输入标签名称，选择类型：
   - **静态上下文**：固定背景知识、术语表等
   - **动态上下文**：动态积累的内容
3. 创建后双击标签编辑内容和颜色

#### 使用上下文

- 创建项目时选择关联的上下文
- 在画布视图中，上下文会自动应用于 AI 回答生成
- 静态上下文作为背景知识，动态上下文会持续积累笔记内容

### 画布操作

| 操作 | 快捷键/方式 |
|------|------------|
| 开始/停止录音 | 空格键 |
| 创建文本笔记 | T 键 |
| 全选节点 | A 键 |
| 反选节点 | R 键 |
| 清空选择 | Q 键 |
| 删除选中节点 | Delete / Backspace |
| 播放录音 | 点击麦克风图标 |
| 编辑内容 | 双击文本区域 |
| 移动节点 | 拖拽节点头部 |
| 删除项目 | 拖拽项目卡片到垃圾桶 |

### 自动排版

点击画布头部的「自动排版」按钮，系统会：

1. 展开所有折叠的文本框，统计每个节点的实际尺寸
2. 按每排 5 个节点、水平间隔 20px 进行布局
3. 以每排最高节点为基准，竖直间隔 20px
4. 自动折叠超过高度限制的文本框（转写>300px，AI 回答>800px）

---

## 🛠️ 技术架构

### 技术栈

| 技术 | 版本 | 说明 |
|------|------|------|
| Electron | 28.0.0 | 桌面应用框架 |
| Vue | 3.5.29 | 前端框架 |
| TypeScript | 5.9.3 | 类型系统 |
| Vite | 5.4.21 | 构建工具 |
| Pinia | 2.3.1 | 状态管理 |
| Vue Router | 4.6.4 | 路由管理 |
| Sherpa-ONNX | 1.12.29 | 离线语音识别 |
| Marked | 17.0.4 | Markdown 渲染 |

**开发模式说明**：运行 `npm run dev` 时会先执行完整构建（TypeScript 检查 + Vite 构建），然后启动 Electron 应用加载构建后的静态文件。

### 语音识别流程

```
录音 (Web Audio API)
    ↓
保存为 WAV 文件 (16kHz 单声道)
    ↓
Sherpa-ONNX Paraformer 模型
    ↓
离线语音转文字
    ↓
显示转写结果 + 触发 AI 回答
```

### 数据存储

- **项目数据**：`{userData}/projects/projects.json`
- **上下文数据**：`{userData}/contexts/contexts.json`
- **上下文内容**：`{userData}/contexts/{id}.md`
- **语音文件**：与项目数据同目录存储

---

## 📦 构建产物

### Windows

- `OneHand-0.4.0-Windows-x64.zip` - 绿色版
- `OneHand-0.4.0-Windows-Setup-x64.exe` - 安装版

### macOS

- `OneHand-0.4.0-macOS-x64.dmg` - Intel 芯片
- `OneHand-0.4.0-macOS-arm64.dmg` - Apple Silicon

---

## 🔧 开发指南

### 添加新功能

1. 在 `src/components/` 创建新组件
2. 在 `src/stores/` 添加状态管理（如需要）
3. 在 `src/types/` 添加 TypeScript 类型定义
4. 在 `electron/main.js` 添加 IPC 处理（如需要）

### IPC 通信

前端通过 `window.electronAPI` 与 Electron 主进程通信：

```typescript
// 前端调用
const result = await window.electronAPI.saveFile(filePath, data)

// 主进程处理
ipcMain.handle('save-file', async (event, filePath, data) => {
  // 处理逻辑
})
```

### 模型下载

首次运行或构建时会自动下载语音识别模型。如需手动下载：

```bash
npm run download-model
```

模型文件存储在 `build/models/sherpa-onnx-paraformer-zh-small-2024-03-09/`

---

## 📝 常见问题

### Q: 语音识别不准确怎么办？

A: 当前使用的是 Paraformer 中文小模型，适用于普通话识别。如需更高精度，可考虑：
- 在安静环境下录音
- 使用标准普通话
- 未来可替换为更大的模型

### Q: AI 回答如何配置？

A: 当前版本 AI 回答功能需要配置后端服务。请在设置页面配置 API 端点和密钥。

### Q: 如何备份数据？

A: 数据存储在系统用户数据目录：
- **Windows**: `%APPDATA%/OneHand/`
- **macOS**: `~/Library/Application Support/OneHand/`

备份该目录即可保存所有项目和上下文数据。

---

## 📄 许可证

MIT License

---

## 🙏 致谢

- [Sherpa-ONNX](https://github.com/k2-fsa/sherpa-onnx) - 离线语音识别引擎
- [Paraformer](https://www.modelscope.cn/models/damo/speech_paraformer-large-vad-punc_asr_nat-zh-cn) - 中文语音识别模型
- [Vue.js](https://vuejs.org/) - 渐进式 JavaScript 框架
- [Electron](https://www.electronjs.org/) - 跨平台桌面应用框架

---

<div align="center">

**OneHand** - 用声音记录想法，让 AI 为你思考

Made with ❤️ by OneHand Team

</div>
