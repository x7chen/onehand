# 用户数据说明文档

## 目录结构

用户数据存储在用户文件目录下，默认为 Electron 的 `userData` 目录，用户可在设置中自定义路径。

```
用户文件目录/
├── notebooks/                 # 笔记本目录
│   ├── {notebookId}.json     # 笔记本元数据文件
│   └── {notebookId}/         # 笔记本数据目录
│       ├── audio/            # 音频文件
│       └── images/           # 图片文件
├── pdf/                       # PDF 文件目录
├── contexts/                  # 上下文文件目录
│   └── {contextId}.json      # 上下文文件
├── config.json                # 应用配置
├── tags.json                  # 标签数据
├── quickCommands.json         # 快捷指令数据
└── search-history.json        # 搜索历史
```

---

## 笔记本 (Notebook)

### 文件位置
`notebooks/{notebookId}.json`

### 数据结构

```typescript
interface Notebook {
  id: string                    // 笔记本唯一标识（时间戳）
  name: string                  // 笔记本名称
  createdAt: number             // 创建时间戳
  updatedAt: number             // 最后更新时间戳
  nodes?: CanvasNode[]          // 笔记本下的所有节点
  viewport?: Viewport           // 笔记本级视口状态
  context?: NotebookContext     // 关联的上下文配置
  pdfPath?: string              // PDF 文件路径（PDF笔记本）
  modelId?: string              // 使用的模型配置ID
  lastPdfPage?: number          // 上次查看的PDF页码（从1开始）
}

interface Viewport {
  x: number                     // 视口水平偏移
  y: number                     // 视口垂直偏移
  zoom: number                  // 缩放比例
}

interface NotebookContext {
  staticContextIds?: string[]   // 静态上下文文件ID列表
  dynamicContextId?: string     // 动态上下文文件ID
}
```

### 示例

```json
{
  "id": "1712345678901",
  "name": "工作笔记",
  "createdAt": 1712345678901,
  "updatedAt": 1712345680000,
  "nodes": [...],
  "viewport": { "x": 0, "y": 0, "zoom": 1 },
  "context": {
    "staticContextIds": ["ctx_001"],
    "dynamicContextId": "ctx_002"
  }
}
```

---

## 笔记节点 (CanvasNode)

节点是笔记本中的基本单位，支持三种类型：语音笔记、文本笔记、图片笔记。

### 数据结构

```typescript
interface CanvasNode {
  id: string                    // 节点唯一标识（UUID）
  type: 'voice-note' | 'text-note' | 'image-note'
  title?: string                // 节点标题
  width?: number                // 节点宽度（默认 CSS 变量 --node-width）
  
  // 音频相关（voice-note）
  audioPath?: string            // 音频文件相对路径
  duration?: number             // 音频时长（秒）
  
  // 图片相关（image-note）
  imagePath?: string            // 图片文件相对路径
  imageBase64?: string          // 图片base64编码（用于AI上下文，运行时）
  
  // 文本相关（text-note）
  embeddedImages?: string[]     // 内嵌图片base64数组（运行时）
  
  // 转写内容
  transcript: string | null     // 转写文本
  transcriptStatus: 'pending' | 'processing' | 'done' | 'error'
  
  // AI回答
  agentResult: string | null    // AI回答内容
  agentStatus: 'pending' | 'processing' | 'done' | 'error'
  thinkingContent?: string      // 思考过程内容（运行时）
  thinkingStatus?: 'pending' | 'processing' | 'done'  // 运行时
  
  // 上下文选择
  selectedAsContext?: boolean   // 是否选中作为上下文（运行时）
  
  // 收藏与标签
  isFavorite?: boolean          // 是否收藏
  tags?: string[]               // 标签名称列表
  
  // PDF相关
  pdfPage?: number              // 所在PDF页码
  pdfPosition?: {               // 在PDF页面上的位置
    x: number
    y: number
  }
  highlightRect?: {             // 高亮区域矩形
    x: number
    y: number
    width: number
    height: number
  }
  
  createdAt: number             // 创建时间戳
}
```

### 字段说明

| 字段 | 类型 | 存储 | 说明 |
|------|------|------|------|
| `id` | string | ✅ | UUID格式，全局唯一 |
| `type` | enum | ✅ | 节点类型 |
| `title` | string | ✅ | 可选标题 |
| `width` | number | ✅ | 用户可调整的宽度 |
| `audioPath` | string | ✅ | 相对于 `notebooks/{id}/audio/` |
| `imagePath` | string | ✅ | 相对于 `notebooks/{id}/images/` |
| `transcript` | string | ✅ | 转写文本内容 |
| `transcriptStatus` | enum | ❌ | 运行时状态，不保存 |
| `agentResult` | string | ✅ | AI回答内容 |
| `agentStatus` | enum | ❌ | 运行时状态，不保存 |
| `thinkingContent` | string | ❌ | 运行时，不保存 |
| `thinkingStatus` | enum | ❌ | 运行时状态，不保存 |
| `selectedAsContext` | boolean | ❌ | 运行时状态，不保存 |
| `imageBase64` | string | ❌ | 运行时加载，不保存 |
| `embeddedImages` | string[] | ❌ | 运行时加载，不保存 |
| `isFavorite` | boolean | ✅ | 收藏状态 |
| `tags` | string[] | ✅ | 标签名称列表 |
| `pdfPage` | number | ✅ | PDF页码 |
| `pdfPosition` | object | ✅ | PDF页面上的位置 |
| `highlightRect` | object | ✅ | PDF高亮区域 |

---

## 音频文件

### 存储位置
`notebooks/{notebookId}/audio/{filename}`

### 文件命名
- 格式：`{timestamp}-{random}.wav` 或 `.webm`
- 示例：`1712345678901-abc123.wav`

---

## 图片文件

### 存储位置
`notebooks/{notebookId}/images/{filename}`

### 文件命名
- 格式：`img-{timestamp}-{random}.{ext}`
- 示例：`img-1712345678901-abc123.png`

---

## 上下文文件 (ContextFile)

### 文件位置
`contexts/{contextId}.json`

### 数据结构

```typescript
interface ContextFile {
  id: string                    // 上下文文件唯一标识
  name: string                  // 文件名称
  type: 'static' | 'dynamic'    // 类型：静态/动态
  color: string                 // 显示颜色（预设色值）
  content: string               // Markdown 内容
  createdAt: number             // 创建时间戳
  updatedAt: number             // 更新时间戳
  notebookId?: string           // 关联的笔记本ID（动态上下文）
}
```

### 示例

```json
{
  "id": "ctx_1712345678901",
  "name": "项目背景",
  "type": "static",
  "color": "#66bb6a",
  "content": "## 项目概述\n这是一个...",
  "createdAt": 1712345678901,
  "updatedAt": 1712345680000
}
```

---

## 标签 (Tag)

### 文件位置
`tags.json`

### 数据结构

```typescript
interface Tag {
  id: string                    // 标签唯一标识
  name: string                  // 标签名称
  color: string                 // 显示颜色
  createdAt: number             // 创建时间戳
  updatedAt: number             // 更新时间戳
}
```

### 示例

```json
[
  {
    "id": "tag_1712345678901",
    "name": "重要",
    "color": "#e53e3e",
    "createdAt": 1712345678901,
    "updatedAt": 1712345680000
  }
]
```

### 预设颜色
```
#66bb6a (绿)  #4299e1 (蓝)  #ed8936 (橙)  #e53e3e (红)
#9f7aea (紫)  #ed64a6 (粉)  #38b2ac (青)  #ecc94b (黄)
```

---

## 快捷指令 (QuickCommand)

### 文件位置
`quickCommands.json`

### 数据结构

```typescript
interface QuickCommand {
  id: string                    // 指令唯一标识
  name: string                  // 指令名称
  content: string               // 提示词内容
  color: string                 // 显示颜色
  createdAt: number             // 创建时间戳
  updatedAt: number             // 更新时间戳
}
```

### 示例

```json
[
  {
    "id": "cmd_1712345678901",
    "name": "总结",
    "content": "请总结以下内容的关键点...",
    "color": "#66bb6a",
    "createdAt": 1712345678901,
    "updatedAt": 1712345680000
  }
]
```

---

## 应用配置 (Settings)

### 文件位置
`config.json`

### 数据结构

```typescript
interface Settings {
  llm: LLMSettings              // 大模型配置
  stt: STTSettings              // 语音识别配置
  general: GeneralSettings      // 通用设置
  view: ViewSettings            // 视图设置
}

interface LLMSettings {
  provider: 'custom'
  profiles: LLMProfile[]        // 模型配置列表
  activeProfileId: string       // 当前激活的配置ID
  quickModelProfileId?: string  // 快速模型配置ID
  embeddingModel?: string       // 嵌入模型名称
  embeddingEnabled?: boolean    // 是否启用嵌入
  embeddingDimension?: number   // 嵌入向量维度
}

interface LLMProfile {
  id: string
  name: string
  apiKey: string
  baseUrl: string
  model: string
  enableThinking?: boolean      // 思考模式开关
  temperature?: number          // 温度参数 (0-2)
}

interface GeneralSettings {
  audioFormat: 'webm' | 'wav'
  language: 'zh' | 'en' | 'system'
  theme: 'dark' | 'light' | 'system'
  colorTheme: BuiltinTheme | 'custom'
  customPrimaryColor?: string
  notebooksViewMode?: 'grid' | 'list'
  nodeListViewMode?: 'card' | 'list' | 'calendar'
  userFilesPath?: string        // 自定义用户文件目录
  defaultNotebookId?: string    // 默认笔记本ID
  autoAiAnswer?: boolean        // 自动AI回答开关
}

interface ViewSettings {
  chatViewLeftPanelRatio: number
  nodeListViewLeftPanelRatio: number
  pdfReaderViewLeftPanelRatio: number
}
```

---

## 搜索历史 (SearchHistory)

### 文件位置
`search-history.json`

### 数据结构

```typescript
interface SearchHistoryItem {
  query: string                 // 搜索查询内容
  timestamp: number             // 搜索时间戳
  searchMode: 'keyword' | 'semantic'  // 搜索模式
}
```

### 示例

```json
{
  "items": [
    {
      "query": "项目进度",
      "timestamp": 1712345678901,
      "searchMode": "semantic"
    }
  ]
}
```

### 限制
- 最大保存数量：50 条
- UI 显示数量：5 条

---

## PDF 文件

### 存储位置
`pdf/{filename}`

### 文件命名
- 使用时间戳命名避免冲突
- 示例：`1712345678901.pdf`

---

## 运行时字段说明

以下字段在运行时动态计算，不保存到文件：

| 字段 | 所属 | 说明 |
|------|------|------|
| `transcriptStatus` | CanvasNode | 转写处理状态 |
| `agentStatus` | CanvasNode | AI回答处理状态 |
| `thinkingContent` | CanvasNode | 思考过程内容 |
| `thinkingStatus` | CanvasNode | 思考过程状态 |
| `selectedAsContext` | CanvasNode | 上下文选择状态 |
| `imageBase64` | CanvasNode | 图片base64（从文件加载） |
| `embeddedImages` | CanvasNode | 内嵌图片base64数组 |
| `displayPosition` | DisplayNode | 瀑布流布局计算的显示位置 |

---

## 数据迁移说明

应用支持自动迁移旧格式数据：

1. **笔记本格式迁移**
   - 旧格式：节点存储在 `canvases[].nodes` 中
   - 新格式：节点直接存储在 `nodes` 数组中
   - 迁移时机：加载笔记本时自动检测并迁移

2. **标签颜色补全**
   - 旧数据可能缺少 `color` 字段
   - 加载时自动分配预设颜色

---

## 版本兼容性

- 数据格式向后兼容
- 新增字段使用可选类型（`?:`）
- 删除字段时保留迁移逻辑一段时间