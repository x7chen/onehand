# Sherpa-Onnx 快速参考

## 🚀 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 下载模型（首次使用）
npm run download:sherpa-model

# 3. 启动应用
npm run electron:dev
```

## 📦 模型信息

- **模型名称**: sherpa-onnx-paraformer-zh-small-2024-03-09
- **大小**: 86MB (INT8 量化)
- **语言**: 中文
- **格式**: ONNX

## 🔧 配置

### 默认配置（无需修改）

```typescript
stt: {
  provider: 'sherpa-onnx',  // 默认使用本地识别
  sherpaOnnx: {
    modelPath: ''  // 留空使用默认路径
  }
}
```

### 手动指定模型路径

```typescript
sherpaOnnx: {
  modelPath: '/custom/path/to/model'
}
```

## 💻 代码使用

### 在 Vue 组件中

```typescript
import { useSherpaOnnx } from '@/composables/useSherpaOnnx'

const { transcribe, isReady, error } = useSherpaOnnx()

// 录音后识别
const audioBlob = await recorder.stopRecording()
const result = await transcribe(audioBlob)

if (result.success) {
  console.log('识别结果:', result.text)
} else {
  console.error('识别失败:', result.error)
}
```

### 直接调用 API

```typescript
// 初始化（通常自动完成）
await window.electronAPI.sherpaOnnx.initialize()

// 识别
const audioData = new Float32Array([...])  // 16kHz 单声道
const result = await window.electronAPI.sherpaOnnx.transcribe(Array.from(audioData))

console.log(result.text)
```

## 📁 文件结构

```
build/models/
└── sherpa-onnx-paraformer-zh-small-2024-03-09/
    ├── model.int8.onnx    # 模型文件 (86MB)
    └── tokens.txt         # 词表文件
```

## 🎯 性能指标

| 指标 | 数值 |
|------|------|
| 初始化时间 | < 500ms |
| 内存占用 | 200-400MB |
| 识别速度 | 实时率 0.1-0.3 |
| 准确率 | > 90% (清晰语音) |

## ⚡ 打包命令

```bash
# Windows
npm run download:sherpa-model
npm run electron:build:win

# macOS
npm run download:sherpa-model
npm run electron:build:mac
```

## ❓ 常见问题

### Q: 模型下载失败？
**A**: 
```bash
# 使用代理或手动下载
# 下载地址: https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-paraformer-zh-small-2024-03-09.tar.bz2
# 解压到: build/models/sherpa-onnx-paraformer-zh-small-2024-03-09/
```

### Q: 初始化失败？
**A**: 检查模型文件是否完整：
```bash
ls build/models/sherpa-onnx-paraformer-zh-small-2024-03-09/
# 应该看到 model.int8.onnx 和 tokens.txt
```

### Q: 识别结果为空？
**A**: 检查音频格式：
- 采样率: 16kHz
- 声道: 单声道
- 格式: Float32Array

## 🔗 相关文档

- [完整集成说明](./SHERPA_ONNX_INTEGRATION.md)
- [测试指南](./TEST_SHERPA_ONNX.md)
- [集成总结](./INTEGRATION_SUMMARY.md)
- [在 CanvasView 中使用](./USE_SHERPA_IN_CANVAS.md)

## 📊 与其他方案对比

| 特性 | Sherpa-Onnx | FunASR | Whisper |
|------|-------------|--------|---------|
| 离线 | ✅ | ✅ | ❌ |
| 启动时间 | < 500ms | 3-5s | - |
| 内存 | 200-400MB | 800MB+ | - |
| 体积 | 86MB | 500MB+ | - |
| 配置 | 无 | 需 Python | 需 API Key |
| 成本 | 免费 | 免费 | 付费 |

## 🎓 学习资源

- [官方 GitHub](https://github.com/k2-fsa/sherpa-onnx)
- [Node.js 示例](https://github.com/k2-fsa/sherpa-onnx/tree/master/nodejs-examples)
- [Paraformer 论文](https://arxiv.org/abs/2206.08920)

---

**提示**: 首次使用前务必运行 `npm run download:sherpa-model`！
