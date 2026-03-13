# Sherpa-ONNX 本地语音识别引擎集成经验总结

## 项目概述

本项目将 Electron + Vue3 桌面应用的语音识别方案从 FunASR/Whisper 迁移到 Sherpa-ONNX 本地引擎，实现完全离线的中文语音识别。

**模型信息：**
- 模型：`sherpa-onnx-paraformer-zh-small-2024-03-09`
- 大小：约 82MB (INT8 量化)
- 语言：中文
- 位置：`build/models/sherpa-onnx-paraformer-zh-small-2024-03-09/`

---

## 集成步骤

### 1. 安装依赖

```bash
npm install sherpa-onnx --save
```

**注意：** Node.js 版本需要 >= 18

### 2. 模型文件准备

将模型文件放置在项目目录下：
```
build/models/sherpa-onnx-paraformer-zh-small-2024-03-09/
├── model.int8.onnx    # 模型文件 (约 82MB)
├── tokens.txt         # 词表文件
├── config.yaml        # 配置文件
└── test_wavs/         # 测试音频
```

### 3. Electron 主进程集成

#### 3.1 加载 Sherpa-ONNX 模块

```javascript
// electron/main.js
let sherpaOnnx = null
try {
  sherpaOnnx = require('sherpa-onnx')
  console.log('Sherpa-ONNX loaded successfully')
} catch (e) {
  console.warn('Failed to load sherpa-onnx:', e.message)
}
```

#### 3.2 模型路径处理

开发环境和生产环境的路径不同，需要多路径尝试：

```javascript
const getModelPath = () => {
  const possiblePaths = [
    // 开发环境
    path.join(__dirname, '../build/models/sherpa-onnx-paraformer-zh-small-2024-03-09'),
    // 生产环境
    path.join(process.resourcesPath, 'app/build/models/sherpa-onnx-paraformer-zh-small-2024-03-09'),
    path.join(process.resourcesPath, 'build/models/sherpa-onnx-paraformer-zh-small-2024-03-09'),
  ]

  for (const modelPath of possiblePaths) {
    const modelFile = path.join(modelPath, 'model.int8.onnx')
    const tokensFile = path.join(modelPath, 'tokens.txt')

    if (fs.existsSync(modelFile) && fs.existsSync(tokensFile)) {
      return modelPath
    }
  }
  return possiblePaths[0]
}
```

#### 3.3 创建识别器

**关键配置格式：**

```javascript
const config = {
  modelConfig: {
    paraformer: {
      model: modelFile,  // 模型文件路径
    },
    tokens: tokensFile,   // 词表文件路径（与 paraformer 同级）
  },
}

// 使用工厂函数创建，不是 new
const recognizer = sherpaOnnx.createOfflineRecognizer(config)
```

**注意：**
- 配置字段名是 `modelConfig` 不是 `model`
- `tokens` 和 `paraformer` 是同级关系
- 使用 `createOfflineRecognizer()` 工厂函数，不是 `new OfflineRecognizer()`

#### 3.4 IPC 处理

```javascript
ipcMain.handle('transcribe-audio', async (event, audioData, mimeType, config) => {
  // 1. 确保识别器已创建
  if (!recognizer) {
    recognizer = createRecognizer()
  }

  // 2. 保存音频到临时文件
  const buffer = Buffer.from(audioData)
  const tempWavPath = path.join(app.getPath('temp'), `audio_${Date.now()}.wav`)
  fs.writeFileSync(tempWavPath, buffer)

  // 3. 读取并识别
  const stream = recognizer.createStream()
  const wave = sherpaOnnx.readWave(tempWavPath)

  // 4. 正确的调用方式：两个参数
  stream.acceptWaveform(wave.sampleRate, wave.samples)

  recognizer.decode(stream)
  const result = recognizer.getResult(stream)

  // 5. 清理
  stream.free()
  fs.unlinkSync(tempWavPath)

  return { success: true, text: result.text }
})
```

### 4. 前端音频处理

浏览器录制的音频是 webm/opus 格式，需要转换为 WAV (16kHz, 16bit, 单声道)：

```typescript
// src/utils/audioConverter.ts
export async function convertToWav(audioBlob: Blob, targetSampleRate = 16000): Promise<Blob> {
  const audioContext = new AudioContext()

  // 1. 解码音频
  const arrayBuffer = await audioBlob.arrayBuffer()
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)

  // 2. 重采样
  const offlineContext = new OfflineAudioContext(
    1, // 单声道
    Math.ceil(audioBuffer.duration * targetSampleRate),
    targetSampleRate
  )

  const source = offlineContext.createBufferSource()
  source.buffer = audioBuffer
  source.connect(offlineContext.destination)
  source.start()

  const renderedBuffer = await offlineContext.startRendering()

  // 3. 转换为 WAV Blob
  return audioBufferToWav(renderedBuffer)
}
```

### 5. 配置更新

#### 5.1 类型定义

```typescript
// src/types/settings.ts
export interface STTSettings {
  provider: 'sherpa-onnx'
  sherpaOnnx: {
    modelPath: string
    tokensPath: string
    numThreads: number
    decodingMethod: 'greedy_search' | 'modified_beam_search'
  }
}
```

#### 5.2 配置合并

旧配置可能没有 `sherpaOnnx` 字段，需要深度合并：

```typescript
function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  const result = { ...target }
  for (const key in source) {
    if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key] as any)
    } else if (source[key] !== undefined) {
      result[key] = source[key] as any
    }
  }
  return result
}
```

---

## 遇到的问题与解决方案

### 问题 1：API 调用方式错误

**错误：** `OfflineRecognizer is not a constructor`

**原因：** Sherpa-ONNX Node.js 绑定使用工厂函数而非构造函数

**解决：**
```javascript
// 错误
const recognizer = new sherpaOnnx.OfflineRecognizer(config)

// 正确
const recognizer = sherpaOnnx.createOfflineRecognizer(config)
```

### 问题 2：配置格式错误

**错误：** `Cannot read properties of undefined (reading 'length')`

**原因：** 配置字段名错误，应为 `modelConfig` 而非 `model`

**解决：**
```javascript
// 错误
const config = {
  model: { paraformer: { model: modelFile } },
  tokens: tokensFile,
}

// 正确
const config = {
  modelConfig: {
    paraformer: { model: modelFile },
    tokens: tokensFile,
  },
}
```

### 问题 3：acceptWaveform 参数错误

**错误：** `Cannot read properties of undefined (reading 'length')`

**原因：** 参数传递方式错误

**解决：**
```javascript
// 错误
stream.acceptWaveform({
  sampleRate: wave.sampleRate,
  samples: wave.samples,
})

// 正确
stream.acceptWaveform(wave.sampleRate, wave.samples)
```

### 问题 4：IPC 传输 ArrayBuffer 失败

**错误：** `An object could not be cloned`

**原因：** Electron IPC 无法直接传输 ArrayBuffer

**解决：**
```typescript
// 转换为普通数组
const uint8Array = new Uint8Array(arrayBuffer)
const audioData = Array.from(uint8Array)

// 传输数组
await window.electronAPI.transcribeAudio(audioData, mimeType, config)
```

### 问题 5：音频格式不兼容

**错误：** `divide by zero` 或识别失败

**原因：** 浏览器录制的是 webm/opus，Sherpa-ONNX 需要 WAV (16kHz, 16bit PCM)

**解决：** 使用 Web Audio API 进行格式转换（见第 4 节）

### 问题 6：模型路径找不到

**错误：** `Model file not found`

**原因：** 开发环境和生产环境的文件路径不同

**解决：** 实现多路径尝试逻辑（见第 3.2 节）

---

## 最佳实践

### 1. 延迟初始化

不要在应用启动时立即创建识别器，而是在第一次需要时创建：

```javascript
let recognizer = null

function getRecognizer() {
  if (!recognizer) {
    recognizer = createRecognizer()
  }
  return recognizer
}
```

### 2. 错误处理

始终检查模型文件是否存在，并提供友好的错误信息：

```javascript
if (!fs.existsSync(modelFile)) {
  console.error('Model file not found:', modelFile)
  return null
}
```

### 3. 资源清理

识别完成后及时释放资源：

```javascript
stream.free()
fs.unlinkSync(tempWavPath)
```

### 4. 配置验证

使用前检查配置完整性：

```typescript
if (!settings.stt.sherpaOnnx) {
  throw new Error('语音识别配置错误')
}
```

### 5. 构建配置

确保模型文件被打包到应用中：

```yaml
# electron-builder.yml
files:
  - dist/**/*
  - dist-electron/**/*
  - build/models/**/*  # 包含模型文件
  - package.json
```

---

## 性能优化建议

1. **模型缓存：** 识别器创建后可以重复使用，不要每次识别都重新创建
2. **音频预处理：** 在前端完成音频格式转换，减少 IPC 传输数据量
3. **临时文件管理：** 定期清理 temp 目录中的音频文件
4. **多线程：** 可以通过 `numThreads` 配置调整线程数（默认 1）

---

## 文件结构

```
project/
├── build/
│   └── models/
│       └── sherpa-onnx-paraformer-zh-small-2024-03-09/
│           ├── model.int8.onnx
│           └── tokens.txt
├── electron/
│   ├── main.js          # IPC 处理和识别器创建
│   └── preload.js       # API 暴露
├── src/
│   ├── composables/
│   │   ├── useSherpaOnnx.ts    # 前端调用接口
│   │   └── useVoiceRecorder.ts # 录音逻辑
│   ├── utils/
│   │   └── audioConverter.ts   # 音频格式转换
│   ├── types/
│   │   └── settings.ts         # 类型定义
│   └── stores/
│       └── settingsStore.ts    # 配置管理
└── doc/
    └── sherpa-onnx-integration-guide.md  # 本文档
```

---

## 参考资源

- [Sherpa-ONNX GitHub](https://github.com/k2-fsa/sherpa-onnx)
- [Node.js 示例](https://github.com/k2-fsa/sherpa-onnx/tree/master/nodejs-examples)
- [模型下载](https://github.com/k2-fsa/sherpa-onnx/releases)

---

## 总结

集成 Sherpa-ONNX 的关键点：

1. **正确的 API 调用方式** - 使用工厂函数而非构造函数
2. **正确的配置格式** - `modelConfig` 字段和层级关系
3. **音频格式转换** - webm/opus → WAV (16kHz, 16bit)
4. **IPC 数据传输** - ArrayBuffer 需要转换为普通数组
5. **路径处理** - 开发/生产环境的多路径兼容

通过以上步骤，可以实现完全离线的中文语音识别，无需网络连接，保护用户隐私。
