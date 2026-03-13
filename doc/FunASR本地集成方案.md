# FunASR 本地集成方案（无需单独服务器）

## 背景

当前应用通过 HTTP 调用本地 FunASR 服务 (`http://localhost:8000`)，需要用户单独启动 Python 服务器。本文档提供将 FunASR 直接集成到 Electron 应用中的方案，无需用户手动启动服务。

---

## 方案对比

| 方案 | 实现难度 | 性能 | 包体积 | 维护成本 | 推荐度 |
|------|---------|------|--------|----------|--------|
| Python 子进程 | 中 | 中 | 大 (~500MB) | 中 | ⭐⭐⭐ |
| ONNX Runtime | 高 | 高 | 中 (~100MB) | 高 | ⭐⭐ |
| sherpa-onnx | 中 | 高 | 中 (~50MB) | 低 | ⭐⭐⭐⭐ |
| WASM 方案 | 高 | 低 | 小 (~20MB) | 高 | ⭐⭐ |

---

## 方案一：Python 子进程（推荐）

### 原理
在 Electron 主进程中通过 Node.js 的 `child_process` 启动内嵌的 Python 环境，直接调用 FunASR 的 Python API 进行语音识别。

### 架构
```
┌─────────────────────────────────────────────────────────────┐
│                    Electron 主进程                           │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Node.js child_process                     │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │           内嵌 Python 运行时                      │  │  │
│  │  │  ┌───────────────────────────────────────────┐  │  │  │
│  │  │  │         FunASR 模型 + 推理代码              │  │  │  │
│  │  │  └───────────────────────────────────────────┘  │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              ↑↓ IPC
┌─────────────────────────────────────────────────────────────┐
│                   Electron 渲染进程                          │
│                    Vue 3 前端界面                            │
└─────────────────────────────────────────────────────────────┘
```

### 实现步骤

#### 1. 准备 Python 环境
```
build/
├── python-runtime/          # 嵌入式 Python（Windows: embeddable）
│   ├── python.exe
│   ├── python310.zip        # 标准库
│   └── Lib/site-packages/   # 第三方依赖
├── funasr-model/            # FunASR 模型文件
│   ├── model.pt
│   ├── config.yaml
│   └── tokens.txt
└── asr_engine.py            # 推理脚本入口
```

#### 2. 推理脚本 (asr_engine.py)
```python
#!/usr/bin/env python3
"""
FunASR 本地推理引擎
通过 STDIN/STDOUT 与 Node.js 进程通信
"""
import sys
import json
import base64
import io
from funasr import AutoModel

# 加载模型（启动时一次性加载）
model = AutoModel(
    model="FunAudioLLM/Fun-ASR-Nano-2512",
    device="cpu",  # 或 "cuda"
)

def process_audio(audio_base64: str, language: str = "中文") -> dict:
    """处理音频数据并返回识别结果"""
    audio_bytes = base64.b64decode(audio_base64)
    
    # 使用 FunASR 进行推理
    result = model.generate(
        input=io.BytesIO(audio_bytes),
        language=language,
        use_itn=True,
    )
    
    return {
        "text": result[0]["text"],
        "success": True
    }

def main():
    """主循环：监听 STDIN 输入"""
    print(json.dumps({"status": "ready"}), flush=True)
    
    for line in sys.stdin:
        try:
            request = json.loads(line.strip())
            audio_data = request.get("audio")
            language = request.get("language", "中文")
            
            result = process_audio(audio_data, language)
            print(json.dumps(result), flush=True)
            
        except Exception as e:
            print(json.dumps({
                "success": False,
                "error": str(e)
            }), flush=True)

if __name__ == "__main__":
    main()
```

#### 3. Electron 主进程集成
```typescript
// electron/main.ts
import { spawn } from 'child_process';
import path from 'path';

class FunASRLocalEngine {
  private pythonProcess: ReturnType<typeof spawn> | null = null;
  private requestQueue: Map<string, { resolve: Function; reject: Function }> = new Map();
  private requestId = 0;

  async initialize() {
    const pythonPath = path.join(__dirname, '../build/python-runtime/python.exe');
    const scriptPath = path.join(__dirname, '../build/asr_engine.py');
    
    this.pythonProcess = spawn(pythonPath, [scriptPath], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // 监听输出
    this.pythonProcess.stdout?.on('data', (data) => {
      const response = JSON.parse(data.toString());
      // 处理响应...
    });
  }

  async transcribe(audioBuffer: Buffer, language: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const requestId = ++this.requestId;
      const request = {
        id: requestId,
        audio: audioBuffer.toString('base64'),
        language
      };
      
      this.requestQueue.set(requestId.toString(), { resolve, reject });
      this.pythonProcess?.stdin?.write(JSON.stringify(request) + '\n');
    });
  }
}
```

#### 4. 打包配置 (electron-builder.yml)
```yaml
extraResources:
  - from: build/python-runtime
    to: python-runtime
    filter:
      - "**/*"
  - from: build/funasr-model
    to: funasr-model
    filter:
      - "**/*"
  - from: build/asr_engine.py
    to: asr_engine.py
```

### 优缺点

**优点：**
- 实现相对简单，复用现有 FunASR Python API
- 无需修改模型格式
- 支持 FunASR 全部功能（热词、时间戳等）

**缺点：**
- 包体积大（Python 运行时 + PyTorch + 模型 ≈ 500MB-1GB）
- 启动时间较长（需要加载 Python 和模型）
- 内存占用较高

---

## 方案二：sherpa-onnx（性能优选）

### 原理
使用 [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx) 项目，这是一个基于 ONNX Runtime 的语音识别库，支持多种模型格式（包括 Paraformer 等 FunASR 使用的架构），提供 Node.js 原生绑定。

### 架构
```
┌─────────────────────────────────────────────────────────────┐
│                    Electron 主进程                           │
│  ┌───────────────────────────────────────────────────────┐  │
│  │           Node.js 主线程                               │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │      sherpa-onnx Node.js 绑定 (Native Addon)     │  │  │
│  │  │  ┌───────────────────────────────────────────┐  │  │  │
│  │  │  │         ONNX Runtime (C++)                │  │  │  │
│  │  │  │  ┌─────────────────────────────────────┐  │  │  │  │
│  │  │  │  │      ONNX 格式模型文件               │  │  │  │  │
│  │  │  │  └─────────────────────────────────────┘  │  │  │  │
│  │  │  └───────────────────────────────────────────┘  │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 实现步骤

#### 1. 安装依赖
```bash
npm install sherpa-onnx
```

#### 2. 准备 ONNX 模型
```
build/
└── models/
    ├── paraformer.onnx        # 声学模型
    ├── tokens.txt             # 词表
    └── config.yaml            # 配置
```

#### 3. Electron 主进程代码
```typescript
// electron/asr/sherpa-onnx-engine.ts
import * as sherpa_onnx from 'sherpa-onnx';
import path from 'path';

class SherpaOnnxEngine {
  private recognizer: sherpa_onnx.OfflineRecognizer | null = null;

  initialize() {
    const modelConfig = {
      paraformer: {
        model: path.join(__dirname, '../build/models/paraformer.onnx'),
        tokens: path.join(__dirname, '../build/models/tokens.txt'),
      },
      modelType: 'paraformer',
    };

    this.recognizer = new sherpa_onnx.OfflineRecognizer(modelConfig);
  }

  transcribe(audioBuffer: Buffer): string {
    if (!this.recognizer) throw new Error('Engine not initialized');

    const stream = this.recognizer.createStream();
    // 处理音频数据...
    
    this.recognizer.decode(stream);
    const result = stream.getResult();
    
    return result.text;
  }
}
```

### 优缺点

**优点：**
- 性能优秀（C++ 推理引擎）
- 包体积相对较小（~50-100MB）
- 启动速度快
- 支持多种模型格式

**缺点：**
- 需要转换模型格式（Paraformer → ONNX）
- Node.js 原生模块在 Electron 中需要重新编译
- 功能可能不如 FunASR Python 版本完整

---

## 方案三：WASM 方案（浏览器内运行）

### 原理
将 FunASR 模型转换为 ONNX 格式，使用 ONNX Runtime Web 在浏览器/Electron 渲染进程中直接运行。

### 架构
```
┌─────────────────────────────────────────────────────────────┐
│                   Electron 渲染进程                          │
│                    Vue 3 前端界面                            │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              JavaScript 线程                           │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │      ONNX Runtime Web (WASM)                     │  │  │
│  │  │  ┌───────────────────────────────────────────┐  │  │  │
│  │  │  │      ONNX 格式模型 (加载到内存)              │  │  │  │
│  │  │  └───────────────────────────────────────────┘  │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 实现步骤

#### 1. 安装依赖
```bash
npm install onnxruntime-web
```

#### 2. Vue 组件中使用
```typescript
// src/composables/useFunASRWasm.ts
import * as ort from 'onnxruntime-web';

let session: ort.InferenceSession | null = null;

export async function initFunASRWasm() {
  session = await ort.InferenceSession.create(
    '/models/paraformer.quant.onnx',
    {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all'
    }
  );
}

export async function transcribeWithWasm(
  audioData: Float32Array
): Promise<string> {
  if (!session) throw new Error('Session not initialized');

  // 准备输入张量
  const inputTensor = new ort.Tensor('float32', audioData, [1, audioData.length]);
  
  // 运行推理
  const results = await session.run({ input: inputTensor });
  
  // 解码结果
  return decodeResults(results);
}
```

### 优缺点

**优点：**
- 无需主进程参与，完全在渲染进程运行
- 包体积最小（WASM 运行时 + 量化模型）
- 跨平台兼容性最好

**缺点：**
- 推理性能较低（WASM 比原生慢 2-5 倍）
- 模型需要量化，精度可能有损失
- 首次加载 WASM 和模型较慢
- 大模型可能导致内存问题

---

## 方案四：模型量化 + 轻量级推理引擎

### 原理
使用 MNN、NCNN 或 TNN 等移动端推理引擎，加载量化后的 FunASR 模型。

### 适用场景
- 对包体积极度敏感
- 可以接受一定的精度损失
- 目标硬件性能有限

### 实现思路
1. 将 FunASR 模型转换为 MNN/NCNN 格式
2. 使用相应的 Node.js 绑定或 C++ Addon
3. 在 Electron 主进程中加载模型并推理

---

## 推荐方案

### 短期（快速实现）
**选择方案一：Python 子进程**
- 复用现有 FunASR 能力
- 实现周期短（1-2 周）
- 功能完整

### 长期（性能优化）
**选择方案二：sherpa-onnx**
- 更好的性能
- 更小的包体积
- 更适合分发

---

## 实施路线图

### 第一阶段：Python 子进程方案（MVP）
1. 准备嵌入式 Python 环境
2. 开发 asr_engine.py 推理脚本
3. 集成到 Electron 主进程
4. 打包测试

### 第二阶段：优化和迭代
1. 模型量化减小体积
2. 实现模型懒加载/按需加载
3. 添加 GPU 支持（可选）

### 第三阶段：性能优化（可选）
1. 调研 sherpa-onnx 迁移
2. 模型格式转换
3. 性能对比测试

---

## 注意事项

### 1. 模型授权
- FunASR 模型遵循 ModelScope 许可证
- 确保符合商用要求

### 2. 包体积优化
- 使用 UPX 压缩可执行文件
- 模型量化（INT8）
- 按需加载模型组件

### 3. 首次启动体验
- 显示模型加载进度
- 支持后台预加载
- 提供快速启动选项（使用云端 API）

### 4. 兼容性
- Windows: 使用嵌入式 Python
- macOS: 使用系统 Python 或嵌入式
- Linux: 依赖系统 Python

---

## 参考资源

- [FunASR GitHub](https://github.com/alibaba-damo-academy/FunASR)
- [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx)
- [ONNX Runtime](https://onnxruntime.ai/)
- [Electron 打包 Python](https://www.electron.build/configuration/contents#extraresources)
