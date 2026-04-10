# Textarea 拖拽光标定位实现总结

## 需求背景

MagicInput 组件是一个模态对话框，包含文本编辑框(textarea)，支持拖拽文本和图片。原有实现在 `handleDrop` 时使用 `textarea.selectionStart` 获取插入位置，但这只能获取拖拽前的光标位置，无法根据鼠标释放的实际位置插入文本。

**目标**：在拖拽过程中，鼠标指针能够实时定位光标位置，从而确定拖拽后文本插入的目标位置。

## 技术难点

### 1. Textarea 不是 DOM 文本节点

`textarea` 是原生表单元素，其内部文本不是 DOM 节点，因此无法直接使用 `document.caretPositionFromPoint` 或 `document.caretRangeFromPoint` API 获取精确位置。

### 2. 自动换行导致逻辑行与视觉行不一致

用户输入的换行符（`\n`）分割的是"逻辑行"，但 textarea 会根据宽度自动换行产生"视觉行"。简单的行号计算方法无法正确处理自动换行的情况。

### 3. 滚动状态同步

Textarea 可能会有滚动，计算位置时需要考虑 `scrollTop`。

### 4. 内部拖拽时选区丢失

在 `dragover` 事件中更新 `textarea.selectionStart/End` 会导致原始选区位置被覆盖，无法正确实现移动（move）效果。

## 解决方案

### 核心方法：镜像元素法

创建一个与 textarea 样式完全相同的隐藏 `div` 元素，定位在同一位置，然后在该镜像元素上使用 `caretRangeFromPoint` API 获取精确的光标位置。

```typescript
function getCaretPositionFromPoint(x: number, y: number, textarea: HTMLTextAreaElement): number | null {
  // 创建临时镜像元素
  const mirror = document.createElement('div')
  const style = window.getComputedStyle(textarea)
  const rect = textarea.getBoundingClientRect()

  // 复制 textarea 的所有关键样式
  mirror.style.cssText = `
    position: fixed;
    left: ${rect.left}px;
    top: ${rect.top}px;
    width: ${rect.width}px;
    height: ${rect.height}px;
    font-family: ${style.fontFamily};
    font-size: ${style.fontSize};
    line-height: ${style.lineHeight};
    letter-spacing: ${style.letterSpacing};
    white-space: pre-wrap;
    word-wrap: break-word;
    overflow: hidden;
    overflow-y: auto;
    padding: ${style.padding};
    border: ${style.border};
    box-sizing: border-box;
    z-index: 9999;
    opacity: 0;  // 隐藏但可被检测
  `

  // 复制文本内容
  mirror.textContent = textarea.value
  document.body.appendChild(mirror)

  // 同步滚动位置
  mirror.scrollTop = textarea.scrollTop

  try {
    // 使用 caretRangeFromPoint 获取位置
    const range = document.caretRangeFromPoint(x, y)
    // ... 计算偏移量
    return position
  } finally {
    mirror.remove()
  }
}
```

### 关键样式属性

必须复制的样式属性：
- `font-family`, `font-size`, `line-height`, `letter-spacing` - 影响文本布局
- `white-space: pre-wrap`, `word-wrap: break-word` - 保持换行行为
- `padding`, `border`, `box-sizing` - 影响内容区域位置
- `width`, `height` - 影响自动换行点

### 内部拖拽移动效果

通过在 `dragstart` 时记录原始选区，在 `drop` 时删除原位置文字：

```typescript
// 拖拽开始时记录
const internalDragSelection = ref<{ start: number; end: number; text: string } | null>(null)

function handleTextareaDragStart(e: DragEvent) {
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const selectedText = textarea.value.substring(start, end)

  if (selectedText && e.dataTransfer) {
    e.dataTransfer.setData('text/plain', selectedText)
    e.dataTransfer.setData('application/x-magic-input', 'true')
    e.dataTransfer.effectAllowed = 'move'

    // 记录原始选区位置
    internalDragSelection.value = {
      start: Math.min(start, end),
      end: Math.max(start, end),
      text: selectedText
    }
  }
}

// drop 时处理移动逻辑
function handleDrop(e: DragEvent) {
  if (internalDragSelection.value) {
    const { start: deleteStart, end: deleteEnd } = internalDragSelection.value

    // 调整插入位置（如果插入位置在删除位置之后）
    let adjustedInsertPos = insertPosition
    if (insertPosition > deleteEnd) {
      adjustedInsertPos = insertPosition - (deleteEnd - deleteStart)
    }

    // 删除原位置，插入新位置
    const textAfterDelete = text.substring(0, deleteStart) + text.substring(deleteEnd)
    inputText.value = textAfterDelete.substring(0, adjustedInsertPos) + dragText + textAfterDelete.substring(adjustedInsertPos)
  }
}
```

## 完整实现要点

### 1. 事件绑定

```vue
<textarea
  @dragstart="handleTextareaDragStart"
  @dragend="handleDragEnd"
  @dragover.prevent="handleDragOver"
  @drop.prevent="handleDrop"
/>
```

### 2. 状态管理

```typescript
// 拖拽时的光标位置
const dragCaretPosition = ref<number | null>(null)

// 内部拖拽时原始选区
const internalDragSelection = ref<{ start: number; end: number; text: string } | null>(null)
```

### 3. 清理状态

```typescript
function handleDragEnd() {
  dragCaretPosition.value = null
  internalDragSelection.value = null
}
```

## 经验总结

### 技术选型

| 方法 | 优点 | 缺点 |
|------|------|------|
| Canvas 测量字符宽度 | 简单直接 | 无法处理自动换行，需要额外计算 |
| 镜像元素 + caretRangeFromPoint | 精确、自动处理换行 | 需要同步滚动状态 |
| 原生 textarea API | 无额外依赖 | 不支持获取鼠标位置对应字符 |

**推荐**：镜像元素法，虽然代码量稍多，但能正确处理各种边界情况。

### 注意事项

1. **opacity: 0 vs visibility: hidden**
   - `opacity: 0` 的元素仍可被 `caretRangeFromPoint` 检测到
   - `visibility: hidden` 的元素无法被检测

2. **position: fixed vs absolute**
   - 使用 `fixed` 可以避免父元素 transform 的影响
   - 需要使用 `getBoundingClientRect()` 获取精确位置

3. **滚动同步**
   - 镜像元素需要同步 textarea 的 `scrollTop`
   - 对于水平滚动，也需要同步 `scrollLeft`

4. **性能优化**
   - 每次调用都创建/销毁镜像元素，可以考虑缓存
   - 但缓存需要处理 textarea 样式变化的情况

5. **跨浏览器兼容**
   - `caretRangeFromPoint`: Chrome, Safari, Edge
   - `caretPositionFromPoint`: Firefox
   - 需要同时处理两种 API

### 调试技巧

1. 临时移除 `opacity: 0` 可以看到镜像元素的实际效果
2. 在控制台打印 `caretRangeFromPoint` 返回的 `range` 对象检查是否正确
3. 注意 `range.startContainer` 可能是镜像元素本身或其子文本节点

## 相关文件

- `src/components/MagicInput.vue` - 实现文件

## 参考资料

- [MDN: Document.caretRangeFromPoint()](https://developer.mozilla.org/en-US/docs/Web/API/Document/caretRangeFromPoint)
- [MDN: Document.caretPositionFromPoint()](https://developer.mozilla.org/en-US/docs/Web/API/Document/caretPositionFromPoint)