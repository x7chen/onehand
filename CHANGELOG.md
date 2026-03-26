# 功能更新日志

## 2026-03-26 创建项目对话框优化

### 修改内容
1. **简化项目类型选择**
   - 删除常规项目/PDF阅读项目类型选择器
   - PDF 文件选择改为可选，添加 PDF 路径自动识别为 PDF 项目，留空则为常规项目
   - 添加清除 PDF 文件按钮

2. **优化静态上下文选择**
   - 将复选框列表改为标签选择方式
   - 点击标签切换选中状态，选中时显示上下文颜色
   - 样式参考 CanvasHeader 中的静态上下文选择器

### 文件变更
- `src/views/HomeView.vue` - 修改模板、脚本和样式

---

## 2026-03-26 搜索功能与节点导航优化

### 一、新增全局搜索功能

#### 1. 新增组件
- **`src/components/SearchDialog.vue`** - 全局搜索对话框组件

#### 2. 功能特性
- 在 HomeView 头部添加搜索按钮，点击打开搜索对话框
- 搜索所有项目的所有画布中的节点内容（transcript 和 agentResult）
- 搜索结果高亮显示匹配关键词
- 每个结果显示项目名、画布名和匹配文本预览
- 点击详情按钮弹出 NodePopup 查看完整节点内容
- 支持跳转导航功能

#### 3. 修改文件
- `src/views/HomeView.vue` - 添加搜索按钮和 SearchDialog 组件
- `src/components/SearchDialog.vue` - 新建搜索对话框组件

---

### 二、深度链接导航优化

#### 1. 问题
从外部通过深度链接打开普通工程的节点时，没有翻页到节点所在画布，也没有激活链接节点。

#### 2. 解决方案
- 导航时通过 URL 查询参数传递 `canvasId` 和 `nodeId`
- 目标页面加载时处理查询参数，切换到正确的画布并激活指定节点

#### 3. 修改文件
- `src/composables/useDeepLink.ts` - 导航时添加查询参数
- `src/views/NodeListView.vue` - 处理查询参数，激活节点并滚动到位置
- `src/components/NodeListPanel.vue` - 添加 `scrollToNode` 方法
- `src/views/PdfReaderView.vue` - 处理 nodeId 查询参数

---

### 三、NodePopup 添加跳转按钮

#### 1. 问题
NodePopup 组件定义了 `navigate` 事件但未实现触发 UI，导致无法从弹窗跳转到节点位置。

#### 2. 解决方案
- 在 NodePopup header 中添加"跳转"按钮
- 点击按钮触发 `navigate` 事件，关闭弹窗并导航到节点所在页面

#### 3. 修改文件
- `src/components/NodePopup.vue` - 添加跳转按钮和 handleNavigate 函数
- `src/App.vue` - 添加 `@navigate` 事件处理
- `src/components/SearchDialog.vue` - 添加 handleNavigate 函数处理导航

---

### 四、修复翻页与导航激活冲突

#### 1. 问题
画布翻页时会自动激活第一个节点，这与导航时激活指定节点产生冲突。

#### 2. 解决方案
- 添加 `isNavigating` 标志变量
- 导航模式下跳过 watch 中的自动选中第一个节点逻辑
- 导航完成后清除 URL 查询参数并退出导航模式

#### 3. 修改文件
- `src/views/NodeListView.vue` - 添加导航标志，优化 watch 逻辑
- `src/views/PdfReaderView.vue` - 导航完成后清除查询参数

---

### 文件变更清单

| 文件路径 | 操作类型 |
|---------|---------|
| `src/components/SearchDialog.vue` | 新增 |
| `src/components/NodePopup.vue` | 修改 |
| `src/components/NodeListPanel.vue` | 修改 |
| `src/views/HomeView.vue` | 修改 |
| `src/views/NodeListView.vue` | 修改 |
| `src/views/PdfReaderView.vue` | 修改 |
| `src/App.vue` | 修改 |
| `src/composables/useDeepLink.ts` | 修改 |