# PDF 缩放与节点标记定位问题分析

## 问题描述

在 PDF 阅读器中，当缩放比例低于 100% 时，节点标记会出现错位。具体表现为节点标记到 PDF 页面左上角的距离不会被缩放，导致标记位置与 PDF 内容不匹配。

## 问题分析

### 错误方案：使用 transform: scale()

最初实现使用 CSS `transform: scale()` 来实现缩放：

```html
<div class="pdf-page-container" :style="{ transform: `scale(${scale})` }">
```

**问题**：
1. `transform` 会缩放视觉尺寸，但不影响文档流中的占位空间
2. 当 `scale < 1` 时，容器视觉缩小但占位空间不变，导致边界扩展超出 PDF 视觉边界
3. 子元素（如节点标记）的定位需要额外计算补偿，容易出错

### 正确方案：使用 width/height + canvas CSS 尺寸

采用直接设置元素尺寸的方式：

```html
<div class="pdf-page-container" :style="pageContainerStyle">
  <canvas :style="canvasStyle"></canvas>
  <div class="node-markers" :style="nodeMarkersStyle"></div>
</div>
```

```typescript
const pageContainerStyle = computed(() => ({
  width: `${canvasWidth * scale}px`,
  height: `${canvasHeight * scale}px`
}))

const canvasStyle = computed(() => ({
  width: `${canvasWidth * scale}px`,
  height: `${canvasHeight * scale}px`
}))
```

## 坐标系设计原则

### 核心原则：统一存储原始坐标

**存储**：原始 PDF 坐标（与缩放无关）
**显示**：根据当前缩放比例计算显示位置

### 坐标转换公式

```
存储坐标 = 屏幕坐标 / scale
显示坐标 = 存储坐标 * scale
```

### 实现示例

```typescript
// 获取坐标（双击创建节点时）
function handleDoubleClick(e: MouseEvent) {
  const x = (e.clientX - rect.left) / scale.value  // 转换为原始坐标
  const y = (e.clientY - rect.top) / scale.value
  
  emit('create-node', { x, y })
}

// 显示坐标（节点标记定位）
function getNodeMarkerStyle(node: CanvasNode) {
  return {
    left: `${node.pdfPosition.x * scale.value}px`,
    top: `${node.pdfPosition.y * scale.value}px`
  }
}

// 拖拽节点
function handleDragMove(e: MouseEvent) {
  const dx = (e.clientX - startPos.x) / scale.value
  const dy = (e.clientY - startPos.y) / scale.value
  
  node.pdfPosition.x += dx
  node.pdfPosition.y += dy
}
```

## 经验总结

### 1. 坐标系必须统一

在有缩放/缩放的场景中，必须明确定义：
- **世界坐标**（World Coordinate）：存储和计算时使用
- **屏幕坐标**（Screen Coordinate）：用户交互时使用

### 2. 避免使用 transform 进行缩放布局

`transform: scale()` 适合纯视觉效果的缩放（如hover放大），但不适合需要精确定位的场景：
- ❌ transform 会改变视觉尺寸但不改变占位空间
- ❌ transform 后的子元素定位计算复杂
- ❌ 容易出现坐标不同步的问题

### 3. PDF 渲染注意事项

```typescript
// 正确：canvas 的 CSS 尺寸必须与渲染尺寸一致
canvas.width = viewport.width * scale
canvas.height = viewport.height * scale
canvas.style.width = `${viewport.width * scale}px`
canvas.style.height = `${viewport.height * scale}px`

const scaledViewport = page.getViewport({ scale })
await page.render({
  canvasContext: context,
  viewport: scaledViewport
})
```

### 4. 测试要点

- [ ] 缩放 50%、100%、200% 下节点位置是否正确
- [ ] 拖拽节点后位置是否正确
- [ ] 切换页面后节点位置是否正确
- [ ] 刷新页面后节点位置是否正确（持久化验证）

## 参考代码

见 `src/components/PdfViewer.vue`
