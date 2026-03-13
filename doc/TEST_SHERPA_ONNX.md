# Sherpa-Onnx 集成测试指南

## 测试步骤

### 1. 下载模型

```bash
npm run download:sherpa-model
```

预期输出：
```
=== Sherpa-Onnx 模型下载工具 ===

开始下载模型: https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-paraformer-zh-small-2024-03-09.tar.bz2
保存到: D:\Workspace\qwen\oneday_v2\build\models\model.tar.bz2
文件大小: 86.23 MB
下载进度: 100.00%
下载完成!
解压文件到: D:\Workspace\qwen\oneday_v2\build\models\sherpa-onnx-paraformer-zh-small-2024-03-09
解压完成!

✓ 模型文件验证成功
模型路径: D:\Workspace\qwen\oneday_v2\build\models\sherpa-onnx-paraformer-zh-small-2024-03-09
模型文件: model.int8.onnx
词表文件: tokens.txt

=== 模型下载完成! ===
```

### 2. 启动开发服务器

```bash
npm run electron:dev
```

### 3. 检查控制台日志

在 Electron 开发者工具控制台中，应该看到：

```
[SherpaOnnxEngine] 初始化成功
```

如果没有看到，检查：
- 模型文件是否存在于 `build/models/sherpa-onnx-paraformer-zh-small-2024-03-09/`
- 主进程控制台是否有错误信息

### 4. 测试语音识别

在应用中：
1. 点击录音按钮开始录音
2. 说一些中文（例如："今天天气很好"）
3. 停止录音
4. 查看识别结果

预期结果：
- 识别成功，显示转写文本
- 控制台无错误信息

### 5. 检查设置

在设置页面中：
- STT Provider 应该默认为 "sherpa-onnx"
- 不需要配置 API Key 或服务器地址

## 常见测试场景

### 场景 1: 首次启动

**步骤**：
1. 清除用户数据（删除 `%APPDATA%\OneHand` 或 `~/Library/Application Support/OneHand`）
2. 启动应用
3. 检查是否自动初始化 sherpa-onnx

**预期**：
- 应用正常启动
- 自动初始化引擎
- 可以正常录音识别

### 场景 2: 离线使用

**步骤**：
1. 断开网络连接
2. 启动应用
3. 录音并识别

**预期**：
- 应用正常工作
- 识别功能不受影响（因为是本地引擎）

### 场景 3: 切换识别引擎

**步骤**：
1. 在设置中将 STT Provider 改为 "whisper" 或 "funasr"
2. 测试识别
3. 改回 "sherpa-onnx"
4. 测试识别

**预期**：
- 不同引擎可以正常切换
- sherpa-onnx 无需额外配置即可使用

### 场景 4: 打包测试

**步骤**：
```bash
npm run download:sherpa-model
npm run electron:build:win
```

安装生成的安装包，测试识别功能。

**预期**：
- 打包成功，无错误
- 安装后可以正常识别
- 模型文件被正确包含在安装包中

## 调试技巧

### 查看主进程日志

在开发模式下，主进程日志会输出到终端：

```bash
npm run electron:dev
```

查看是否有：
- `[SherpaOnnxEngine] 初始化成功`
- 模型加载相关日志

### 查看渲染进程日志

打开 Electron 开发者工具（F12），查看 Console 标签：

- 检查 `useSherpaOnnx` 的初始化状态
- 查看识别请求和响应

### 手动测试 API

在渲染进程的控制台中：

```javascript
// 测试初始化
await window.electronAPI.sherpaOnnx.initialize()

// 测试识别（需要先有音频数据）
const audioContext = new AudioContext({ sampleRate: 16000 })
// ... 录制或加载音频
```

## 性能测试

### 初始化时间

在控制台中：

```javascript
console.time('sherpa-init')
await window.electronAPI.sherpaOnnx.initialize()
console.timeEnd('sherpa-init')
```

预期：`< 500ms`

### 识别延迟

```javascript
const audioBlob = // ... 获取音频 Blob
console.time('sherpa-transcribe')
const result = await window.electronAPI.sherpaOnnx.transcribe(Array.from(audioData))
console.timeEnd('sherpa-transcribe')
```

预期：根据音频长度，实时率 0.1-0.3

## 故障排查

### 问题 1: 模型文件缺失

**错误信息**：
```
Error: 模型文件缺失: D:\...\model.int8.onnx
```

**解决**：
```bash
npm run download:sherpa-model
```

### 问题 2: 模块加载失败

**错误信息**：
```
Cannot find module 'sherpa-onnx'
```

**解决**：
```bash
npm install sherpa-onnx
```

### 问题 3: 初始化失败

**错误信息**：
```
[SherpaOnnxEngine] 初始化失败: ...
```

**解决**：
1. 检查模型文件是否完整
2. 检查 Node.js 版本（建议 16+）
3. 查看详细错误信息

### 问题 4: 识别结果为空

**可能原因**：
- 音频格式不正确（采样率不是 16kHz）
- 音频数据为空
- 音频质量太差

**解决**：
- 检查 `blobToFloat32Array` 函数的输出
- 确保录音正常工作
- 尝试更清晰的音频

## 完整测试清单

- [ ] 模型下载成功
- [ ] 应用启动正常
- [ ] 引擎初始化成功
- [ ] 录音功能正常
- [ ] 识别功能正常
- [ ] 识别结果准确
- [ ] 离线模式正常
- [ ] 设置页面显示正确
- [ ] 打包后功能正常
- [ ] 无内存泄漏（长时间使用）
- [ ] 性能符合预期

## 测试数据

准备一些测试音频：

1. **短句**（1-3 秒）
   - "你好"
   - "今天天气很好"

2. **中等长度**（5-10 秒）
   - "我想记录今天的会议内容"
   - "这个功能非常实用，我很喜欢"

3. **长文本**（20-30 秒）
   - 一段完整的叙述或说明

对比识别结果与原文，评估准确率。

## 性能基准

| 指标 | 目标值 | 实测值 |
|------|--------|--------|
| 初始化时间 | < 500ms | - |
| 内存占用 | < 500MB | - |
| 识别延迟（5秒音频） | < 2秒 | - |
| 实时率 | < 0.5 | - |
| 准确率 | > 90% | - |

填写实测值以建立性能基准。
