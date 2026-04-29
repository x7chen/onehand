<template>
  <aside class="unified-sidebar" @dragover="handleSidebarDragOver" @drop="handleSidebarDrop" @click="handleSidebarClick">
    <!-- 固定顶部区域：创建笔记 + 搜索 -->
    <div class="sidebar-header">
      <button class="create-note-btn" @click="handleCreateNote" :title="t('common.create')">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
          <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
        </svg>
        <span>{{ t('voiceNote.createNote') }}</span>
      </button>
    </div>

    <div class="sidebar-search">
      <button class="nav-item" @click="handleSearchClick">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
          <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
        </svg>
        <span>{{ t('common.search') }}</span>
      </button>
    </div>

    <!-- 可滚动中间区域 -->
    <nav class="sidebar-nav">

      <!-- 所有笔记本（树状结构） -->
      <div class="nav-tree-item">
        <button
          class="nav-item tree-header"
          :class="{ active: activeTab === 'notebooks' || activeTab === 'all-notebooks' || activeNotebookId }"
          @click.stop="handleNotebooksClick"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="4" y="4" width="16" height="16" rx="2"/>
            <line x1="8" y1="8" x2="16" y2="8"/>
            <line x1="8" y1="12" x2="16" y2="12"/>
            <line x1="8" y1="16" x2="12" y2="16"/>
          </svg>
          <span>{{ t('nav.notebooks') }}</span>
          <svg
            class="expand-icon"
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="currentColor"
            :class="{ expanded: showNotebooksPopover }"
          >
            <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
          </svg>
        </button>

        <!-- 固定的笔记本列表 -->
        <div v-if="isAllNotebooksPinned || pinnedNotebooks.length > 0" class="pinned-notebooks-section">
          <!-- 固定的全部笔记本 -->
          <button
            v-if="isAllNotebooksPinned"
            class="notebook-item"
            :class="{ active: activeTab === 'all-notebooks' && !activeNotebookId }"
            @click="handleAllNotebooksClickFromPinned"
            @mouseenter="hoveredNotebookId = 'all-notebooks'"
            @mouseleave="hoveredNotebookId = null"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H8V4h12v12z"/>
            </svg>
            <span>{{ t('canvas.allNotebooks') }}</span>
            <!-- 菜单按钮 -->
            <div class="notebook-menu-wrapper">
              <button
                class="notebook-menu-btn"
                :class="{ visible: hoveredNotebookId === 'all-notebooks' || openMenuNotebookId === 'all-notebooks' }"
                @click="toggleMenu('all-notebooks', $event)"
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                  <circle cx="12" cy="5" r="2"/>
                  <circle cx="12" cy="12" r="2"/>
                  <circle cx="12" cy="19" r="2"/>
                </svg>
              </button>
              <!-- 下拉菜单 -->
              <div v-if="openMenuNotebookId === 'all-notebooks'" class="notebook-menu-dropdown">
                <button class="menu-item unpin" @click="handleUnpinAllNotebooks($event)">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                    <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.5v-6H18v-2l-2-2z"/>
                  </svg>
                  <span>{{ t('nav.unpin') }}</span>
                </button>
              </div>
            </div>
          </button>

          <!-- 固定的具体笔记本 -->
          <button
            v-for="notebook in pinnedNotebooks"
            :key="notebook.id"
            class="notebook-item"
            :class="{ active: activeNotebookId === notebook.id }"
            @click="handleNotebookClick(notebook.id)"
            @mouseenter="hoveredNotebookId = notebook.id"
            @mouseleave="hoveredNotebookId = null"
          >
            <svg v-if="notebook.pdfPath" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
            </svg>
            <svg v-else viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z"/>
            </svg>
            <span>{{ notebook.name }}</span>
            <!-- 菜单按钮 -->
            <div class="notebook-menu-wrapper">
              <button
                class="notebook-menu-btn"
                :class="{ visible: hoveredNotebookId === notebook.id || openMenuNotebookId === notebook.id }"
                @click="toggleMenu(notebook.id, $event)"
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                  <circle cx="12" cy="5" r="2"/>
                  <circle cx="12" cy="12" r="2"/>
                  <circle cx="12" cy="19" r="2"/>
                </svg>
              </button>
              <!-- 下拉菜单 -->
              <div v-if="openMenuNotebookId === notebook.id" class="notebook-menu-dropdown">
                <button class="menu-item unpin" @click="handleUnpin(notebook, $event)">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                    <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.5v-6H18v-2l-2-2z"/>
                  </svg>
                  <span>{{ t('nav.unpin') }}</span>
                </button>
                <button class="menu-item canvas-view" @click="handleOpenCanvasPanel(notebook, $event)">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                    <path d="M4 4h7v7H4zm0 9h7v7H4zm9-9h7v7h-7zm0 9h7v7h-7z"/>
                  </svg>
                  <span>{{ t('canvas.expandList') }}</span>
                </button>
                <button class="menu-item rename" @click="startRename(notebook, $event)">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.9959.9959 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                  </svg>
                  <span>{{ t('notebook.renameNotebook') }}</span>
                </button>
                <button class="menu-item delete" @click="handleDeleteNotebook(notebook)">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                  </svg>
                  <span>{{ t('common.delete') }}</span>
                </button>
              </div>
            </div>
          </button>
        </div>

        <!-- 笔记本弹出菜单（使用 Teleport 覆盖在主内容区域上方） -->
        <Teleport to="body">
          <div v-if="showNotebooksPopover" class="notebooks-popover" :style="popoverStyle">
            <!-- 新建笔记本（跨两列） -->
            <button class="popover-item create-notebook" @click.stop="showCreateNotebookDialog = true; showNotebooksPopover = false">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
              </svg>
              <span>{{ t('notebook.newNotebook') }}</span>
            </button>

            <!-- 全部笔记本 -->
            <button
              class="popover-item all-notebooks"
              :class="{ active: activeTab === 'all-notebooks' && !activeNotebookId }"
              @click.stop="handleAllNotebooksClick"
              @mouseenter="hoveredPopoverAllNotebooks = true"
              @mouseleave="hoveredPopoverAllNotebooks = false"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H8V4h12v12z"/>
              </svg>
              <span>{{ t('canvas.allNotebooks') }}</span>
              <!-- 菜单按钮 -->
              <div class="popover-menu-wrapper">
                <button
                  class="popover-menu-btn"
                  :class="{ visible: hoveredPopoverAllNotebooks || showAllNotebooksMenu }"
                  @click="toggleAllNotebooksMenu($event)"
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                    <circle cx="12" cy="5" r="2"/>
                    <circle cx="12" cy="12" r="2"/>
                    <circle cx="12" cy="19" r="2"/>
                  </svg>
                </button>
                <!-- 下拉菜单 -->
                <div v-if="showAllNotebooksMenu" class="popover-menu-dropdown">
                  <button class="menu-item pin" @click.stop="handleTogglePinAllNotebooks($event)">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                      <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.5v-6H18v-2l-2-2z"/>
                    </svg>
                    <span>{{ isAllNotebooksPinned ? t('nav.unpin') : t('nav.pin') }}</span>
                  </button>
                </div>
              </div>
            </button>

            <!-- 具体笔记本列表（两列布局） -->
            <template v-for="(notebook, index) in sortedNotebooks" :key="notebook.id">
              <button
                class="popover-item"
                :class="{ active: activeNotebookId === notebook.id, renaming: renamingNotebookId === notebook.id }"
                @click.stop="handleNotebookClick(notebook.id)"
                @mouseenter="hoveredPopoverNotebookId = notebook.id"
                @mouseleave="hoveredPopoverNotebookId = null"
              >
                <svg v-if="notebook.pdfPath" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
                </svg>
                <svg v-else viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z"/>
                </svg>
                <!-- 重命名输入框 -->
                <input
                  v-if="renamingNotebookId === notebook.id"
                  type="text"
                  class="rename-input"
                  v-model="renameInputValue"
                  :placeholder="t('notebook.renamePlaceholder')"
                  @click.stop
                  @keyup.enter="confirmRename(notebook)"
                  @keyup.escape="cancelRename"
                  @blur="confirmRename(notebook)"
                  ref="renameInput"
                />
                <span v-else>{{ notebook.name }}</span>
                <!-- 菜单按钮 -->
                <div v-show="renamingNotebookId !== notebook.id" class="popover-menu-wrapper">
                  <button
                    class="popover-menu-btn"
                    :class="{ visible: hoveredPopoverNotebookId === notebook.id || openPopoverMenuNotebookId === notebook.id }"
                    @click="togglePopoverMenu(notebook.id, $event)"
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                      <circle cx="12" cy="5" r="2"/>
                      <circle cx="12" cy="12" r="2"/>
                      <circle cx="12" cy="19" r="2"/>
                    </svg>
                  </button>
                  <!-- 下拉菜单 -->
                  <div v-if="openPopoverMenuNotebookId === notebook.id" class="popover-menu-dropdown">
                    <button class="menu-item pin" @click.stop="handleTogglePin(notebook, $event)">
                      <svg v-if="isPinned(notebook)" viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                        <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.5v-6H18v-2l-2-2z"/>
                      </svg>
                      <svg v-else viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                        <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.5v-6H18v-2l-2-2z"/>
                      </svg>
                      <span>{{ isPinned(notebook) ? t('nav.unpin') : t('nav.pin') }}</span>
                    </button>
                    <button class="menu-item canvas-view" @click.stop="handleOpenCanvasPanel(notebook, $event)">
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                        <path d="M4 4h7v7H4zm0 9h7v7H4zm9-9h7v7h-7zm0 9h7v7h-7z"/>
                      </svg>
                      <span>{{ t('canvas.expandList') }}</span>
                    </button>
                    <button class="menu-item rename" @click.stop="startPopoverRename(notebook, $event)">
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                        <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.9959.9959 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                      </svg>
                      <span>{{ t('notebook.renameNotebook') }}</span>
                    </button>
                    <button class="menu-item delete" @click.stop="handleDeleteNotebook(notebook)">
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                        <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                      </svg>
                      <span>{{ t('common.delete') }}</span>
                    </button>
                  </div>
                </div>
              </button>
            </template>
          </div>
        </Teleport>
      </div>

      <!-- 上下文 -->
      <button
        class="nav-item"
        :class="{ active: activeTab === 'contexts' }"
        @click="emit('select-tab', 'contexts')"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
          <path d="M17.63 5.84C17.27 5.33 16.67 5 16 5L5 5.01C3.9 5.01 3 5.9 3 7v10c0 1.1.9 1.99 2 1.99L16 19c.67 0 1.27-.33 1.63-.84L22 12l-4.37-6.16z"/>
        </svg>
        <span>{{ t('nav.contexts') }}</span>
      </button>

      <!-- 标签 -->
      <button
        class="nav-item"
        :class="{ active: activeTab === 'tags' }"
        @click="emit('select-tab', 'tags')"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
          <path d="M17.63 5.84C17.27 5.33 16.67 5 16 5L5 5.01C3.9 5.01 3 5.9 3 7v10c0 1.1.9 1.99 2 1.99L16 19c.67 0 1.27-.33 1.63-.84L22 12l-4.37-6.16z"/>
        </svg>
        <span>{{ t('nav.tags') }}</span>
      </button>

      <!-- 收藏夹 -->
      <button
        class="nav-item"
        :class="{ active: activeTab === 'favorites' }"
        @click="emit('select-tab', 'favorites')"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
          <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
        </svg>
        <span>{{ t('nav.favorites') }}</span>
      </button>

      <!-- 设置 -->
      <button
        class="nav-item"
        :class="{ active: activeTab === 'settings' }"
        @click="emit('select-tab', 'settings')"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
          <path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
        </svg>
        <span>{{ t('nav.settings') }}</span>
      </button>

      <!-- 主题切换 -->
      <button class="nav-item" @click="cycleTheme" :title="t('theme.currentTheme', { name: getThemeLabel() })">
        <svg v-if="getThemeIcon() === 'moon'" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
          <path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-3.03 0-5.5-2.47-5.5-5.5 0-1.82.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z"/>
        </svg>
        <svg v-else-if="getThemeIcon() === 'sun'" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
          <path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0 .39-.39.39-1.03 0-1.41l-1.06-1.06zm1.06-10.96c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41.39.39 1.03.39 1.41 0l1.06-1.06zM7.05 18.36c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41.39.39 1.03.39 1.41 0l1.06-1.06z"/>
        </svg>
        <svg v-else viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
          <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zm-7-2h2v-4h4v-2h-4V7h-2v4H8v2h4v4z"/>
        </svg>
        <span>{{ getThemeLabel() }}</span>
      </button>
    </nav>

    <!-- 回收站 -->
    <div
      class="sidebar-trash"
      :class="{ 'drag-over': isDragOverTrash }"
      @dragover="handleTrashDragOver"
      @dragleave="handleTrashDragLeave"
      @drop="handleTrashDrop"
    >
      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
        <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
      </svg>
      <span>{{ t('nav.trash') }}</span>
    </div>

    <!-- 搜索对话框 -->
    <SearchDialog
      :visible="showSearchDialog"
      @close="showSearchDialog = false"
    />

    <!-- 创建笔记本对话框 -->
    <CreateNotebookDialog
      :visible="showCreateNotebookDialog"
      :static-context-files="staticContextFiles"
      :dynamic-context-files="dynamicContextFiles"
      @close="showCreateNotebookDialog = false"
      @create="handleCreateNotebook"
    />

    <!-- 删除确认对话框 -->
    <Teleport to="body">
      <div v-if="showDeleteConfirmDialog" class="delete-dialog-overlay" @click="showDeleteConfirmDialog = false">
        <div class="delete-dialog" @click.stop>
          <div class="dialog-header">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" class="warning-icon">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
            </svg>
            <h3>{{ t('notebook.deleteConfirmTitle') }}</h3>
          </div>
          <div class="dialog-body">
            <p>{{ t('notebook.deleteConfirmMessage', { name: notebookToDelete?.name || '' }) }}</p>
          </div>
          <div class="dialog-footer">
            <button class="cancel-btn" @click="showDeleteConfirmDialog = false">
              {{ t('common.cancel') }}
            </button>
            <button class="delete-btn" @click="confirmDeleteNotebook">
              {{ t('common.delete') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </aside>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '@/stores/settingsStore'
import { useNotebookStore } from '@/stores/notebookStore'
import SearchDialog from '@/components/SearchDialog.vue'
import CreateNotebookDialog from '@/components/CreateNotebookDialog.vue'
import type { Notebook } from '@/types/notebook'
import type { ContextFile } from '@/types/context'

const props = withDefaults(defineProps<{
  allNotebooks: Notebook[]
  activeTab: string
  activeNotebookId: string | null
  staticContextFiles: ContextFile[]
  dynamicContextFiles: ContextFile[]
}>(), {
  allNotebooks: () => [],
  activeTab: '',
  activeNotebookId: null,
  staticContextFiles: () => [],
  dynamicContextFiles: () => []
})

const emit = defineEmits<{
  'select-tab': [tab: string]
  'select-notebook': [notebookId: string | null]
  'create-notebook': [data: { name: string; pdfPath?: string; staticContextIds: string[]; dynamicContextId?: string }]
  'switch-view-mode': [mode: 'chat' | 'canvas']
  'create-note': []
}>()

const { t } = useI18n()
const settingsStore = useSettingsStore()
const notebookStore = useNotebookStore()

// 笔记本弹出菜单状态
const showNotebooksPopover = ref(false)

// 弹出菜单位置
const popoverPosition = ref({ top: 0, left: 0 })

// 悬停的笔记本（用于显示菜单）- 固定区域
const hoveredNotebookId = ref<string | null>(null)

// 悬停的笔记本（弹出菜单中）
const hoveredPopoverNotebookId = ref<string | null>(null)

// 悬停的全部笔记本（弹出菜单中）
const hoveredPopoverAllNotebooks = ref(false)

// 全部笔记本菜单显示状态
const showAllNotebooksMenu = ref(false)

// 打开的菜单笔记本ID - 固定区域
const openMenuNotebookId = ref<string | null>(null)

// 打开的菜单笔记本ID - 弹出菜单中
const openPopoverMenuNotebookId = ref<string | null>(null)

// 正在重命名的笔记本ID
const renamingNotebookId = ref<string | null>(null)

// 重命名输入值
const renameInputValue = ref('')

// 输入框引用
const renameInput = ref<HTMLInputElement | null>(null)

// 搜索对话框状态
const showSearchDialog = ref(false)

// 创建笔记本对话框状态
const showCreateNotebookDialog = ref(false)

// 删除确认对话框状态
const showDeleteConfirmDialog = ref(false)
const notebookToDelete = ref<Notebook | null>(null)

// 拖拽状态
const isDragOverTrash = ref(false)

// 按名称排序的笔记本列表
const sortedNotebooks = computed(() => {
  return [...props.allNotebooks].sort((a, b) => a.name.localeCompare(b.name))
})

// 固定的笔记本列表
const pinnedNotebooks = computed(() => {
  const pinnedIds = settingsStore.settings.general.pinnedNotebookIds || []
  return pinnedIds
    .map(id => props.allNotebooks.find(n => n.id === id))
    .filter((n): n is Notebook => n !== undefined)
})

// 弹出菜单样式
const popoverStyle = computed(() => {
  return {
    top: `${popoverPosition.value.top}px`,
    left: `${popoverPosition.value.left}px`
  }
})

// 检查笔记本是否固定
function isPinned(notebook: Notebook): boolean {
  return (settingsStore.settings.general.pinnedNotebookIds || []).includes(notebook.id)
}

// 检查全部笔记本是否固定
const isAllNotebooksPinned = computed(() => {
  return settingsStore.settings.general.pinnedAllNotebooks || false
})

// 主题相关
const currentTheme = computed(() => settingsStore.settings.general.theme)
const themeOrder: ('dark' | 'light' | 'system')[] = ['dark', 'light', 'system']

function cycleTheme() {
  const currentIndex = themeOrder.indexOf(currentTheme.value)
  const nextIndex = (currentIndex + 1) % themeOrder.length
  const nextTheme = themeOrder[nextIndex]

  settingsStore.updateSettings({
    general: {
      ...settingsStore.settings.general,
      theme: nextTheme
    }
  })
}

function getThemeIcon() {
  switch (currentTheme.value) {
    case 'dark':
      return 'moon'
    case 'light':
      return 'sun'
    case 'system':
      return 'auto'
    default:
      return 'auto'
  }
}

function getThemeLabel() {
  switch (currentTheme.value) {
    case 'dark':
      return t('settings.themeDark')
    case 'light':
      return t('settings.themeLight')
    case 'system':
      return t('settings.themeSystem')
    default:
      return t('settings.themeSystem')
  }
}

// 搜索点击
function handleSearchClick() {
  showSearchDialog.value = true
}

// 笔记本标签点击（显示/隐藏弹出菜单）
function handleNotebooksClick(event: MouseEvent) {
  const button = event.currentTarget as HTMLElement
  const rect = button.getBoundingClientRect()
  popoverPosition.value = {
    top: rect.top,
    left: rect.right + 8
  }
  showNotebooksPopover.value = !showNotebooksPopover.value
  openPopoverMenuNotebookId.value = null
  showAllNotebooksMenu.value = false
}

// 所有笔记本点击
function handleAllNotebooksClick() {
  emit('select-tab', 'all-notebooks')
  emit('select-notebook', null)
  showNotebooksPopover.value = false
}

// 从固定区域点击全部笔记本
function handleAllNotebooksClickFromPinned() {
  emit('select-tab', 'all-notebooks')
  emit('select-notebook', null)
}

// 取消固定全部笔记本（固定区域的菜单）
function handleUnpinAllNotebooks(event: MouseEvent) {
  event.stopPropagation()
  settingsStore.updateSettings({
    general: { ...settingsStore.settings.general, pinnedAllNotebooks: false }
  })
  openMenuNotebookId.value = null
}

// 具体笔记本点击
function handleNotebookClick(notebookId: string) {
  emit('select-tab', 'notebooks')
  emit('select-notebook', notebookId)
  showNotebooksPopover.value = false
}

// 固定/取消固定笔记本
function handleTogglePin(notebook: Notebook, event: MouseEvent) {
  event.stopPropagation()
  const pinnedIds = settingsStore.settings.general.pinnedNotebookIds || []
  const isCurrentlyPinned = pinnedIds.includes(notebook.id)
  const newPinnedIds = isCurrentlyPinned
    ? pinnedIds.filter(id => id !== notebook.id)
    : [...pinnedIds, notebook.id]
  settingsStore.updateSettings({
    general: { ...settingsStore.settings.general, pinnedNotebookIds: newPinnedIds }
  })
  openPopoverMenuNotebookId.value = null
}

// 取消固定笔记本（固定区域的菜单）
function handleUnpin(notebook: Notebook, event: MouseEvent) {
  event.stopPropagation()
  const pinnedIds = settingsStore.settings.general.pinnedNotebookIds || []
  const newPinnedIds = pinnedIds.filter(id => id !== notebook.id)
  settingsStore.updateSettings({
    general: { ...settingsStore.settings.general, pinnedNotebookIds: newPinnedIds }
  })
  openMenuNotebookId.value = null
}

// 删除笔记本
async function handleDeleteNotebook(notebook: Notebook) {
  notebookToDelete.value = notebook
  showDeleteConfirmDialog.value = true
  openMenuNotebookId.value = null
  openPopoverMenuNotebookId.value = null
  showNotebooksPopover.value = false
}

// 确认删除笔记本
async function confirmDeleteNotebook() {
  if (!notebookToDelete.value) return
  const deletedId = notebookToDelete.value.id
  await notebookStore.deleteNotebook(deletedId)
  openMenuNotebookId.value = null
  openPopoverMenuNotebookId.value = null
  showDeleteConfirmDialog.value = false
  notebookToDelete.value = null
  // 如果删除的是当前选中的笔记本，清除选中状态
  if (props.activeNotebookId === deletedId) {
    emit('select-notebook', null)
  }
  // 从固定列表中移除
  const pinnedIds = settingsStore.settings.general.pinnedNotebookIds || []
  if (pinnedIds.includes(deletedId)) {
    settingsStore.updateSettings({
      general: { ...settingsStore.settings.general, pinnedNotebookIds: pinnedIds.filter(id => id !== deletedId) }
    })
  }
}

// 打开画布视图面板
function handleOpenCanvasPanel(notebook: Notebook, event: MouseEvent) {
  event.stopPropagation()
  openMenuNotebookId.value = null
  openPopoverMenuNotebookId.value = null
  showNotebooksPopover.value = false
  emit('select-notebook', notebook.id)
  emit('switch-view-mode', 'canvas')
}

// 显示菜单（固定区域）
function toggleMenu(notebookId: string, event: MouseEvent) {
  event.stopPropagation()
  openMenuNotebookId.value = openMenuNotebookId.value === notebookId ? null : notebookId
}

// 显示菜单（弹出菜单区域）
function togglePopoverMenu(notebookId: string, event: MouseEvent) {
  event.stopPropagation()
  openPopoverMenuNotebookId.value = openPopoverMenuNotebookId.value === notebookId ? null : notebookId
  showAllNotebooksMenu.value = false
}

// 显示全部笔记本菜单
function toggleAllNotebooksMenu(event: MouseEvent) {
  event.stopPropagation()
  showAllNotebooksMenu.value = !showAllNotebooksMenu.value
  openPopoverMenuNotebookId.value = null
}

// 固定/取消固定全部笔记本
function handleTogglePinAllNotebooks(event: MouseEvent) {
  event.stopPropagation()
  const newPinned = !settingsStore.settings.general.pinnedAllNotebooks
  settingsStore.updateSettings({
    general: { ...settingsStore.settings.general, pinnedAllNotebooks: newPinned }
  })
  showAllNotebooksMenu.value = false
}

// 开始重命名（固定区域）
function startRename(notebook: Notebook, event: MouseEvent) {
  event.stopPropagation()
  renamingNotebookId.value = notebook.id
  renameInputValue.value = notebook.name
  openMenuNotebookId.value = null
  nextTick(() => {
    if (renameInput.value) {
      renameInput.value.focus()
      renameInput.value.select()
    }
  })
}

// 开始重命名（弹出菜单区域）
function startPopoverRename(notebook: Notebook, event: MouseEvent) {
  event.stopPropagation()
  renamingNotebookId.value = notebook.id
  renameInputValue.value = notebook.name
  openPopoverMenuNotebookId.value = null
  nextTick(() => {
    if (renameInput.value) {
      renameInput.value.focus()
      renameInput.value.select()
    }
  })
}

// 确认重命名
async function confirmRename(notebook: Notebook) {
  const newName = renameInputValue.value.trim()
  if (newName && newName !== notebook.name) {
    notebook.name = newName
    await notebookStore.saveNotebook(notebook)
  }
  renamingNotebookId.value = null
}

// 取消重命名
function cancelRename() {
  renamingNotebookId.value = null
}

// 创建笔记本
function handleCreateNotebook(data: {
  name: string
  pdfPath?: string
  staticContextIds: string[]
  dynamicContextId?: string
}) {
  emit('create-notebook', data)
  showCreateNotebookDialog.value = false
}

// 创建笔记
function handleCreateNote() {
  emit('create-note')
}

// 拖拽处理
function handleSidebarDragOver(e: DragEvent) {
  // Allow drag over sidebar
}

function handleSidebarClick() {
  openMenuNotebookId.value = null
  openPopoverMenuNotebookId.value = null
  showAllNotebooksMenu.value = false
  showNotebooksPopover.value = false
}

function handleSidebarDrop(e: DragEvent) {
  isDragOverTrash.value = false
}

function handleTrashDragOver(e: DragEvent) {
  e.preventDefault()
  e.stopPropagation()
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'move'
  }
  isDragOverTrash.value = true
}

function handleTrashDragLeave() {
  isDragOverTrash.value = false
}

function handleTrashDrop(e: DragEvent) {
  e.preventDefault()
  e.stopPropagation()
  isDragOverTrash.value = false
  // TODO: 实现拖拽删除笔记本功能
}
</script>

<style scoped>
.unified-sidebar {
  width: 180px;
  height: 100%;
  background: var(--bg-primary);
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--border-color);
  flex-shrink: 0;
}

.sidebar-header {
  height: 60px;
  display: flex;
  align-items: center;
  padding: 0 16px;
  border-bottom: 1px solid var(--border-color);
  box-sizing: border-box;
  flex-shrink: 0;
}

.create-note-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  height: 36px;
  padding: 0 16px;
  background: var(--bg-secondary);
  border: none;
  border-radius: 8px;
  cursor: pointer;
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
  box-sizing: border-box;
}

.create-note-btn:hover {
  background: var(--bg-hover);
}

.create-note-btn svg {
  flex-shrink: 0;
}

/* 固定的搜索区域 */
.sidebar-search {
  padding: 8px;
  flex-shrink: 0;
}

.sidebar-search .nav-item {
  padding: 10px 16px;
}

/* 可滚动的中间导航区域 */
.sidebar-nav {
  flex: 1;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow-y: auto;
  min-height: 0;
}

/* 自定义滚动条样式 */
.sidebar-nav::-webkit-scrollbar {
  width: 6px;
}

.sidebar-nav::-webkit-scrollbar-track {
  background: transparent;
}

.sidebar-nav::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 3px;
}

.sidebar-nav::-webkit-scrollbar-thumb:hover {
  background: var(--text-secondary);
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: transparent;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  color: var(--text-secondary);
  font-size: 14px;
  transition: all 0.2s;
  text-align: left;
  width: 100%;
}

.nav-item:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.nav-item.active {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.nav-item svg {
  flex-shrink: 0;
}

.expand-icon {
  margin-left: auto;
  transition: transform 0.2s;
}

.expand-icon.expanded {
  transform: rotate(90deg);
}

/* 树状结构样式 */
.nav-tree-item {
  display: flex;
  flex-direction: column;
}

.tree-header {
  width: 100%;
}

.notebook-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-left: 12px;
  margin-top: 4px;
}

.notebook-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: var(--text-secondary);
  font-size: 13px;
  transition: all 0.2s;
  text-align: left;
  width: 100%;
}

.notebook-item:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.notebook-item.active {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.notebook-item.renaming {
  background: var(--bg-tertiary);
}

.rename-input {
  flex: 1;
  min-width: 0;
  padding: 2px 6px;
  border: 1px solid var(--color-primary);
  border-radius: 4px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
}

.rename-input::placeholder {
  color: var(--text-secondary);
}

.notebook-item span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 固定的笔记本列表 */
.pinned-notebooks-section {
  padding-left: 12px;
  margin-top: 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

/* 笔记本弹出菜单 */
.notebooks-popover {
  position: fixed;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 4px 16px var(--shadow-color);
  padding: 8px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
  z-index: 1000;
  min-width: 280px;
  max-width: 400px;
  max-height: 400px;
  overflow-y: auto;
}

.popover-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: var(--text-secondary);
  font-size: 13px;
  transition: all 0.2s;
  text-align: left;
  width: 100%;
  position: relative;
}

.popover-item:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.popover-item.active {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.popover-item.renaming {
  background: var(--bg-tertiary);
}

.popover-item span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.popover-item.create-notebook {
  grid-column: 1 / -1;
  color: var(--color-primary);
}

.popover-item.create-notebook:hover {
  background: var(--color-primary-light);
}

.popover-item.all-notebooks {
  font-weight: 500;
}

/* 弹出菜单内的菜单按钮 */
.popover-menu-wrapper {
  position: relative;
  margin-left: auto;
  flex-shrink: 0;
}

.popover-menu-btn {
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  opacity: 0;
}

.popover-menu-btn.visible {
  opacity: 1;
}

.popover-menu-btn:hover {
  color: var(--text-primary);
}

.popover-menu-dropdown {
  position: absolute;
  right: 0;
  top: 100%;
  margin-top: 4px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  box-shadow: 0 4px 12px var(--shadow-color);
  z-index: 1100;
  min-width: 120px;
  padding: 4px 0;
}

/* 笔记本菜单按钮 */
.notebook-menu-wrapper {
  position: relative;
  margin-left: auto;
  flex-shrink: 0;
}

.notebook-menu-btn {
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  opacity: 0;
}

.notebook-menu-btn.visible {
  opacity: 1;
}

.notebook-menu-btn:hover {
  color: var(--text-primary);
}

.notebook-menu-dropdown {
  position: absolute;
  right: 0;
  top: 100%;
  margin-top: 4px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  box-shadow: 0 4px 12px var(--shadow-color);
  z-index: 100;
  min-width: 120px;
  padding: 4px 0;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  width: 100%;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
}

.menu-item:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.menu-item.canvas-view:hover {
  background: var(--color-primary-light);
  color: var(--color-primary);
}

.menu-item.pin:hover,
.menu-item.unpin:hover {
  background: var(--color-primary-light);
  color: var(--color-primary);
}

.menu-item.delete:hover {
  background: rgba(255, 68, 68, 0.1);
  color: var(--color-error);
}

.all-notebooks {
  font-weight: 500;
}

.create-notebook {
  color: var(--color-primary);
}

.create-notebook:hover {
  background: var(--color-primary-light);
}

/* 回收站 - 固定在底部 */
.sidebar-trash {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  margin: 8px;
  border-radius: 8px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
  border: 2px dashed transparent;
  flex-shrink: 0;
}

.sidebar-trash:hover {
  background: rgba(255, 68, 68, 0.1);
  color: var(--color-error);
}

.sidebar-trash.drag-over {
  background: rgba(255, 68, 68, 0.15);
  border-color: var(--color-error);
  color: var(--color-error);
}

.sidebar-trash svg {
  flex-shrink: 0;
}

/* 删除确认对话框 */
.delete-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2600;
}

.delete-dialog {
  background: var(--bg-primary);
  border-radius: 12px;
  width: 90%;
  max-width: 400px;
  box-shadow: 0 8px 32px var(--shadow-color);
  overflow: hidden;
}

.delete-dialog .dialog-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border-bottom: 1px solid var(--border-color);
}

.delete-dialog .dialog-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 500;
  color: var(--text-primary);
}

.delete-dialog .warning-icon {
  color: var(--color-error);
}

.delete-dialog .dialog-body {
  padding: 16px;
}

.delete-dialog .dialog-body p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1.5;
}

.delete-dialog .dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid var(--border-color);
}

.delete-dialog .cancel-btn {
  padding: 8px 16px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.delete-dialog .cancel-btn:hover {
  background: var(--bg-hover);
}

.delete-dialog .delete-btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  background: var(--color-error);
  color: white;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.delete-dialog .delete-btn:hover {
  opacity: 0.9;
}
</style>