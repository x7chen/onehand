# UI元素名称清单

根据对项目代码的分析，以下是完整的UI元素名称清单：

## 主要UI组件

### 1. **InfiniteCanvas（无限画布）**
- **canvas-view**: 画布视图容器
- **infinite-canvas**: 无限画布主容器
- **canvas-content**: 画布内容区域
- **grid-background**: 网格背景
- **drag-hint**: 拖拽提示框

### 2. **VoiceNote（语音笔记节点）**
- **voice-note**: 语音笔记节点容器
- **node-header**: 节点头部区域
- **mic-icon-wrapper**: 麦克风图标包装器
- **mic-icon**: 麦克风图标
- **text-note-indicator**: 文本笔记指示器
- **delete-btn**: 删除按钮
- **recording-duration**: 录音时长显示
- **transcript-box**: 转写内容区域
- **transcript-content-wrapper**: 转写内容包装器
- **transcript-content**: 转写内容文本
- **transcript-edit**: 转写编辑文本框
- **agent-result-box**: AI回答结果区域
- **agent-header**: AI回答头部
- **agent-label**: AI标签
- **streaming-indicator**: 流式处理指示器
- **agent-content-wrapper**: AI内容包装器
- **agent-content**: AI回答内容
- **agent-edit**: AI编辑文本框
- **status-text**: 状态文本（如"转换中..."）
- **error-text**: 错误文本
- **editing-box**: 编辑模式容器
- **content-edit**: 内容编辑文本框
- **playing-animation**: 播放动画效果

### 3. **ContextToolbar（上下文工具栏）**
- **context-toolbar**: 上下文工具栏容器
- **context-info**: 上下文信息显示

### 4. **RecordingIndicator（录音指示器）**
- **recording-indicator**: 录音指示器容器
- **recording-dot**: 录音红点
- **recording-time**: 录音时间显示

### 5. **CanvasView（画布视图）**
- **canvas-header**: 画布头部区域
- **back-btn**: 返回按钮
- **static-context-display**: 静态上下文显示区域
- **context-icon**: 上下文图标
- **static-context-tags**: 静态上下文标签列表
- **context-tag-mini**: 迷你上下文标签
- **static-context-names**: 静态上下文名称列表
- **context-name-tag**: 上下文名称标签
- **context-count**: 上下文数量显示
- **context-placeholder**: 上下文占位符文本
- **context-toolbar-group**: 上下文工具栏组
- **context-action-btn**: 上下文操作按钮
- **dynamic-context-display**: 动态上下文显示区域
- **context-name**: 上下文名称
- **word-count**: 字数统计
- **dialog-overlay**: 对话框遮罩层
- **dialog**: 对话框容器
- **dynamic-context-editor-dialog**: 动态上下文编辑器对话框
- **content-input**: 内容输入文本框
- **dialog-actions**: 对话框操作按钮组
- **cancel-btn**: 取消按钮
- **confirm-btn**: 确认按钮
- **no-dynamic-context**: 无动态上下文提示

## 功能性UI元素

### 导航和布局
- **App.vue**: 应用根组件
- **HomeView.vue**: 主页视图
- **SettingsView.vue**: 设置视图

### 工具栏和按钮
- **全选按钮**: 选择所有已完成节点
- **反选按钮**: 反选所有已完成节点  
- **清空选择按钮**: 清空上下文选择
- **播放按钮**: 播放录音
- **重试按钮**: 重新转写或AI回答

### 状态指示器
- **录音状态**: 显示录音中的红点脉冲动画
- **播放状态**: 显示播放中的涟漪动画
- **流式处理**: 显示AI正在生成回答的跳动圆点
- **加载状态**: 显示"转换中..."、"processing"等状态

### 编辑和交互元素
- **复选框**: 用于选择上下文节点
- **文本域**: 用于编辑转写内容和AI回答
- **拖拽手柄**: 节点头部的移动区域
- **双击编辑**: 在转写内容和AI回答上双击进入编辑模式

这些UI元素名称可以帮助你在开发、调试或讨论功能时更准确地指代各个界面组件。


在VoiceNote组件的node-header中添加3个按钮：收藏、隐藏AI回答和重新生成。具体功能如下：
1. 收藏按钮：收藏图标为五角星，收藏状态下五角星点亮为黄色。
2. 隐藏AI回答按钮：点击后将当前voice-note中的agent-result-box隐藏起来，再次点击则显示agent-result-box。
3. 重新生成按钮：点击后将当前agent-content中的内容重新生成（生成上下文包括静态上下文+动态上下文+transcript-content中的内容）。
4. 如果agent-content内容不为空且agent-result-box隐藏，则重新生成按钮失效，否则重新生成按钮有效
5. 如果agent-content内容为空，则总是隐藏agent-result-box

在CanvasView视图中的canvas-header中添加一个总隐藏开关按钮和AI回答按钮：
1. 总隐藏开关按钮：点击后可以控制所有voice-note中agent-result-box的显示和隐藏。
2. 如果AI回答按钮处于关闭状态，新建VoiceNote时完成转写或者新建文本编辑后，不触发AI回答，否则触发AI回答。
