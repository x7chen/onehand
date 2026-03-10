# Onehand - 智能语音笔记桌面应用

基于 Electron + Vue 3 + TypeScript 的智能语音笔记应用。

## 功能特性

- ✅ 无限画布系统，支持拖拽、缩放
- ✅ 长按鼠标左键录音（500ms 触发）
- ✅ 语音转文字（支持 FunASR 和 OpenAI Whisper）
- ✅ AI 智能回答（支持 ModelScope、通义千问、OpenAI、DeepSeek）
- ✅ 上下文管理功能
- ✅ 项目持久化存储

## 技术栈

- **框架**: Electron 28 + Vue 3 + TypeScript + Vite 5
- **状态管理**: Pinia
- **路由**: Vue Router
- **构建工具**: Electron Builder

## 安装步骤

### 1. 安装依赖

由于网络原因，建议使用以下镜像源安装：

```bash
# 使用淘宝镜像
npm config set registry https://registry.npmmirror.com

# 安装依赖
npm install
```

### 2. 开发模式运行

```bash
# 启动 Vite 开发服务器
npm run dev

# 在另一个终端启动 Electron
npm run electron:dev
```

### 3. 构建生产版本

```bash
# 构建当前平台
npm run electron:build

# 或指定平台
npm run electron:build:win    # Windows
npm run electron:build:mac    # macOS
```

## GitHub Actions 自动构建

项目支持 GitHub Actions 自动构建 Windows 和 macOS 两个平台。

### 触发构建

```bash
# 1. 更新版本号（在 package.json 中）
# 2. 提交并推送标签
git tag v0.1.0
git push origin v0.1.0
```

推送标签后，GitHub Actions 会自动构建所有平台并创建 GitHub Release。

### 构建产物

| 平台 | 类型 | 文件格式 |
|------|------|----------|
| Windows | 安装程序 | `.exe` |
| Windows | 便携版 | `.zip` |
| macOS | 磁盘镜像 | `.dmg` (x64 + ARM64) |

详细说明请参考：[.github/BUILD.md](.github/BUILD.md)

## 配置说明

### 语音转文字 (STT)

**重要提示**: 首次使用请在设置页面配置语音转文字服务！

**OpenAI Whisper (推荐)**
- 打开应用 → 点击设置 → 选择 STT 服务提供商为 "OpenAI Whisper"
- 输入 OpenAI API Key
- 优点：无需本地部署，识别准确
- 缺点：需要 API Key（付费）

**FunASR (本地服务)**
- 服务地址：`http://localhost:8000`
- 需要在本地部署 FunASR 服务
- 优点：免费，数据本地处理
- 缺点：需要自行部署服务

### 大模型 (LLM)

**ModelScope (默认)**
- API Key: 已内置
- 模型：Qwen3-235B-A22B-Instruct-2507
- 可直接使用，无需配置

## 鼠标操作

| 操作 | 说明 |
|------|------|
| 鼠标左键拖拽 | 平移画布 |
| 鼠标滚轮 | 缩放画布 |
| 鼠标左键长按 (500ms) | 开始录音 |
| 鼠标左键松开 | 停止录音 |
| 节点拖拽 | 移动笔记位置 |

## 项目结构

```
onehand/
├── electron/              # Electron 主进程
│   ├── main.ts           # 主进程入口
│   └── preload.ts        # 预加载脚本
├── src/
│   ├── components/       # Vue 组件
│   ├── composables/      # 组合式函数
│   ├── stores/           # Pinia 状态管理
│   ├── types/            # TypeScript 类型
│   ├── views/            # 页面视图
│   └── main.ts           # Vue 入口
└── package.json
```

## 注意事项

1. **录音功能**需要麦克风权限
2. **语音识别**需要配置 STT 服务（推荐使用 OpenAI Whisper，需在设置中输入 API Key）
3. **API Key**请妥善保管
4. 录音最长支持 30 秒，超时自动停止

## 使用指南

### 录音步骤
1. 打开应用，进入项目画布
2. **长按鼠标左键**在画布任意位置（500ms 后开始录音）
3. 录音时显示红色指示器和计时
4. **松开鼠标左键**停止录音
5. 自动进行语音转文字和 AI 回答

### 配置语音识别
1. 点击首页或画布页面的"设置"按钮
2. 选择"语音转文本配置"
3. 选择 STT 服务提供商：
   - **OpenAI Whisper**: 输入 API Key
   - **FunASR**: 确保本地服务已运行
4. 保存设置

### 上下文功能
1. 点击已完成转写的笔记复选框，选中为上下文
2. 点击底部"结合新录音提问"按钮
3. 再次长按录音提问
4. AI 会结合选中的上下文进行回答

## License

MIT
