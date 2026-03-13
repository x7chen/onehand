# sherpa-onnx 方案详解

## 项目简介

**sherpa-onnx** 是 [k2-fsa](https://github.com/k2-fsa) 组织开发的语音识别推理框架，基于 ONNX Runtime 实现，支持多种语音识别模型架构。

- **GitHub**: https://github.com/k2-fsa/sherpa-onnx
- **License**: Apache 2.0（可商用）
- **核心语言**: C++（提供多语言绑定）

---

## 核心特性

### 1. 支持的模型架构

| 模型类型 | 说明 | 与 FunASR 兼容性 |
|----------|------|------------------|
| **Paraformer** | 阿里巴巴达摩院提出的非自回归模型 | ✅ FunASR 主力模型 |
| **Conformer** | Google 提出的卷积增强 Transformer | ✅ 支持 |
| **Transducer** | RNN-T / Conformer-Transducer | ✅ 支持 |
| **CTC** | 传统 CTC 模型 | ✅ 支持 |
| **Whisper** | OpenAI Whisper 模型 | ✅ 支持 |
| **SenseVoice** | 阿里巴巴多语言模型 | ✅ FunASR 已集成 |

### 2. 编程语言支持

| 语言 | 支持状态 | 适用场景 |
|------|----------|----------|
| **C++** | ✅ 原生 | 核心引擎 |
| **Python** | ✅ 完整 | 快速原型 |
| **Node.js** | ✅ 完整 | **Electron 首选** |
| **Java** | ✅ 完整 | Android |
| **Kotlin** | ✅ 完整 | Android |
| **C#** | ✅ 完整 | Windows/.NET |
| **Go** | ✅ 完整 | 后端服务 |
| **Rust** | ✅ 完整 | 系统级应用 |
| **Swift** | ✅ 完整 | iOS/macOS |
| **Flutter** | ✅ 完整 | 跨平台移动 |

### 3. 平台支持

- **Windows** x64/x86
- **macOS** x64/ARM64 (Apple Silicon)
- **Linux** x64/ARM64/ARM32
- **Android** ARM64/ARM32/x86_64
- **iOS** ARM64
- **WebAssembly** (实验性)

---

## 架构详解

### 整体架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Electron 应用                                │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                      渲染进程 (Vue 3)                          │  │
│  │  ┌─────────────────────────────────────────────────────────┐  │  │
│  │  │  Vue 组件 → useSpeechRecognition.ts → IPC 调用          │  │  │
│  │  └─────────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                              ↓ IPC                                  │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                      主进程 (Node.js)                          │  │
│  │  ┌─────────────────────────────────────────────────────────┐  │  │
│  │  │  IPC Handler → sherpa-onnx Node.js API                   │  │  │
│  │  │  ┌───────────────────────────────────────────────────┐  │  │  │
│  │  │  │           sherpa-onnx Native Addon                 │  │  │  │
│  │  │  │  ┌─────────────────────────────────────────────┐  │  │  │  │
│  │  │  │  │        ONNX Runtime C++ Core                 │  │  │  │  │
│  │  │  │  │  ┌───────────────────────────────────────┐  │  │  │  │  │
│  │  │  │  │  │     Paraformer ONNX 模型文件           │  │  │  │  │  │
│  │  │  │  │  └───────────────────────────────────────┘  │  │  │  │  │
│  │  │  │  └─────────────────────────────────────────────┘  │  │  │  │
│  │  │  └───────────────────────────────────────────────────┘  │  │  │
│  │  └─────────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### Node.js 绑定架构

```
sherpa-onnx Node.js 模块
│
├── 预编译二进制文件 (prebuilt binaries)
│   ├── sherpa-onnx-darwin-x64/
│   ├── sherpa-onnx-darwin-arm64/
│   ├── sherpa-onnx-win32-x64/
│   ├── sherpa-onnx-linux-x64/
│   └── ...
│
├── JavaScript API 封装
│   ├── OfflineRecognizer (离线识别)
│   ├── OnlineRecognizer (实时流式识别)
│   ├── Tts (语音合成)
│   └── KeywordSpotter (关键词唤醒)
│
└── TypeScript 类型定义
    └── index.d.ts
```

---

## 模型准备

### FunASR 模型转换

FunASR 的 Paraformer 模型需要转换为 sherpa-onnx 格式：

#### 1. 下载 FunASR 模型

```bash
# 从 ModelScope 下载
pip install modelscope
python -c "from modelscope import snapshot_download; snapshot_download('damo/speech_paraformer-large_asr_nat-zh-cn-16k-common-vocab8404-pytorch', cache_dir='./models')"
```

#### 2. 转换为 ONNX

```bash
# 使用 FunASR 导出工具
pip install funasr

python -c "
from funasr import AutoModel

model = AutoModel(
    model='damo/speech_paraformer-large_asr_nat-zh-cn-16k-common-vocab8404-pytorch',
    device='cpu',
)

# 导出为 ONNX
model.export(quantize=False, onnx_dir='./onnx_model')
"
```

#### 3. 生成 sherpa-onnx 配置文件

```yaml
# model_config.yaml
model_type: paraformer
encoder: model.onnx  # 或 encoder.onnx
decoder: decoder.onnx
tokenizer: tokens.txt
sample_rate: 16000
feature_dim: 80
num_threads: 4
provider: cpu
```

### 预编译模型（推荐）

sherpa-onnx 官方提供预转换好的模型：

| 模型 | 语言 | 大小 | 下载地址 |
|------|------|------|----------|
| sherpa-onnx-paraformer-zh-2024-03-09 | 中文 | 230MB | [下载](https://github.com/k2-fsa/sherpa-onnx/releases) |
| sherpa-onnx-paraformer-zh-small-2024-03-09 | 中文 | 86MB | [下载](https://github.com/k2-fsa/sherpa-onnx/releases) |
| sherpa-onnx-paraformer-en-2024-03-09 | 英文 | 210MB | [下载](https://github.com/k2-fsa/sherpa-onnx/releases) |
| sherpa-onnx-whisper-tiny | 多语言 | 75MB | [下载](https://github.com/k2-fsa/sherpa-onnx/releases) |
| sherpa-onnx-whisper-base | 多语言 | 145MB | [下载](https://github.com/k2-fsa/sherpa-onnx/releases) |

**推荐**: 使用 `sherpa-onnx-paraformer-zh-small` 版本，体积小且识别效果良好。

---

## Electron 集成实现

### 1. 安装依赖

```bash
# 安装 sherpa-onnx
npm install sherpa-onnx

# 安装 electron-rebuild（用于重新编译原生模块）
npm install --save-dev electron-rebuild
```

### 2. 配置 electron-rebuild

```json
// package.json
{
  "scripts": {
    "rebuild": "electron-rebuild -f -w sherpa-onnx",
    "postinstall": "electron-builder install-app-deps"
  }
}
```

### 3. 主进程实现

```typescript
// electron/asr/sherpa-onnx-engine.ts
import * as sherpa_onnx from 'sherpa-onnx';
import * as path from 'path';
import { app } from 'electron';
import * as fs from 'fs';

interface ASRResult {
  text: string;
  success: boolean;
  error?: string;
}

class SherpaOnnxEngine {
  private recognizer: sherpa_onnx.OfflineRecognizer | null = null;
  private isInitialized = false;

  /**
   * 初始化识别引擎
   */
  async initialize(): Promise<void> {
    try {
      // 获取模型路径（支持开发和生产环境）
      const modelDir = this.getModelPath();
      
      // 验证模型文件存在
      this.validateModelFiles(modelDir);

      // 配置离线识别器
      const config = new sherpa_onnx.OfflineRecognizerConfig();
      
      // Paraformer 模型配置
      config.paraformer = new sherpa_onnx.OfflineParaformerModelConfig();
      config.paraformer.model = path.join(modelDir, 'model.onnx');
      
      // Tokenizer 配置
      config.tokens = path.join(modelDir, 'tokens.txt');
      
      // 特征提取配置
      config.featConfig = new sherpa_onnx.FeatureConfig();
      config.featConfig.sampleRate = 16000;
      config.featConfig.featureDim = 80;
      
      // 解码配置
      config.decodingMethod = 'greedy_search';
      
      // 线程和硬件配置
      config.numThreads = 4;
      config.provider = 'cpu'; // 或 'cuda'（需要 CUDA 支持）
      
      // 创建识别器
      this.recognizer = new sherpa_onnx.OfflineRecognizer(config);
      this.isInitialized = true;
      
      console.log('[SherpaOnnxEngine] 初始化成功');
    } catch (error) {
      console.error('[SherpaOnnxEngine] 初始化失败:', error);
      throw error;
    }
  }

  /**
   * 语音识别
   * @param audioBuffer 音频数据 (Float32Array, 16kHz, 单声道)
   */
  async transcribe(audioBuffer: Float32Array): Promise<ASRResult> {
    if (!this.isInitialized || !this.recognizer) {
      return {
        text: '',
        success: false,
        error: '引擎未初始化'
      };
    }

    try {
      // 创建识别流
      const stream = this.recognizer.createStream();
      
      // 接受音频数据
      stream.acceptWaveform({
        sampleRate: 16000,
        samples: audioBuffer,
      });
      
      // 解码
      this.recognizer.decode(stream);
      
      // 获取结果
      const result = stream.getResult();
      
      // 释放资源
      stream.free();
      
      return {
        text: result.text,
        success: true
      };
    } catch (error) {
      console.error('[SherpaOnnxEngine] 识别失败:', error);
      return {
        text: '',
        success: false,
        error: error instanceof Error ? error.message : '识别失败'
      };
    }
  }

  /**
   * 从文件识别
   */
  async transcribeFile(audioFilePath: string): Promise<ASRResult> {
    try {
      // 读取音频文件并解码
      const audioData = await this.readAudioFile(audioFilePath);
      return this.transcribe(audioData);
    } catch (error) {
      return {
        text: '',
        success: false,
        error: error instanceof Error ? error.message : '文件读取失败'
      };
    }
  }

  /**
   * 释放资源
   */
  dispose(): void {
    if (this.recognizer) {
      this.recognizer.free();
      this.recognizer = null;
    }
    this.isInitialized = false;
  }

  /**
   * 获取模型路径
   */
  private getModelPath(): string {
    const isDev = !app.isPackaged;
    
    if (isDev) {
      // 开发环境：项目根目录
      return path.join(__dirname, '../../build/models/sherpa-onnx-paraformer-zh');
    } else {
      // 生产环境：应用资源目录
      return path.join(process.resourcesPath, 'models/sherpa-onnx-paraformer-zh');
    }
  }

  /**
   * 验证模型文件
   */
  private validateModelFiles(modelDir: string): void {
    const requiredFiles = ['model.onnx', 'tokens.txt'];
    
    for (const file of requiredFiles) {
      const filePath = path.join(modelDir, file);
      if (!fs.existsSync(filePath)) {
        throw new Error(`模型文件缺失: ${filePath}`);
      }
    }
  }

  /**
   * 读取音频文件（需要实现音频解码）
   */
  private async readAudioFile(filePath: string): Promise<Float32Array> {
    // 使用 ffmpeg 或 node-wav 解码音频
    // 这里需要实现具体的音频解码逻辑
    // 返回 16kHz 单声道 Float32Array
    throw new Error('需要实现音频解码');
  }
}

export const sherpaOnnxEngine = new SherpaOnnxEngine();
```

### 4. IPC 通信封装

```typescript
// electron/ipc/asr-handlers.ts
import { ipcMain } from 'electron';
import { sherpaOnnxEngine } from '../asr/sherpa-onnx-engine';

export function registerASRHandlers(): void {
  // 初始化引擎
  ipcMain.handle('asr:initialize', async () => {
    try {
      await sherpaOnnxEngine.initialize();
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : '初始化失败' 
      };
    }
  });

  // 语音识别
  ipcMain.handle('asr:transcribe', async (_, audioData: number[]) => {
    const result = await sherpaOnnxEngine.transcribe(new Float32Array(audioData));
    return result;
  });

  // 从文件识别
  ipcMain.handle('asr:transcribe-file', async (_, filePath: string) => {
    const result = await sherpaOnnxEngine.transcribeFile(filePath);
    return result;
  });
}
```

### 5. 预加载脚本

```typescript
// electron/preload.ts
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // ASR 相关
  asr: {
    initialize: () => ipcRenderer.invoke('asr:initialize'),
    transcribe: (audioData: number[]) => ipcRenderer.invoke('asr:transcribe', audioData),
    transcribeFile: (filePath: string) => ipcRenderer.invoke('asr:transcribe-file', filePath),
  },
});
```

### 6. 渲染进程使用

```typescript
// src/composables/useSherpaOnnx.ts
import { ref } from 'vue';

export function useSherpaOnnx() {
  const isInitializing = ref(false);
  const isReady = ref(false);
  const error = ref<string | null>(null);

  /**
   * 初始化引擎
   */
  async function initialize(): Promise<boolean> {
    isInitializing.value = true;
    error.value = null;
    
    try {
      const result = await window.electronAPI.asr.initialize();
      isReady.value = result.success;
      
      if (!result.success) {
        error.value = result.error || '初始化失败';
      }
      
      return result.success;
    } catch (e) {
      error.value = e instanceof Error ? e.message : '未知错误';
      return false;
    } finally {
      isInitializing.value = false;
    }
  }

  /**
   * 语音识别
   */
  async function transcribe(audioBlob: Blob): Promise<{ text: string; success: boolean }> {
    if (!isReady.value) {
      return { text: '', success: false };
    }

    try {
      // 将 Blob 转换为 Float32Array
      const audioData = await blobToFloat32Array(audioBlob);
      const result = await window.electronAPI.asr.transcribe(Array.from(audioData));
      return result;
    } catch (e) {
      return { 
        text: '', 
        success: false 
      };
    }
  }

  /**
   * Blob 转 Float32Array
     */
  async function blobToFloat32Array(blob: Blob): Promise<Float32Array> {
    // 使用 Web Audio API 解码音频
    const audioContext = new AudioContext({ sampleRate: 16000 });
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    // 转换为单声道
    const channelData = audioBuffer.getChannelData(0);
    return new Float32Array(channelData);
  }

  return {
    isInitializing,
    isReady,
    error,
    initialize,
    transcribe,
  };
}
```

### 7. 音频解码实现

由于 sherpa-onnx 需要原始音频数据，需要实现音频解码：

#### 方案 A：使用 ffmpeg（推荐）

```typescript
// electron/utils/audio-decoder.ts
import { spawn } from 'child_process';
import * as path from 'path';
import { app } from 'electron';

export async function decodeAudioFile(
  inputPath: string
): Promise<{ sampleRate: number; samples: Float32Array }> {
  return new Promise((resolve, reject) => {
    const ffmpegPath = getFFmpegPath();
    const args = [
      '-i', inputPath,
      '-ar', '16000',      // 采样率 16kHz
      '-ac', '1',          // 单声道
      '-f', 'f32le',       // 32位浮点格式
      '-acodec', 'pcm_f32le',
      '-',                 // 输出到 stdout
    ];

    const ffmpeg = spawn(ffmpegPath, args);
    const chunks: Buffer[] = [];

    ffmpeg.stdout.on('data', (chunk) => chunks.push(chunk));
    ffmpeg.stderr.on('data', (data) => {
      // ffmpeg 输出信息到 stderr，可以忽略或记录
      console.log('[ffmpeg]', data.toString());
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        const buffer = Buffer.concat(chunks);
        const samples = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.length / 4);
        resolve({ sampleRate: 16000, samples });
      } else {
        reject(new Error(`ffmpeg 退出码: ${code}`));
      }
    });

    ffmpeg.on('error', reject);
  });
}

function getFFmpegPath(): string {
  const isDev = !app.isPackaged;
  if (isDev) {
    return 'ffmpeg'; // 假设开发环境已安装
  }
  // 生产环境使用打包的 ffmpeg
  return path.join(process.resourcesPath, 'ffmpeg', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
}
```

#### 方案 B：使用 Node.js 音频库

```bash
npm install wav audio-decode
```

```typescript
import * as wav from 'wav';
import * as fs from 'fs';

export async function decodeWavFile(filePath: string): Promise<Float32Array> {
  const reader = new wav.Reader();
  const chunks: Buffer[] = [];
  
  return new Promise((resolve, reject) => {
    reader.on('format', (format) => {
      console.log('WAV format:', format);
    });
    
    reader.on('data', (chunk) => chunks.push(chunk));
    
    reader.on('end', () => {
      const buffer = Buffer.concat(chunks);
      // 根据采样率和声道数转换
      const samples = new Float32Array(buffer.length / 2);
      for (let i = 0; i < samples.length; i++) {
        samples[i] = buffer.readInt16LE(i * 2) / 32768;
      }
      resolve(samples);
    });
    
    reader.on('error', reject);
    
    fs.createReadStream(filePath).pipe(reader);
  });
}
```

---

## 打包配置

### electron-builder.yml

```yaml
appId: com.onehand.app
productName: OneHand

# 原生模块配置
nativeRebuilds:
  - name: sherpa-onnx
    arch: [x64, arm64]

# 额外资源
extraResources:
  # 模型文件
  - from: build/models
    to: models
    filter:
      - "**/*"
  # ffmpeg（用于音频解码）
  - from: build/ffmpeg/${platform}
    to: ffmpeg
    filter:
      - "**/*"

# 文件复制
files:
  - dist-electron/**
  - dist/**
  - node_modules/sherpa-onnx/**
  - package.json

# 平台特定配置
win:
  target:
    - nsis
    - portable

mac:
  target:
    - dmg
    - zip
  arch:
    - x64
    - arm64

linux:
  target:
    - AppImage
    - deb
```

### 模型下载脚本

```bash
#!/bin/bash
# download-models.sh

MODEL_DIR="build/models/sherpa-onnx-paraformer-zh"
mkdir -p "$MODEL_DIR"

# 下载模型文件
MODEL_URL="https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-paraformer-zh-small-2024-03-09.tar.bz2"

curl -L "$MODEL_URL" -o model.tar.bz2
tar -xjf model.tar.bz2 -C "$MODEL_DIR" --strip-components=1
rm model.tar.bz2

echo "模型下载完成: $MODEL_DIR"
```

---

## 性能优化

### 1. 模型量化

使用 INT8 量化模型减小体积和提升速度：

```python
# 量化脚本
import onnx
from onnxruntime.quantization import quantize_dynamic, QuantType

model_fp32 = 'model.onnx'
model_quant = 'model.quant.onnx'

quantize_dynamic(
    model_input=model_fp32,
    model_output=model_quant,
    weight_type=QuantType.QInt8,
)
```

### 2. 延迟加载

```typescript
class SherpaOnnxEngine {
  private recognizer: sherpa_onnx.OfflineRecognizer | null = null;
  
  // 延迟初始化
  async ensureInitialized() {
    if (!this.recognizer) {
      await this.initialize();
    }
  }
  
  // 使用 LRU 缓存识别结果
  private cache = new LRUCache<string, ASRResult>({ max: 100 });
}
```

### 3. 多线程配置

```typescript
config.numThreads = os.cpus().length; // 使用所有 CPU 核心
```

---

## 与 FunASR 对比

| 特性 | FunASR (Python) | sherpa-onnx |
|------|-----------------|-------------|
| **启动时间** | 3-5 秒 | < 500ms |
| **内存占用** | 800MB-1.5GB | 200-400MB |
| **包体积** | 500MB-1GB | 50-100MB |
| **推理速度** | 中等 | 快（C++） |
| **热词支持** | ✅ | ✅ |
| **时间戳** | ✅ | ✅ |
| **多语言** | ✅ | ✅ |
| **实时流式** | ✅ | ✅ |
| **离线使用** | ✅ | ✅ |
| **GPU 加速** | ✅ CUDA | ✅ CUDA/DirectML |

---

## 常见问题

### 1. 原生模块编译失败

**问题**: `node-gyp` 编译错误

**解决**:
```bash
# Windows
npm install --global windows-build-tools

# macOS
xcode-select --install

# 使用预编译二进制
npm install sherpa-onnx --build-from-source=false
```

### 2. 模型加载失败

**问题**: `Error: Failed to load model`

**解决**:
- 检查模型文件路径是否正确
- 验证模型文件完整性
- 检查 ONNX Runtime 版本兼容性

### 3. 音频格式错误

**问题**: `Invalid audio format`

**解决**:
- 确保采样率为 16kHz
- 确保为单声道
- 确保数据类型为 Float32

### 4. 内存泄漏

**问题**: 长时间使用后内存增长

**解决**:
- 及时调用 `stream.free()`
- 复用 `OfflineRecognizer` 实例
- 定期调用 `global.gc()`（开发环境）

---

## 参考资源

- [sherpa-onnx GitHub](https://github.com/k2-fsa/sherpa-onnx)
- [sherpa-onnx Node.js 示例](https://github.com/k2-fsa/sherpa-onnx/tree/master/nodejs-examples)
- [ONNX Runtime](https://onnxruntime.ai/)
- [FunASR 文档](https://github.com/alibaba-damo-academy/FunASR)
