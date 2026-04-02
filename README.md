# OneHand - 智能语音笔记桌面应用

<div align="center">

![Version](https://img.shields.io/badge/version-0.9.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Electron](https://img.shields.io/badge/Electron-28.0.0-47848F?logo=electron)
![Vue](https://img.shields.io/badge/Vue-3.5.29-4FC08D?logo=vue.js)

**一款支持离线语音识别的智能笔记应用**

[功能特性](#功能特性) • [快速开始](#快速开始) • [使用指南](#使用指南) • [用户配置指南](doc/用户配置指南.md) • [技术架构](#技术架构)

</div>

---

## 项目简介

OneHand 是一款基于 Electron + Vue 3 开发的桌面语音笔记应用，支持**离线语音转写**和**AI 智能回答**功能。用户可以通过录音快速记录想法，应用会自动将语音转换为文字，并结合上下文提供 AI 回答。所有语音识别均在本地完成，无需联网，保护隐私。

### 核心能力

- 🎤 **离线语音识别** - 基于 Sherpa-ONNX Paraformer 中文语音识别模型
- 🤖 **AI 智能回答** - 结合静态/动态上下文，生成智能回答
- 📝 **无限画布** - 自由拖拽、排版笔记节点
- 📄 **PDF 阅读器** - 支持 PDF 文件阅读与批注
- 🔍 **全局搜索** - 快速检索所有笔记本内容
- 🏷️ **上下文管理** - 静态背景知识与动态积累内容管理

---

## 功能特性

### 语音笔记
- 一键录音，实时语音转文字
- 支持录音播放、时长显示
- 转写内容支持 Markdown 格式渲染
- 支持编辑转写内容和 AI 回答

### AI 回答
- 流式输出，实时查看生成进度
- 支持折叠/展开长内容
- 可重新生成或编辑 AI 回答

### 画布管理
- 无限画布，自由拖拽笔记节点
- 自动排版功能，一键整理笔记布局
- 多页面支持，分页管理不同主题
- 节点收藏功能，快速标记重要内容
- 拖拽删除，将节点拖到垃圾桶即可删除

### PDF 阅读器
- 支持 PDF 文件导入和阅读
- PDF 页面导航，支持跳转指定页面
- PDF 与笔记关联，支持 PDF 相关笔记管理

### 列表视图
- 笔记列表展示，快速浏览所有笔记
- 支持按收藏状态筛选
- 点击笔记可快速定位到画布位置

### 上下文系统
- **静态上下文**：固定背景知识、术语表、项目说明等
- **动态上下文**：动态积累的内容，可持续追加
- 创建笔记本时可选择关联上下文
- 支持标签颜色分类，快速识别

---

## 快速开始

### 环境要求

- Node.js >= 18
- npm >= 9
- 支持 Windows / macOS

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
# 开发模式：编译并启动 Electron（自动下载模型）
npm run dev
# 或
npm run electron:dev
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
| `npm run build` | 构建并打包应用 |
| `npm run preview` | 预览构建产物 |
| `npm run download-model` | 手动下载语音识别模型 |

---

## 使用指南

> 📖 **详细配置教程**：如果您需要配置 AI 服务，请参阅 [用户配置指南](doc/用户配置指南.md)，包含 AI 大模型配置、界面设置和常见问题解答。

### 创建笔记本

1. 在主页点击「新建笔记本」按钮
2. 输入笔记本名称
3. （可选）选择 PDF 文件，创建 PDF 笔记本
4. （可选）选择静态上下文和动态上下文
5. 点击「创建」，自动进入列表视图或 PDF 阅读器

### 视图切换

- **列表视图**：点击笔记本卡片进入，展示所有笔记列表
- **PDF 阅读器**：PDF 笔记本点击卡片进入，支持 PDF 阅读
- **画布视图**：点击笔记本卡片上的画布按钮进入，支持自由排版

### 录音笔记

1. 在画布视图中，长按鼠标左键开始录音
2. 松开鼠标左键停止录音
3. 录音会自动转写为文字，并生成 AI 回答

### 文本笔记

1. 双击鼠标左创建文本笔记
2. 输入内容后按 `Ctrl+Enter` 保存

### 上下文管理

#### 创建上下文标签

1. 在主页点击「新建标签」
2. 输入标签名称，选择类型：
   - **静态上下文**：固定背景知识、术语表等
   - **动态上下文**：动态积累的内容
3. 创建后双击标签编辑内容和颜色

#### 使用上下文

- 创建笔记本时选择关联的上下文
- 在画布视图中，上下文会自动应用于 AI 回答生成
- 静态上下文作为背景知识，动态上下文会持续积累笔记内容

### 画布操作

| 操作 | 快捷键/方式 |
|------|------------|
| 删除选中节点 | Delete / Backspace |
| 播放录音 | 点击麦克风图标 |
| 编辑内容 | 双击文本区域 |
| 移动节点 | 拖拽节点头部 |
| 删除笔记本 | 拖拽笔记本卡片到垃圾桶 |

### 自动排版

点击画布头部的「自动排版」按钮，系统会：

1. 展开所有折叠的文本框，统计每个节点的实际尺寸
2. 按每排 5 个节点、水平间隔 20px 进行布局
3. 以每排最高节点为基准，竖直间隔 20px

---

## 技术架构

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
| PDF.js | 4.7.76 | PDF 渲染 |
| Marked | 17.0.4 | Markdown 渲染 |
| KaTeX | 0.16.25 | 数学公式渲染 |
| Mermaid | 11.6.0 | 流程图/图表渲染 |
| Highlight.js | 11.11.1 | 代码高亮 |

### 项目结构

```
src/
├── components/     # Vue 组件
├── composables/    # 组合式函数
├── stores/         # Pinia 状态管理
├── types/          # TypeScript 类型定义
├── utils/          # 工具函数
├── views/          # 路由级组件
├── router/         # Vue Router 配置
└── main.ts         # 应用入口
```

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

- **笔记本数据**：`{userData}/notebooks/notebooks.json`
- **上下文数据**：`{userData}/contexts/contexts.json`
- **上下文内容**：`{userData}/contexts/{id}.md`
- **语音文件**：与笔记本数据同目录存储

---

## 构建产物

### Windows

- `OneHand-0.7.5-Windows-x64.zip` - 绿色版
- `OneHand-0.7.5-Windows-Setup-x64.exe` - 安装版

### macOS

- `OneHand-0.7.5-macOS-x64.dmg` - Intel 芯片
- `OneHand-0.7.5-macOS-arm64.dmg` - Apple Silicon

---

## 开发指南

### 添加新功能

1. 在 `src/components/` 创建新组件
2. 在 `src/stores/` 添加状态管理（如需要）
3. 在 `src/types/` 添加 TypeScript 类型定义
4. 在 `electron/main.js` 添加 IPC 处理（如需要）

### 模型下载

首次运行或构建时会自动下载语音识别模型。如需手动下载：

```bash
npm run download-model
```

模型文件存储在 `build/models/sherpa-onnx-paraformer-zh-small-2024-03-09/`

---

## 常见问题

### Q: 语音识别不准确怎么办？

A: 当前使用的是 Paraformer 中文小模型，适用于普通话识别。如需更高精度，可考虑：
- 在安静环境下录音
- 使用标准普通话
- 未来可替换为更大的模型

### Q: AI 回答如何配置？

A: 当前版本 AI 回答功能需要配置后端服务。请在设置页面配置 API 端点和密钥。支持 OpenAI 兼容的 API 接口。

### Q: 如何备份数据？

A: 数据存储在系统用户数据目录：
- **Windows**: `%APPDATA%/OneHand/`
- **macOS**: `~/Library/Application Support/OneHand/`

备份该目录即可保存所有笔记本和上下文数据。

### Q: PDF 阅读器支持哪些功能？

A: 当前支持 PDF 文件阅读、页面导航、与笔记关联。后续版本将支持 PDF 批注、高亮等功能。

---

## 许可证

MIT License

---

## 致谢

- [Sherpa-ONNX](https://github.com/k2-fsa/sherpa-onnx) - 离线语音识别引擎
- [Paraformer](https://www.modelscope.cn/models/damo/speech_paraformer-large-vad-punc_asr_nat-zh-cn) - 中文语音识别模型
- [PDF.js](https://mozilla.github.io/pdf.js/) - PDF 渲染库
- [Vue.js](https://vuejs.org/) - 渐进式 JavaScript 框架
- [Electron](https://www.electronjs.org/) - 跨平台桌面应用框架
- [KaTeX](https://katex.org/) - 数学公式渲染
- [Mermaid](https://mermaid.js.org/) - 流程图/图表渲染

---

<div align="center">

**OneHand** - 用声音记录想法，让 AI 为你思考

Made with ❤️ by OneHand Team

</div>