# 在 CanvasView 中使用 Sherpa-Onnx

## 当前实现

目前 `CanvasView.vue` 使用的是 `transcribeWithFunASR`。要切换到 sherpa-onnx，需要修改导入和调用方式。

## 修改步骤

### 1. 修改导入

在 `src/views/CanvasView.vue` 中：

```typescript
// 替换这一行：
import { transcribeWithFunASR } from '@/composables/useFunASR'

// 为：
import { useSherpaOnnx } from '@/composables/useSherpaOnnx'
```

### 2. 添加 Composable

在组件的 setup 部分添加：

```typescript
const { transcribe: transcribeWithSherpaOnnx } = useSherpaOnnx()
```

### 3. 修改 handleTranscription 函数

```typescript
async function handleTranscription(node: CanvasNode) {
  const settings = settingsStore.settings

  try {
    projectStore.updateNode(node.id, { transcriptStatus: 'processing' })

    const appDataPath = await window.electronAPI.getAppPath('userData')
    const project = projectStore.currentProject
    if (!project) return

    const audioPath = `${appDataPath}/projects/${project.id}/${node.audioPath}`
    const result = await window.electronAPI.readFile(audioPath, 'arraybuffer')

    if (result.success && result.data) {
      const blob = new Blob([result.data], { type: 'audio/webm' })
      
      // 根据配置选择不同的识别方式
      let transcriptResult
      if (settings.stt.provider === 'sherpa-onnx') {
        transcriptResult = await transcribeWithSherpaOnnx(blob)
      } else if (settings.stt.provider === 'funasr') {
        const { transcribeWithFunASR } = await import('@/composables/useFunASR')
        transcriptResult = await transcribeWithFunASR(blob, settings.stt.funasr)
      } else if (settings.stt.provider === 'whisper') {
        const { transcribeWithWhisper } = await import('@/composables/useWhisper')
        transcriptResult = await transcribeWithWhisper(blob, settings.stt.whisper)
      }

      if (transcriptResult.success && transcriptResult.text) {
        projectStore.updateNode(node.id, {
          transcript: transcriptResult.text,
          transcriptStatus: 'done'
        })

        // 转写完成后自动触发 AI 回答
        if (aiAnswerEnabled.value) {
          handleAgentResponse(node.id, transcriptResult.text)
        }
      } else {
        throw new Error(transcriptResult.error || '转写失败')
      }
    }
  } catch (error) {
    projectStore.updateNode(node.id, {
      transcript: String(error),
      transcriptStatus: 'error'
    })
  }
}
```

## 完整示例

以下是完整的修改示例：

```vue
<script setup lang="ts">
// ... 其他导入

import { useVoiceRecorder } from '@/composables/useVoiceRecorder'
import { useSherpaOnnx } from '@/composables/useSherpaOnnx'
import { chatWithLLM, buildFullContextMessages } from '@/composables/useQwenAgent'

// ... 其他代码

const { transcribe: transcribeWithSherpaOnnx } = useSherpaOnnx()

// ... 其他代码

async function handleTranscription(node: CanvasNode) {
  const settings = settingsStore.settings

  try {
    projectStore.updateNode(node.id, { transcriptStatus: 'processing' })

    const appDataPath = await window.electronAPI.getAppPath('userData')
    const project = projectStore.currentProject
    if (!project) return

    const audioPath = `${appDataPath}/projects/${project.id}/${node.audioPath}`
    const result = await window.electronAPI.readFile(audioPath, 'arraybuffer')

    if (result.success && result.data) {
      const blob = new Blob([result.data], { type: 'audio/webm' })
      
      // 根据配置选择不同的识别方式
      let transcriptResult
      if (settings.stt.provider === 'sherpa-onnx') {
        transcriptResult = await transcribeWithSherpaOnnx(blob)
      } else if (settings.stt.provider === 'funasr') {
        const { transcribeWithFunASR } = await import('@/composables/useFunASR')
        transcriptResult = await transcribeWithFunASR(blob, settings.stt.funasr)
      } else if (settings.stt.provider === 'whisper') {
        const { transcribeWithWhisper } = await import('@/composables/useWhisper')
        transcriptResult = await transcribeWithWhisper(blob, settings.stt.whisper)
      }

      if (transcriptResult.success && transcriptResult.text) {
        projectStore.updateNode(node.id, {
          transcript: transcriptResult.text,
          transcriptStatus: 'done'
        })

        // 转写完成后自动触发 AI 回答
        if (aiAnswerEnabled.value) {
          handleAgentResponse(node.id, transcriptResult.text)
        }
      } else {
        throw new Error(transcriptResult.error || '转写失败')
      }
    }
  } catch (error) {
    projectStore.updateNode(node.id, {
      transcript: String(error),
      transcriptStatus: 'error'
    })
  }
}

// ... 其他代码
</script>
```

## 优势

使用动态导入的好处：
1. **按需加载**：只有在使用时才加载对应的模块
2. **减小包体积**：不使用的识别方式不会被打包
3. **灵活切换**：用户可以在设置中自由切换识别引擎

## 测试

修改完成后，测试以下场景：

1. **默认配置**（sherpa-onnx）
   - 录音 → 自动识别 → 显示结果

2. **切换到 FunASR**
   - 在设置中选择 FunASR
   - 录音 → 调用 FunASR 服务 → 显示结果

3. **切换到 Whisper**
   - 在设置中选择 Whisper
   - 录音 → 调用 OpenAI API → 显示结果

## 注意事项

1. **首次使用**：确保已运行 `npm run download:sherpa-model`
2. **错误处理**：所有识别方式都有统一的错误处理
3. **性能监控**：可以在识别前后添加时间戳，监控性能

## 扩展

如果需要支持更多识别引擎，只需：
1. 创建对应的 composable（如 `useXYZ.ts`）
2. 在 `handleTranscription` 中添加判断逻辑
3. 更新 `settings.ts` 中的类型定义
