# PDF 页面图片发送给大模型功能设计

## 日期
2026-03-27

## 概述
为 PdfReaderView 添加将 PDF 当前页面作为图片发送给大模型的功能，支持两种场景：
1. **解释选中内容**：用户选中 PDF 文字后，右键发送给 AI 解释
2. **分析当前页面**：发送整页图片给 AI 分析

---

## 技术设计

### 1. 类型定义修改 (`src/types/api.ts`)

修改 `Message` 接口以支持 OpenAI Vision API 格式：

```typescript
// 新增：消息内容项类型
export interface MessageContentItem {
  type: 'text' | 'image_url'
  text?: string
  image_url?: {
    url: string  // base64 格式: "data:image/png;base64,..."
  }
}

// 修改 Message 接口
export interface Message {
  role: 'system' | 'user' | 'assistant'
  content: string | MessageContentItem[]  // 支持字符串或内容数组
}
```

### 2. PdfViewer 组件修改 (`src/components/PdfViewer.vue`)

#### 2.1 添加右键菜单

- 监听 `contextmenu` 事件
- 检测是否有选中文字
- 显示对应菜单项：
  - 有选中文字：「解释选中内容」
  - 无选中文字：「分析当前页面」

#### 2.2 新增方法

```typescript
// 导出当前页面为 base64 图片
async function exportPageAsImage(maxWidth: number = 1200): Promise<string>

// 获取当前选中的文字
function getSelectedText(): string
```

#### 2.3 新增事件

```typescript
emit('analyze-page', {
  imageBase64: string,
  pageNumber: number
})

emit('explain-selection', {
  imageBase64: string,
  selectedText: string,
  pageNumber: number
})
```

### 3. PdfReaderView 修改 (`src/views/PdfReaderView.vue`)

#### 3.1 监听新事件

```typescript
function handleAnalyzePage(data: { imageBase64: string; pageNumber: number })
function handleExplainSelection(data: { imageBase64: string; selectedText: string; pageNumber: number })
```

#### 3.2 创建分析节点

在 ChatPanel 中创建一个特殊节点来承载图片分析功能：
- 节点的 `transcript` 显示用户的问题或「分析当前页面」
- 节点存储图片 base64（新增字段 `imageBase64`）
- AI 回答显示在 `agentResult`

### 4. useQwenAgent 修改 (`src/composables/useQwenAgent.ts`)

#### 4.1 修改 chatWithLLM

保持接口不变，`messages` 中的 `content` 支持字符串或内容数组，JSON.stringify 会自动处理。

#### 4.2 新增辅助函数

```typescript
// 构建包含图片的消息
export function buildImageMessage(text: string, imageBase64: string): Message {
  return {
    role: 'user',
    content: [
      { type: 'text', text },
      { type: 'image_url', image_url: { url: imageBase64 } }
    ]
  }
}

// 构建图片分析请求
export function buildImageAnalysisMessages(
  imageBase64: string,
  prompt: string,
  staticContext?: string,
  dynamicContext?: string
): Message[]
```

### 5. 类型定义修改 (`src/types/notebook.ts`)

为 CanvasNode 添加可选字段：

```typescript
export interface CanvasNode {
  // ... 现有字段
  imageBase64?: string  // 存储图片分析时的图片 base64
  analysisType?: 'page' | 'selection'  // 分析类型
}
```

---

## UI 设计

### 右键菜单样式

- 半透明深色背景
- 圆角 8px
- 菜单项高度 36px，左右内边距 12px
- 悬停高亮

### 位置
- 跟随鼠标位置显示
- 边界检测，避免超出屏幕

---

## 数据流

```
用户右键点击 PDF
    ↓
PdfViewer 检测选中文字
    ↓
显示右键菜单
    ↓
用户点击菜单项
    ↓
PdfViewer 导出页面为图片 (base64)
    ↓
emit 事件给 PdfReaderView
    ↓
PdfReaderView 创建节点，调用 AI
    ↓
AI 返回结果，显示在 ChatPanel
```

---

## 文件修改清单

| 文件 | 修改内容 |
|------|----------|
| `src/types/api.ts` | 修改 Message 接口，支持 Vision 格式 |
| `src/types/notebook.ts` | CanvasNode 添加 imageBase64、analysisType 字段 |
| `src/composables/useQwenAgent.ts` | 添加构建图片消息的辅助函数 |
| `src/components/PdfViewer.vue` | 添加右键菜单、导出图片功能 |
| `src/views/PdfReaderView.vue` | 监听新事件，处理图片分析请求 |

---

## 注意事项

1. **图片大小**：中等分辨率 (1200px 宽)，base64 大小约 200-500KB
2. **模型兼容**：需要用户配置支持视觉能力的模型（GPT-4o、Qwen-VL 等）
3. **性能**：导出图片是异步操作，需要显示加载状态
4. **错误处理**：模型不支持视觉时给出友好提示