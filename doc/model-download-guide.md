# 模型自动下载功能说明

## 概述

本项目集成了 Sherpa-ONNX 语音识别模型自动下载功能，在构建应用时会自动下载所需的模型文件。

**模型信息：**
- 名称：`sherpa-onnx-paraformer-zh-small-2024-03-09`
- 大小：约 82MB（压缩后约 30MB）
- 语言：中文
- 类型：离线语音识别（非流式）

## 自动下载

### 构建时自动下载

运行以下命令时，会自动检查并下载模型：

```bash
# 开发模式
npm run electron:dev

# 构建应用
npm run build
npm run electron:build
npm run electron:build:win
npm run electron:build:mac
```

### 手动下载

如果需要手动下载模型：

```bash
npm run download-model
```

## 下载源

**GitHub Releases**
- URL: `https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-paraformer-zh-small-2024-03-09.tar.bz2`
- 速度取决于网络环境

## 模型存储位置

下载的模型会存储在：

```
build/models/sherpa-onnx-paraformer-zh-small-2024-03-09/
├── model.int8.onnx    # 模型文件（约 82MB）
├── tokens.txt         # 词表文件
├── config.yaml        # 配置文件
└── test_wavs/         # 测试音频
```

## 模型打包

模型文件会在构建时自动下载并打包到应用中：

- 构建命令（`npm run build` 等）会自动触发 `npm run download-model`
- 模型文件会被包含在最终的应用安装包中
- 应用启动时直接使用打包的模型，无需额外下载

## 常见问题

### Q: 下载速度慢或失败怎么办？

**A:** 可以尝试以下方法：

1. 使用代理或 VPN 访问 GitHub
2. 手动下载模型文件：
   ```bash
   # 从浏览器下载
   wget https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-paraformer-zh-small-2024-03-09.tar.bz2

   # 解压到 build/models 目录
   tar -xjf sherpa-onnx-paraformer-zh-small-2024-03-09.tar.bz2 -C build/models/
   ```

### Q: 可以更换其他模型吗？

**A:** 可以，修改 `scripts/download-model.js` 中的配置：

```javascript
const MODEL_CONFIG = {
  name: 'your-model-name',
  url: 'https://your-model-url.tar.bz2',
  // ...
}
```

支持的模型格式：
- Paraformer（中文）
- Whisper（多语言）
- SenseVoice（中文，支持标点）
- 其他 Sherpa-ONNX 支持的模型

### Q: 模型文件会被打包到应用中吗？

**A:** 是的，模型文件会被包含在最终的应用包中。在 `electron-builder.yml` 中配置：

```yaml
files:
  - build/models/**/*  # 包含模型文件
```

### Q: 如何减小应用体积？

**A:** 模型文件占用了大部分体积（约 82MB），可以考虑：

1. 使用更小的模型（如量化版本）
2. 首次启动时下载模型（而不是打包）
3. 使用外部模型路径（用户自行下载）

## 手动安装模型

如果自动下载失败，可以手动安装：

1. 下载模型压缩包：
   ```bash
   wget https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-paraformer-zh-small-2024-03-09.tar.bz2
   ```

2. 解压到项目目录：
   ```bash
   mkdir -p build/models
   tar -xjf sherpa-onnx-paraformer-zh-small-2024-03-09.tar.bz2 -C build/models/
   ```

3. 验证文件：
   ```bash
   ls build/models/sherpa-onnx-paraformer-zh-small-2024-03-09/
   # 应该包含：model.int8.onnx, tokens.txt, config.yaml
   ```

## 脚本说明

### `scripts/download-model.js`

自动下载脚本，功能包括：
- 检查模型是否已存在
- 从 GitHub Releases 下载模型
- 显示下载进度
- 自动解压 tar.bz2 文件
- 验证模型完整性

## 技术细节

### 下载实现

使用 Node.js 原生 `https` 模块实现：
- 支持 HTTP 重定向
- 显示下载进度
- 超时处理（5分钟）

### 解压实现

使用系统 `tar` 命令：
- Windows：使用 PowerShell 或 Git Bash 的 tar
- Linux/Mac：使用系统 tar

### 错误处理

- 文件大小检查（防止下载到错误页面）
- 完整性验证（检查必需文件）

## 相关文件

- `scripts/download-model.js` - 下载脚本
- `package.json` - 构建脚本配置
- `electron-builder.yml` - 打包配置

## 参考链接

- [Sherpa-ONNX 模型库](https://github.com/k2-fsa/sherpa-onnx/releases/tag/asr-models)
- [Paraformer 模型说明](https://k2-fsa.github.io/sherpa/onnx/pretrained_models/paraformer.html)
- [ModelScope 模型库](https://modelscope.cn/models/crazyant/speech_paraformer_asr_nat-zh-cn-16k-common-vocab8358-onnx/summary)
