# OneHand - 智能语音笔记桌面应用

<div align="center">

![Version](https://img.shields.io/badge/version-0.12.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Electron](https://img.shields.io/badge/Electron-28.0.0-47848F?logo=electron)
![Vue](https://img.shields.io/badge/Vue-3.5.29-4FC08D?logo=vue.js)

**一款支持离线语音识别的AI辅助工作平台**

[功能介绍](#功能介绍) • [开发相关](#开发相关)

</div>

---

## 功能介绍

### 核心特点

- 🖱️ **拖拽功能** - 便捷的内容导入方式
- 📐 **无限画布** - 提供广阔的创作空间
- 🎤 **离线语音** - 语音数据本地处理，保护隐私

### 上下文系统

#### 静态上下文
用于设定AI回答的限制条件，例如回答语言、字数限制、语气风格等。在主页的上下文栏中创建和管理。

#### 动态上下文
用于积累研究过程中重要的句子或片段，通过拖拽添加。在AI生成回答时，动态上下文会被包含在提示词中，确保回答不偏离主题。

#### 快捷指令
预先定义的提示词模板，点击即可快速创建节点并发送给AI。在主页的上下文标签栏中创建和管理。

### 视图模式

- **聊天视图**：简洁的聊天界面，适合日常使用
- **画布视图**：无限画布，自由拖拽排版笔记节点

### 交互方式

#### 鼠标操作
在聊天视图的操作区域：
- **长按**：创建录音节点
- **双击**：创建文本节点
- **拖拽文字/图片**：快速创建节点

#### 拖拽导入
- 支持从外部拖拽图片文件创建图片节点
- 支持从浏览器、Word、PDF等应用拖拽文本
- 实用场景：隐藏两侧视图，拖拽英文网站内容进行翻译

#### 界面操作
- 双击视图分隔线可隐藏对应侧边栏
- 鼠标悬停按钮可显示功能提示

### PDF 阅读

- 支持 PDF 文件导入和阅读
- 页面导航，跳转指定页面
- PDF 与笔记关联管理

### 其他功能

- **节点收藏**：快速标记重要内容
- **自动排版**：一键整理笔记布局
- **列表视图**：快速浏览所有笔记
- **全局搜索**：检索所有笔记本内容

---

## 开发相关

### 技术栈

| 技术 | 版本 | 说明 |
|------|------|------|
| Electron | 28.0.0 | 桌面应用框架 |
| Vue | 3.5.29 | 前端框架 |
| TypeScript | 5.9.3 | 类型系统 |
| Vite | 5.4.21 | 构建工具 |
| Pinia | 2.3.1 | 状态管理 |
| Sherpa-ONNX | 1.12.29 | 离线语音识别 |
| PDF.js | 4.7.76 | PDF 渲染 |
| Marked | 17.0.4 | Markdown 渲染 |
| KaTeX | 0.16.25 | 数学公式渲染 |
| Mermaid | 11.6.0 | 流程图渲染 |

### 环境要求

- Node.js >= 18
- npm >= 9
- 支持 Windows / macOS

### 快速开始

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建应用
npm run build
```

### 可用脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | 开发模式运行 |
| `npm run build` | 构建并打包应用 |
| `npm run electron:build:win` | 仅构建 Windows 版本 |
| `npm run electron:build:mac` | 仅构建 macOS 版本 |

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

### 数据存储

- **Windows**: `%APPDATA%/OneHand/`
- **macOS**: `~/Library/Application Support/OneHand/`

### 构建产物

- **Windows**: `OneHand-0.11.0-Windows-x64.zip` / `OneHand-0.11.0-Windows-Setup-x64.exe`
- **macOS**: `OneHand-0.11.0-macOS-x64.dmg` / `OneHand-0.11.0-macOS-arm64.dmg`

---

## 常见问题

**Q: 语音识别不准确？**
A: 使用 Paraformer 中文小模型，建议在安静环境下用标准普通话录音。

**Q: AI 回答如何配置？**
A: 在设置页面配置 OpenAI 兼容的 API 端点和密钥。

**Q: 如何备份数据？**
A: 备份上述数据存储目录即可。

---

## 许可证

MIT License

---

## 致谢

- [Sherpa-ONNX](https://github.com/k2-fsa/sherpa-onnx) - 离线语音识别引擎
- [Vue.js](https://vuejs.org/) - 渐进式 JavaScript 框架
- [Electron](https://www.electronjs.org/) - 跨平台桌面应用框架
- [PDF.js](https://mozilla.github.io/pdf.js/) - PDF 渲染库
- [KaTeX](https://katex.org/) - 数学公式渲染
- [Mermaid](https://mermaid.js.org/) - 流程图渲染

---

<div align="center">

**OneHand** - 用声音记录想法，让 AI 为你思考

Made with ❤️ by OneHand Team

</div>