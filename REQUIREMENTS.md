# Handbook 应用需求文档

## 1. 项目概述

### 1.1 项目名称
Handbook - 智能语音笔记桌面应用

### 1.2 技术栈
- **框架**: Electron + Vue 3 + TypeScript + Vite
- **状态管理**: Pinia
- **路由**: Vue Router
- **构建工具**: Electron Builder

### 1.3 核心功能
基于无边画布的语音笔记应用，支持语音录制、语音转文字、AI 智能回答和上下文管理功能。

---

## 2. 功能需求

### 2.1 无边画布系统

#### 2.1.1 画布特性
- ✅ 无限扩展的画布空间
- ✅ 支持拖拽平移（鼠标中键或左键拖拽）
- ✅ 支持滚轮缩放
- ✅ 网格背景，随视图缩放
- ✅ 保存和恢复画布视图状态（位置、缩放比例）

#### 2.1.2 节点系统
- ✅ 节点可在画布上自由拖拽移动
- ✅ 节点支持删除操作
- ✅ 节点数据持久化存储

---

### 2.2 语音录音功能

#### 2.2.1 录音触发
- ✅ **长按鼠标左键**（500ms）在画布任意位置开始录音
- ✅ 录音时显示录音指示器（红色圆点 + 计时）
- ✅ 录音指示器跟随鼠标位置显示

#### 2.2.2 录音处理
- ✅ 支持 WebM 和 WAV 格式录音
- ✅ 录音完成后自动保存音频文件
- ✅ 在画布点击位置创建语音节点
- ✅ 语音节点显示麦克风图标

#### 2.2.3 音频播放
- ✅ 点击语音图标可播放录音
- ✅ 播放时图标显示动画效果
- ✅ 支持暂停和重新播放

---

### 2.3 语音转文字（STT）

#### 2.3.1 支持的 STT 提供商

| 提供商 | 类型 | 配置项 |
|--------|------|--------|
| **FunASR** | 本地服务 | 服务地址、语言、热词、文本逆规整 |
| **OpenAI Whisper** | 云端 API | API Key、模型、语言 |

#### 2.3.2 FunASR 配置（默认）
- ✅ 服务地址：`http://localhost:8000`
- ✅ 支持语言：中文、英文、日文、粤语、韩语
- ✅ 热词功能：逗号分隔的专业术语
- ✅ 文本逆规整：数字、日期格式化
- ✅ 模型：Fun-ASR-Nano-2512

#### 2.3.3 OpenAI Whisper 配置
- ✅ API Key 配置
- ✅ 模型选择：whisper-1
- ✅ 语言选择：自动检测/中文/英文/日语/韩语

#### 2.3.4 转写流程
- ✅ 录音完成后自动触发转写
- ✅ 转写状态显示：等待中 → 处理中 → 完成/失败
- ✅ 转写失败支持重试
- ✅ 转写结果显示在**蓝色文本框**中

---

### 2.4 大模型 AI 回答

#### 2.4.1 支持的大模型提供商

| 提供商 | 状态 | API 地址 | 默认模型 |
|--------|------|----------|----------|
| **ModelScope** | ✅ 默认启用 | `https://api-inference.modelscope.cn/v1` | Qwen3-235B-A22B-Instruct-2507 |
| 通义千问 (Qwen) | 可选 | `https://dashscope.aliyuncs.com/compatible-mode/v1` | qwen-turbo |
| OpenAI | 可选 | `https://api.openai.com/v1` | gpt-4o |
| DeepSeek | 可选 | `https://api.deepseek.com/v1` | deepseek-chat |
| 自定义 | 可选 | 用户配置 | 用户配置 |

#### 2.4.2 ModelScope 配置（默认）
- ✅ API Key: `ms-551063a1-7a2e-4415-93ff-223e3bf30d8e`
- ✅ 模型：`Qwen/Qwen3-235B-A22B-Instruct-2507`
- ✅ 支持流式响应

#### 2.4.3 AI 处理流程
- ✅ 转写完成后自动触发 AI 回答（无上下文时）
- ✅ AI 回答状态显示：等待中 → 处理中 → 完成/失败
- ✅ 支持流式输出，实时显示回答内容
- ✅ AI 回答结果显示在**绿色文本框**中
- ✅ 失败支持重试

#### 2.4.4 系统提示词
```
You are an intelligent notebook assistant. Based on the user's voice note content 
and context, provide useful responses, summaries, or expanded information. 
Reply in the same language as the user's input.
```

---

### 2.5 上下文管理功能

#### 2.5.1 上下文选择
- ✅ 每个语音节点左上角显示复选框
- ✅ 只有转写完成的节点可被选为上下文
- ✅ 选中后节点图标显示绿色圆点标记
- ✅ 支持多选

#### 2.5.2 上下文工具栏
当选择上下文后显示：
- ✅ 显示已选择的上下文数量
- ✅ **清空选择**按钮
- ✅ **结合新录音提问**按钮

#### 2.5.3 上下文处理流程
1. 用户选择多个已有记录作为上下文
2. 创建新的录音并转写完成
3. 点击"结合新录音提问"
4. 系统将上下文和新录音一起发送给大模型
5. AI 回答显示在新录音的绿色文本框中
6. 自动清空上下文选择

#### 2.5.4 上下文消息格式
```
【上下文记录】{transcript_1}
【AI 回答】{agent_result_1}
【上下文记录】{transcript_2}
【AI 回答】{agent_result_2}
【当前问题】{current_transcript}
```

---

### 2.6 文本框显示

#### 2.6.1 语音转写文本框（蓝色）
- ✅ 背景色：淡蓝色 `rgba(66, 153, 225, 0.15)`
- ✅ 左边框：3px 蓝色边框
- ✅ 宽度：280px - 420px（自适应）
- ✅ 字体：14px，行高 1.6
- ✅ 一行约 15-18 个汉字
- ✅ 支持自动换行

#### 2.6.2 AI 回答文本框（绿色）
- ✅ 背景色：淡绿色 `rgba(102, 187, 106, 0.15)`
- ✅ 左边框：3px 绿色边框
- ✅ 显示"AI 回答"标签
- ✅ 宽度：280px - 420px（自适应）
- ✅ 字体：14px，行高 1.6
- ✅ 支持自动换行和预格式化文本

#### 2.6.3 状态显示
- ✅ 处理中：显示"转换中..."或"处理中..."
- ✅ 失败：显示错误信息和重试按钮
- ✅ 成功：显示完整内容

---

### 2.7 设置管理

#### 2.7.1 大模型配置
- ✅ 提供商列表（启用/禁用）
- ✅ API Key 配置
- ✅ Base URL 配置
- ✅ 模型选择（启用/禁用）
- ✅ 设置当前使用的提供商和模型

#### 2.7.2 语音转文本配置
- ✅ STT 提供商选择（FunASR / OpenAI Whisper）
- ✅ FunASR: 服务地址、语言、热词、文本逆规整
- ✅ Whisper: API Key、模型、语言

#### 2.7.3 其他设置
- ✅ 音频格式：WebM / WAV
- ✅ 界面语言：中文 / English / 跟随系统
- ✅ 主题：深色 / 浅色 / 跟随系统

#### 2.7.4 配置持久化
- ✅ 设置保存到本地文件系统
- ✅ 应用启动时自动加载配置
- ✅ 支持旧版本配置迁移

---

### 2.8 项目管理

#### 2.8.1 项目结构
```
项目/
├── project.json      # 项目配置和画布数据
├── audio/            # 录音文件
│   └── {nodeId}.webm
└── pdfs/             # 导入的 PDF 文件
    └── pdf_{timestamp}_{filename}.pdf
```

#### 2.8.2 项目操作
- ✅ 创建新项目
- ✅ 打开项目
- ✅ 保存项目（自动保存）
- ✅ 删除项目
- ✅ 项目列表展示

#### 2.8.3 画布数据结构
```typescript
interface Canvas {
  id: string
  type: 'infinite' | 'pdf'
  viewport: Viewport
  nodes: CanvasNode[]
}

interface CanvasNode {
  id: string
  type: 'voice-note'
  position: { x, y }
  audioPath: string
  transcript: string | null
  transcriptStatus: 'pending' | 'processing' | 'done' | 'error'
  agentResult: string | null
  agentStatus: 'pending' | 'processing' | 'done' | 'error'
  selectedAsContext?: boolean
  createdAt: number
}
```

---

## 3. 非功能需求

### 3.1 性能要求
- ✅ 录音延迟 < 100ms
- ✅ 转写响应时间取决于服务提供商
- ✅ AI 回答支持流式输出，首字显示 < 2s
- ✅ 画布缩放和平移帧率 > 50fps

### 3.2 数据安全
- ✅ 所有数据本地存储
- ✅ API Key 加密存储（可选）
- ✅ 不上传用户数据到第三方（除调用的 API）

### 3.3 用户体验
- ✅ 操作响应时间 < 200ms
- ✅ 支持键盘快捷键（预留）
- ✅ 状态变化有明确提示
- ✅ 错误处理友好，支持重试

### 3.4 兼容性
- ✅ Windows 10/11
- ✅ macOS 10.15+
- ✅ Linux (Ubuntu 20.04+)

---

## 4. 文件结构

```
handbook_v2/
├── electron/                 # Electron 主进程
│   ├── main.ts              # 主进程入口
│   ├── preload.ts           # 预加载脚本
│   ├── ipc-handlers.ts      # IPC 通信处理
│   └── file-manager.ts      # 文件管理
├── src/
│   ├── components/          # Vue 组件
│   │   ├── InfiniteCanvas.vue
│   │   ├── CanvasNode.vue
│   │   ├── VoiceNote.vue
│   │   ├── RecordingIndicator.vue
│   │   ├── ContextToolbar.vue
│   │   └── PDFViewer.vue
│   ├── composables/         # 组合式函数
│   │   ├── useVoiceRecorder.ts
│   │   ├── useWhisper.ts
│   │   ├── useFunASR.ts
│   │   ├── useQwenAgent.ts
│   │   └── useCanvas.ts
│   ├── stores/              # Pinia 状态管理
│   │   ├── projectStore.ts
│   │   ├── canvasStore.ts
│   │   └── settingsStore.ts
│   ├── types/               # TypeScript 类型定义
│   │   ├── project.ts
│   │   ├── settings.ts
│   │   └── api.ts
│   ├── services/            # 服务层
│   │   └── storage.ts
│   ├── utils/               # 工具函数
│   │   └── long-press.ts
│   ├── views/               # 页面视图
│   │   ├── HomeView.vue
│   │   ├── CanvasView.vue
│   │   ├── SettingsView.vue
│   │   └── PDFCanvasView.vue
│   ├── App.vue
│   └── main.ts
├── package.json
├── vite.config.ts
├── tsconfig.json
└── electron-builder.yml
```

---

## 5. API 接口

### 5.1 FunASR API
```
POST http://localhost:8000/v1/transcriptions
Content-Type: multipart/form-data

Parameters:
- file: 音频文件
- language: 语言（中文/英文/日文/粤语/韩语）
- itn: 是否文本逆规整（true/false）
- hotwords: 热词（逗号分隔）
- return_timestamps: 是否返回时间戳（true/false）
```

### 5.2 ModelScope API
```
POST https://api-inference.modelscope.cn/v1/chat/completions
Content-Type: application/json
Authorization: Bearer {api-key}

Body:
{
  "model": "Qwen/Qwen3-235B-A22B-Instruct-2507",
  "messages": [...],
  "stream": true
}
```

---

## 6. 快捷键（预留）

| 快捷键 | 功能 |
|--------|------|
| `Ctrl + N` | 新建项目 |
| `Ctrl + O` | 打开项目 |
| `Ctrl + S` | 保存项目 |
| `Ctrl + ,` | 打开设置 |
| `Delete` | 删除选中节点 |
| `Ctrl + 滚轮` | 画布缩放 |

---

## 7. 未来扩展

### 7.1 功能扩展
- [ ] PDF 导入和标注
- [ ] 手写笔记支持
- [ ] 节点分组和标签
- [ ] 时间线视图
- [ ] 导出功能（Markdown、PDF）
- [ ] 云同步
- [ ] 多语言界面

### 7.2 性能优化
- [ ] 音频压缩
- [ ] 增量保存
- [ ] 虚拟滚动（大量节点时）
- [ ] 离线支持

### 7.3 AI 增强
- [ ] 本地模型支持（Ollama 等）
- [ ] 多模型切换
- [ ] 自定义提示词模板
- [ ] 智能标签和分类

---

## 8. 版本历史

### v0.1.0 (当前版本)
- ✅ 无边画布基础功能
- ✅ 语音录音和播放
- ✅ FunASR 和 Whisper 语音转写
- ✅ ModelScope/Qwen/DeepSeek/OpenAI 大模型支持
- ✅ AI 智能回答
- ✅ 上下文管理
- ✅ 设置管理
- ✅ 项目持久化

---

## 9. 联系方式

如有问题或建议，请参考项目文档或联系开发团队。
