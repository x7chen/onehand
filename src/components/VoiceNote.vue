<template>
  <div
    ref="voiceNoteRef"
    class="voice-note"
    :data-node-id="node.id"
    :class="{ active: isActive, selected: node.selectedAsContext, 'show-header': showHeader, 'is-resizing': isResizing, 'popup-mode': popupMode }"
    :style="nodeStyle"
    @mousedown="handleVoiceNoteMouseDown"
    @click="handleClick"
    @mousedown.right.stop
    @mouseenter="handleMouseEnter"
  >
    <!-- 拖动调整宽度的手柄 -->
    <div
      class="resize-handle"
      @mousedown.stop="startResize"
    ></div>
    <div class="node-header" @mousedown="handleMouseDown" @mousedown.right.stop>
      <input
        type="checkbox"
        :checked="node.selectedAsContext"
        :disabled="popupMode || node.transcriptStatus !== 'done'"
        @change="toggleContext"
        @click.stop
      />
      <!-- Only show mic icon for voice-note type -->
      <div v-if="node.type === 'voice-note'" class="mic-icon-wrapper" @click="playAudio">
        <div class="mic-icon">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
          </svg>
          <div v-if="computedIsPlaying" class="playing-animation"></div>
        </div>
        <span v-if="node.duration" class="recording-duration">{{ formatDuration(node.duration) }}</span>
      </div>
      <!-- Text note type indicator -->
      <div v-else-if="node.type === 'text-note'" class="text-note-indicator">
        <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
          <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
        </svg>
      </div>
      <!-- Image note type indicator -->
      <div v-else-if="node.type === 'image-note'" class="image-note-indicator">
        <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
          <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
        </svg>
      </div>
      <!-- 功能按钮组 -->
      <div class="action-buttons" ref="actionButtonsRef">
        <!-- 收藏按钮 - 最高优先级 -->
        <button v-if="visibleButtons.includes('favorite')" class="action-btn favorite-btn" :class="{ active: isFavorite }" @click.stop="toggleFavorite" :title="isFavorite ? t('voiceNote.unfavorite') : t('voiceNote.favorite')">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
          </svg>
        </button>
        <!-- 重新生成按钮 -->
        <button v-if="visibleButtons.includes('regenerate')" class="action-btn regenerate-btn" @click.stop="handleRegenerate" :disabled="!canRegenerate || isAgentProcessing" :title="canRegenerate ? t('voiceNote.regenerate') : t('voiceNote.cannotRegenerate')">
          <svg v-if="!isAgentProcessing" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
          </svg>
          <svg v-else class="loading-spinner" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/>
            <path d="M12 2a10 10 0 0 1 10 10" stroke-opacity="1"/>
          </svg>
        </button>
        <!-- 隐藏 AI 回答按钮 -->
        <button v-if="visibleButtons.includes('hideAi')" class="action-btn hide-ai-btn" @click.stop="toggleHideAiResult" :title="isAiResultHidden ? t('voiceNote.showAiAnswer') : t('voiceNote.hideAiAnswer')">
          <svg v-if="!isAiResultHidden" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
          </svg>
          <svg v-else viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/>
          </svg>
        </button>
        <!-- 复制链接按钮 -->
        <button v-if="visibleButtons.includes('copyLink') && notebookId" class="action-btn copy-link-btn" @click.stop="handleCopyLink" :title="t('voiceNote.copyLink')">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/>
          </svg>
        </button>
        <!-- 标签按钮 - 最低优先级 -->
        <button v-if="visibleButtons.includes('tag')" class="action-btn tag-btn" @click.stop="toggleTagPopover" :class="{ active: showTagPopover }" :title="t('tag.title')">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M17.63 5.84C17.27 5.33 16.67 5 16 5L5 5.01C3.9 5.01 3 5.9 3 7v10c0 1.1.9 1.99 2 1.99L16 19c.67 0 1.27-.33 1.63-.84L22 12l-4.37-6.16z"/>
          </svg>
        </button>
      </div>
      <!-- 笔记标题 -->
      <input
        v-if="isEditingTitle"
        v-model="localTitle"
        class="node-title-input"
        @blur="saveTitle"
        @keydown.enter="handleSaveTitleEnter"
        @keydown.escape="cancelTitle"
        @mousedown.stop
        ref="titleInput"
      />
      <span v-else-if="node.title" class="node-title" @dblclick.stop="startEditTitle">{{ node.title }}</span>
      <span v-else class="node-title-placeholder" @dblclick.stop="startEditTitle"></span>
      <span class="created-time-wrapper">
        <span class="created-time-text">{{ formatCreatedTime }}</span>
      </span>
      <!-- 菜单按钮 -->
      <button v-if="!popupMode" class="menu-btn" @click.stop="toggleMenu" :class="{ active: showMenu }">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          <path d="M6 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm12 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
        </svg>
      </button>

      <!-- 抽屉菜单 -->
      <Teleport to="body">
        <div v-if="showMenu" class="menu-overlay" @click="closeMenu"></div>
        <div v-if="showMenu" class="node-menu-drawer" :style="menuStyle">
          <!-- 折叠的按钮项 - 按优先级从高到低排列 -->
          <!-- 收藏 - 折叠时显示（优先级最高） -->
          <button v-if="!visibleButtons.includes('favorite')" class="menu-item" @click.stop="handleMenuFavorite">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
            </svg>
            <span>{{ isFavorite ? t('voiceNote.unfavorite') : t('voiceNote.favorite') }}</span>
          </button>
          <!-- 重新生成 - 折叠时显示 -->
          <button v-if="!visibleButtons.includes('regenerate')" class="menu-item" :disabled="!canRegenerate || isAgentProcessing" @click.stop="handleMenuRegenerate">
            <svg v-if="!isAgentProcessing" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
            </svg>
            <svg v-else class="loading-spinner" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
              <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/>
              <path d="M12 2a10 10 0 0 1 10 10" stroke-opacity="1"/>
            </svg>
            <span>{{ t('voiceNote.regenerate') }}</span>
          </button>
          <!-- 隐藏AI回答 - 折叠时显示 -->
          <button v-if="!visibleButtons.includes('hideAi')" class="menu-item" @click.stop="handleMenuHideAi">
            <svg v-if="!isAiResultHidden" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
            </svg>
            <svg v-else viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/>
            </svg>
            <span>{{ isAiResultHidden ? t('voiceNote.showAiAnswer') : t('voiceNote.hideAiAnswer') }}</span>
          </button>
          <!-- 复制链接 - 折叠时显示 -->
          <button v-if="!visibleButtons.includes('copyLink') && notebookId" class="menu-item" @click.stop="handleMenuCopyLink">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/>
            </svg>
            <span>{{ t('voiceNote.copyLink') }}</span>
          </button>
          <!-- 标签 - 折叠时显示（优先级最低） -->
          <button v-if="!visibleButtons.includes('tag')" class="menu-item" @click.stop="handleMenuTag">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M17.63 5.84C17.27 5.33 16.67 5 16 5L5 5.01C3.9 5.01 3 5.9 3 7v10c0 1.1.9 1.99 2 1.99L16 19c.67 0 1.27-.33 1.63-.84L22 12l-4.37-6.16z"/>
            </svg>
            <span>{{ t('tag.title') }}</span>
          </button>
          <!-- 印象笔记 - 仅当有 ever_id 时显示 -->
          <button v-if="node.ever_id" class="menu-item" @click.stop="openEvernote">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
            <span>{{ t('voiceNote.openInEvernote') }}</span>
          </button>
          <!-- 详情 -->
          <button class="menu-item" @click.stop="openDetailsPopover">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
            </svg>
            <span>{{ t('voiceNote.details') }}</span>
          </button>
          <!-- 移动到 -->
          <button class="menu-item move-item" @click.stop="openMoveMenu">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
            </svg>
            <span>{{ t('voiceNote.moveTo') }}</span>
          </button>
          <!-- 分隔线 -->
          <div v-if="!allButtonsVisible || node.ever_id" class="menu-divider"></div>
          <!-- 删除按钮 - 永远在菜单中 -->
          <button class="menu-item delete-menu-item" @click.stop="deleteNode">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
            </svg>
            <span>{{ t('common.delete') }}</span>
          </button>
        </div>

        <!-- 移动到二级菜单 -->
        <div v-if="showMoveMenu" class="move-menu-overlay" @click="closeMoveMenu"></div>
        <div v-if="showMoveMenu" class="move-menu" :style="moveMenuStyle">
          <button
            v-for="nb in allNotebooks"
            :key="nb.id"
            class="move-menu-item"
            :class="{ current: nb.id === currentNotebookId }"
            :disabled="nb.id === currentNotebookId"
            @click.stop="handleMoveToNotebook(nb.id)"
          >
            <svg v-if="nb.pdfPath" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
            </svg>
            <svg v-else viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z"/>
            </svg>
            <span>{{ nb.name }}</span>
          </button>
        </div>

        <!-- 标签气泡 -->
        <div v-if="showTagPopover" class="tag-popover-overlay" @click="closeTagPopover"></div>
        <div v-if="showTagPopover" class="tag-popover" :style="tagPopoverStyle">
          <div class="tag-popover-header">
            <span class="tag-popover-title">{{ t('tag.title') }}</span>
            <button class="tag-manage-btn" :class="{ active: isManagingTags }" @click.stop="toggleManageTags" :title="t('tag.manage')">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
              </svg>
            </button>
          </div>
          <div v-if="nodeTags.length > 0" class="tag-list">
            <div
              v-for="tag in nodeTags"
              :key="tag.id"
              class="tag-item"
              :style="{ backgroundColor: tag.color + '20', borderColor: tag.color }"
            >
              <span class="tag-name" :style="{ color: tag.color }">{{ tag.name }}</span>
              <button v-if="isManagingTags" class="tag-remove-btn" @click.stop="removeTagFromNode(tag.name)" :title="t('common.delete')">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
              </button>
            </div>
          </div>
          <!-- 添加标签区域 -->
          <div class="tag-add-area" :class="{ 'has-tags': nodeTags.length > 0 }">
            <div v-if="!isAddingTag" class="tag-add-btn" @click.stop="startAddingTag">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
              </svg>
              <span>{{ t('tag.addTag') }}</span>
            </div>
            <div v-else class="tag-input-area">
              <input
                ref="tagInputRef"
                v-model="newTagInput"
                class="tag-input"
                :placeholder="t('tag.tagNamePlaceholder')"
                @keydown.enter="handleTagInputEnter"
                @keydown.escape="cancelAddingTag"
                @input="handleTagInputChange"
              />
              <!-- 自动补全下拉列表 -->
              <div v-if="showTagDropdown && filteredTags.length > 0" class="tag-dropdown">
                <div
                  v-for="tag in filteredTags"
                  :key="tag.id"
                  class="tag-dropdown-item"
                  :style="{ backgroundColor: tag.color + '20' }"
                  @click.stop="selectExistingTag(tag.name)"
                >
                  <span :style="{ color: tag.color }">{{ tag.name }}</span>
                </div>
              </div>
              <div class="tag-input-actions">
                <button class="tag-confirm-btn" @click.stop="confirmAddTag" :title="t('common.confirm')">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                  </svg>
                </button>
                <button class="tag-cancel-btn" @click.stop="cancelAddingTag" :title="t('common.cancel')">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- 右键上下文菜单 -->
        <div v-if="showContextMenu" class="context-menu-overlay" @click="closeContextMenu"></div>
        <div v-if="showContextMenu" class="context-menu" :style="contextMenuStyle">
          <button class="menu-item" @click.stop="handleCopySelection">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
            </svg>
            <span>{{ t('common.copy') }}</span>
          </button>
        </div>

        <!-- 关联笔记气泡 -->
        <div v-if="showRelatedNotesPopover" class="related-notes-popover-overlay" @click="closeRelatedNotesPopover"></div>
        <div v-if="showRelatedNotesPopover" class="related-notes-popover" :style="relatedNotesPopoverStyle">
          <div class="related-notes-header">
            <span class="related-notes-title">{{ t('voiceNote.relatedNotes') }}</span>
            <span v-if="!isSearchingRelated && relatedNotes.length > 0" class="related-notes-count">
              {{ relatedNotes.length }}
            </span>
          </div>
          <!-- 搜索中状态 -->
          <div v-if="isSearchingRelated" class="related-notes-loading">
            <div class="loading-spinner"></div>
            <span>{{ t('voiceNote.searchingRelated') }}</span>
          </div>
          <!-- 搜索结果列表 -->
          <div v-else-if="relatedNotes.length > 0" class="related-notes-list">
            <div
              v-for="result in relatedNotes"
              :key="result.nodeId + result.fieldType"
              class="related-note-item"
              @click.stop="navigateToRelatedNote(result)"
            >
              <div class="related-note-meta">
                <span class="related-notebook-name">{{ result.notebookName }}</span>
                <span v-if="result.nodeTitle" class="related-note-separator">·</span>
                <span v-if="result.nodeTitle" class="related-note-title">{{ result.nodeTitle }}</span>
                <span class="related-note-separator">·</span>
                <span class="related-note-similarity">{{ Math.round(result.similarity * 100) }}%</span>
              </div>
              <div class="related-note-preview">{{ getPreviewText(result.fullText) }}</div>
            </div>
          </div>
          <!-- 无结果状态 -->
          <div v-else class="related-notes-empty">
            <span>{{ t('voiceNote.noRelatedNotes') }}</span>
          </div>
        </div>

        <!-- 详情气泡 -->
        <div v-if="showDetailsPopover" class="details-popover-overlay" @click="closeDetailsPopover"></div>
        <div v-if="showDetailsPopover" class="details-popover" :style="detailsPopoverStyle">
          <div class="details-header">
            <span class="details-title">{{ t('voiceNote.noteDetails') }}</span>
            <button class="details-close-btn" @click.stop="closeDetailsPopover">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </button>
          </div>
          <div class="details-content">
            <!-- 标题 -->
            <div class="details-row">
              <span class="details-label">{{ t('voiceNote.detailsTitle') }}</span>
              <span class="details-value">{{ node.title || t('nodeList.noTitle') }}</span>
            </div>
            <!-- 所属笔记本 -->
            <div class="details-row">
              <span class="details-label">{{ t('voiceNote.detailsNotebook') }}</span>
              <span class="details-value">{{ notebookName }}</span>
            </div>
            <!-- 创建时间 -->
            <div class="details-row">
              <span class="details-label">{{ t('voiceNote.detailsCreatedAt') }}</span>
              <span class="details-value">{{ formatDateTime(node.createdAt) }}</span>
            </div>
            <!-- 更新时间 -->
            <div class="details-row">
              <span class="details-label">{{ t('voiceNote.detailsUpdatedAt') }}</span>
              <span class="details-value">{{ formatDateTime(node.updatedAt || node.createdAt) }}</span>
            </div>
            <!-- 标签 -->
            <div class="details-row">
              <span class="details-label">{{ t('voiceNote.detailsTags') }}</span>
              <span class="details-value">{{ nodeTags.length > 0 ? nodeTags.map(t => t.name).join(', ') : t('nav.noTags') }}</span>
            </div>
            <!-- 字数 -->
            <div class="details-row">
              <span class="details-label">{{ t('voiceNote.detailsWordCount') }}</span>
              <span class="details-value">{{ wordCount }} {{ t('context.wordCount', { count: wordCount }).replace(wordCount + '', '') }}</span>
            </div>
            <!-- 类型 -->
            <div class="details-row">
              <span class="details-label">{{ t('voiceNote.detailsType') }}</span>
              <span class="details-value">{{ getNodeTypeName(node.type) }}</span>
            </div>
          </div>
        </div>
      </Teleport>
    </div>

    <!-- 图片预览模式 -->
    <div v-if="node.type === 'image-note' && node.imagePath" class="image-box" @dblclick.stop>
      <img v-if="imageBlobUrl" :src="imageBlobUrl" class="image-preview" @load="handleImageLoad" />
      <div v-else class="image-loading">
        <span>{{ t('common.loading') }}</span>
      </div>
    </div>

    <div v-else-if="node.transcript && node.type !== 'image-note'" class="transcript-box">
      <div v-if="node.transcriptStatus === 'processing'" class="status-text">
        {{ t('common.converting') }}
      </div>
      <div v-else-if="node.transcriptStatus === 'error'" class="error-text">
        {{ node.transcript }}
        <button @click.stop="retryTranscription">{{ t('common.retry') }}</button>
      </div>
      <div v-else class="transcript-content-wrapper">
        <div
          class="transcript-content"
          draggable="true"
          @dragstart="handleTextDragStart"
          @dblclick.stop="handleEditTranscript"
          @contextmenu.prevent.stop="handleTextContextMenu"
          v-html="sanitizedTranscript"
        ></div>
        <!-- 关联笔记按钮 -->
        <button
          v-if="node.transcript"
          class="related-btn transcript-related-btn"
          @click.stop="(e: MouseEvent) => openRelatedNotesPopover(node.transcript || '', 'transcript', e)"
          :title="t('voiceNote.findRelated')"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
            <path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/>
          </svg>
        </button>
        <button
          v-if="node.transcript"
          class="copy-btn transcript-copy-btn"
          @click.stop="copyTranscript"
          :title="t('voiceNote.copyTranscript')"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
            <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- 思考过程显示区域 -->
    <div v-if="(node.thinkingContent || node.thinkingStatus === 'processing') && !isAiResultHidden" class="thinking-box" @dblclick.stop>
      <div class="thinking-header" @click="toggleThinkingExpanded">
        <svg class="thinking-arrow" :class="{ expanded: isThinkingExpanded }" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
        </svg>
        <span class="thinking-label">{{ t('voiceNote.thinking') }}</span>
        <span v-if="node.thinkingStatus === 'processing'" class="streaming-indicator thinking-indicator">
          <span class="dot"></span>
          <span class="dot"></span>
          <span class="dot"></span>
        </span>
      </div>
      <div v-show="isThinkingExpanded" class="thinking-content-wrapper">
        <div class="thinking-content" v-html="sanitizedThinkingContent"></div>
      </div>
    </div>

    <div v-if="(node.agentResult || node.agentStatus === 'processing') && !isAiResultHidden" class="agent-result-box" @dblclick.stop>
      <div class="agent-header">
        <span class="agent-label">{{ t('common.aiAnswer') }}</span>
        <span v-if="node.agentStatus === 'processing'" class="streaming-indicator">
          <span class="dot"></span>
          <span class="dot"></span>
          <span class="dot"></span>
        </span>
      </div>
      <div v-if="node.agentStatus === 'error'" class="error-text">
        {{ node.agentResult }}
        <button @click.stop="retryAgent">{{ t('common.retry') }}</button>
      </div>
      <div v-else class="agent-content-wrapper">
        <div
          class="agent-content"
          draggable="true"
          @dragstart="handleTextDragStart"
          @dblclick.stop="handleEditAgent"
          @contextmenu.prevent.stop="handleTextContextMenu"
          v-html="sanitizedAgentResult"
        ></div>
        <!-- 关联笔记按钮 -->
        <button
          v-if="node.agentResult"
          class="related-btn agent-related-btn"
          @click.stop="(e: MouseEvent) => openRelatedNotesPopover(node.agentResult || '', 'agentResult', e)"
          :title="t('voiceNote.findRelated')"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
            <path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/>
          </svg>
        </button>
        <button
          v-if="node.agentResult"
          class="copy-btn agent-copy-btn"
          @click.stop="copyAgentResult"
          :title="t('voiceNote.copyAiAnswer')"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
            <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
          </svg>
        </button>
      </div>
    </div>
  </div>

  <!-- 关联笔记详情弹窗 -->
  <NodePopup
    :visible="showRelatedNodePopup"
    :url="relatedNodeUrl"
    @close="closeRelatedNodePopup"
    @navigate="handleRelatedNodeNavigate"
  />
</template>

<script setup lang="ts">
import { ref, nextTick, watch, computed, onMounted, onUnmounted, watchEffect } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import NodePopup from '@/components/NodePopup.vue'
import { useNotebookStore } from '@/stores/notebookStore'
import { useTagStore } from '@/stores/tagStore'
import { useVectorStore } from '@/stores/vectorStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { formatDuration } from '@/utils/helpers'
import { renderMarkdown, renderMermaidCharts, processImagePaths } from '@/utils/markdownRenderer'
import { getNotebookDataDir, getNotebookImagesDir } from '@/utils/userFilesPath'
import { generateDeepLinkUrl, findNodeByNodeId } from '@/composables/useDeepLink'
import type { NodePopupData } from '@/composables/useDeepLink'
import type { CanvasNode, DisplayNode } from '@/types/notebook'
import type { SemanticSearchResult } from '@/types/embedding'

const router = useRouter()
const notebookStore = useNotebookStore()
const tagStore = useTagStore()
const vectorStore = useVectorStore()
const settingsStore = useSettingsStore()

const props = defineProps<{
  node: CanvasNode | DisplayNode
  notebookId?: string
  isPlaying?: boolean
  globalHideAiResult?: boolean
  isActive?: boolean
  activateOnHover?: boolean
  showHeader?: boolean
  popupMode?: boolean
}>()

const emit = defineEmits<{
  (e: 'delete', nodeId: string): void
  (e: 'play', nodeId: string): void
  (e: 'toggle-context', nodeId: string): void
  (e: 'retry-transcription', nodeId: string): void
  (e: 'retry-agent', nodeId: string): void
  (e: 'regenerate-agent', nodeId: string): void
  (e: 'toggle-favorite', nodeId: string): void
  (e: 'drag-start', nodeId: string, offsetX: number, offsetY: number): void
  (e: 'update-node', nodeId: string, updates: Partial<CanvasNode>): void
  (e: 'edit-transcript', nodeId: string): void
  (e: 'edit-agent', nodeId: string): void
  (e: 'activate', nodeId: string): void
  (e: 'copy-link', nodeId: string): void
  (e: 'navigate-to-note', notebookId: string, nodeId: string): void
}>()

const { t } = useI18n()

// 默认节点宽度
const DEFAULT_NODE_WIDTH = 450
const MIN_NODE_WIDTH = 300
const MAX_NODE_WIDTH = 800

// 按钮宽度常量
const BUTTON_WIDTH = 32  // 每个按钮宽度
const BUTTON_GAP = 4     // 按钮间距
const HEADER_PADDING = 8 // header 左右 padding
const CHECKBOX_WIDTH = 16 // checkbox 宽度
const MIC_ICON_WIDTH = 32 // mic icon 宽度
const TITLE_MIN_WIDTH = 60 // 标题最小宽度
const TIME_WIDTH = 130    // 时间显示宽度
const MENU_BTN_WIDTH = 28 // 菜单按钮宽度

// 按钮优先级（从低到高，优先级低的先折叠）
const BUTTON_PRIORITY = ['tag', 'copyLink', 'hideAi', 'regenerate', 'favorite'] as const
type ButtonType = typeof BUTTON_PRIORITY[number]

// action-buttons 容器引用
const actionButtonsRef = ref<HTMLElement | null>(null)

// 计算当前节点宽度下可见的按钮
const visibleButtons = computed<ButtonType[]>(() => {
  // popupMode 下只显示 favorite、copyLink、tag
  if (props.popupMode) {
    const buttons: ButtonType[] = ['favorite', 'tag']
    // copyLink 需要 notebookId
    if (props.notebookId) {
      buttons.push('copyLink')
    }
    return buttons
  }

  const width = props.node.width || DEFAULT_NODE_WIDTH

  // 计算可用于按钮的空间
  // 总宽度 - checkbox - mic icon - title - time - menu btn - paddings
  const availableForButtons = width - CHECKBOX_WIDTH - MIC_ICON_WIDTH - TITLE_MIN_WIDTH - TIME_WIDTH - MENU_BTN_WIDTH - HEADER_PADDING * 2 - BUTTON_GAP * 2

  // 计算最多能显示多少按钮
  const maxButtons = Math.floor((availableForButtons - BUTTON_GAP) / (BUTTON_WIDTH + BUTTON_GAP))

  // 如果能显示所有按钮，全部显示
  // copyLink 需要 notebookId
  const hasCopyLink = props.notebookId
  const allButtonsCount = hasCopyLink ? BUTTON_PRIORITY.length : BUTTON_PRIORITY.length - 1

  if (maxButtons >= allButtonsCount) {
    return [...BUTTON_PRIORITY]
  }

  // 按优先级从高到低保留按钮（优先级低的先被移除）
  // BUTTON_PRIORITY 是 [tag, copyLink, hideAi, regenerate, favorite] 从低到高
  // 所以我们从数组末尾开始保留（favorite 优先级最高，最后保留）
  const buttonsToShow: ButtonType[] = []
  let buttonsNeeded = maxButtons

  // 从高优先级开始添加
  for (let i = BUTTON_PRIORITY.length - 1; i >= 0 && buttonsNeeded > 0; i--) {
    const btn = BUTTON_PRIORITY[i]
    // copyLink 需要条件判断
    if (btn === 'copyLink' && !hasCopyLink) {
      continue
    }
    buttonsToShow.unshift(btn)
    buttonsNeeded--
  }

  return buttonsToShow
})

// 所有按钮是否都可见
const allButtonsVisible = computed(() => {
  const hasCopyLink = props.notebookId
  const allButtonsCount = hasCopyLink ? BUTTON_PRIORITY.length : BUTTON_PRIORITY.length - 1
  return visibleButtons.value.length >= allButtonsCount
})

// 拖动调整宽度相关
const isResizing = ref(false)
const resizeStartWidth = ref(0)
const resizeStartX = ref(0)

// 获取节点的显示位置（如果是 DisplayNode 使用 displayPosition，否则使用默认值）
const displayPosition = computed(() => {
  const node = props.node as DisplayNode
  return node.displayPosition || { x: 0, y: 0 }
})

// 节点样式（包含宽度）
const nodeStyle = computed(() => {
  const width = props.node.width || DEFAULT_NODE_WIDTH
  return {
    left: displayPosition.value.x + 'px',
    top: displayPosition.value.y + 'px',
    width: width + 'px',
    zIndex: props.isActive ? 1000 : 'auto'
  }
})

// 开始拖动调整宽度
function startResize(e: MouseEvent) {
  e.preventDefault()
  isResizing.value = true
  resizeStartWidth.value = props.node.width || DEFAULT_NODE_WIDTH
  resizeStartX.value = e.clientX

  document.addEventListener('mousemove', handleResizeMove)
  document.addEventListener('mouseup', handleResizeEnd)
  document.body.style.cursor = 'ew-resize'
  document.body.style.userSelect = 'none'
}

// 拖动调整宽度中
function handleResizeMove(e: MouseEvent) {
  if (!isResizing.value) return

  const deltaX = e.clientX - resizeStartX.value
  const newWidth = Math.max(MIN_NODE_WIDTH, Math.min(MAX_NODE_WIDTH, resizeStartWidth.value + deltaX))

  emit('update-node', props.node.id, { width: newWidth })
}

// 结束拖动调整宽度
function handleResizeEnd() {
  if (!isResizing.value) return

  isResizing.value = false
  document.removeEventListener('mousemove', handleResizeMove)
  document.removeEventListener('mouseup', handleResizeEnd)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
}

// 图片节点相关
const imageBlobUrl = ref<string | null>(null)

// 加载图片
async function loadImage() {
  if (props.node.type !== 'image-note' || !props.node.imagePath) {
    // 清理旧的blob URL
    if (imageBlobUrl.value) {
      URL.revokeObjectURL(imageBlobUrl.value)
      imageBlobUrl.value = null
    }
    return
  }

  // 清理旧的blob URL
  if (imageBlobUrl.value) {
    URL.revokeObjectURL(imageBlobUrl.value)
    imageBlobUrl.value = null
  }

  // 使用 props.notebookId 或 currentNotebook
  const notebookId = props.notebookId || notebookStore.currentNotebook?.id
  if (!notebookId) return

  const notebookDir = await getNotebookDataDir(notebookId)
  const fullPath = `${notebookDir}/${props.node.imagePath}`
  const result = await window.electronAPI.readFile(fullPath, 'arraybuffer')

  if (result.success && result.data) {
    const blob = new Blob([result.data])
    imageBlobUrl.value = URL.createObjectURL(blob)
  }
}

// 图片加载完成处理
function handleImageLoad() {
  // 图片加载完成，可以做一些处理
}

// 保存图片到笔记本目录并返回markdown链接
async function saveImageToNotebook(file: File): Promise<string | null> {
  // 使用 props.notebookId 或 currentNotebook
  const notebookId = props.notebookId || notebookStore.currentNotebook?.id
  if (!notebookId) {
    console.error('[VoiceNote] No notebook id')
    return null
  }

  try {
    const imagesDir = await getNotebookImagesDir(notebookId)

    // 确保images目录存在
    await window.electronAPI.mkdir(imagesDir)

    // 生成唯一文件名
    const ext = file.name.split('.').pop() || 'png'
    const imageId = `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const filename = `${imageId}.${ext}`
    const imagePath = `${imagesDir}/${filename}`
    const relativePath = `images/${filename}`

    // 读取文件内容并保存
    const arrayBuffer = await file.arrayBuffer()
    await window.electronAPI.saveFileBuffer(imagePath, arrayBuffer)

    // 返回markdown图片链接
    return `\n![${file.name}](${relativePath})\n`
  } catch (error) {
    console.error('[VoiceNote] Failed to save image:', error)
    return null
  }
}

// 监听节点ID变化，重新加载图片
watch(() => props.node.id, () => {
  loadImage()
})

// 使用外部传入的 isPlaying 或本地状态
const localIsPlaying = ref(false)
const computedIsPlaying = computed(() => props.isPlaying ?? localIsPlaying.value)

// 本地 AI 回答隐藏状态
const isAiResultHidden = ref(false)

// 思考过程展开状态（默认收起）
const isThinkingExpanded = ref(false)

// Markdown 渲染结果
const sanitizedThinkingContent = ref('')

// 笔记标题编辑
const isEditingTitle = ref(false)
const localTitle = ref('')
const titleInput = ref<HTMLInputElement | null>(null)

function startEditTitle() {
  localTitle.value = props.node.title || ''
  isEditingTitle.value = true
  nextTick(() => {
    if (titleInput.value) {
      titleInput.value.focus()
      titleInput.value.select()
    }
  })
}

// 处理 Enter 键保存标题（检查输入法组合状态）
function handleSaveTitleEnter(event: KeyboardEvent) {
  if (event.isComposing) return
  saveTitle()
}

function saveTitle() {
  const newTitle = localTitle.value.trim()
  isEditingTitle.value = false
  if (newTitle !== props.node.title) {
    emit('update-node', props.node.id, { title: newTitle || undefined })
  }
}

function cancelTitle() {
  isEditingTitle.value = false
}

// 监听全局隐藏状态变化
watch(() => props.globalHideAiResult, (newVal) => {
  if (newVal !== undefined) {
    isAiResultHidden.value = newVal
  }
}, { immediate: true })

// 暴露属性给父组件
defineExpose({
  nodeId: computed(() => props.node.id)
})

// 收藏状态计算属性
const isFavorite = computed(() => props.node.isFavorite ?? false)

// 格式化创建时间
const formatCreatedTime = computed(() => {
  const timestamp = props.node.createdAt
  if (!timestamp) return ''
  const date = new Date(timestamp)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}`
})

// 重新生成按钮是否可用
// 如果 agent-content 内容不为空且 agent-result-box 隐藏，则重新生成按钮失效，否则重新生成按钮有效
const canRegenerate = computed(() => {
  // 如果 agent-content 内容不为空且 agent-result-box 隐藏，则失效
  if (props.node.agentResult && isAiResultHidden.value) {
    return false
  }
  // 否则有效
  return true
})

// AI是否正在处理中（processing状态显示加载动画并禁用按钮）
const isAgentProcessing = computed(() => {
  return props.node.agentStatus === 'processing'
})

// 菜单相关
const showMenu = ref(false)
const menuStyle = ref<{ top: string; right: string }>({ top: '0px', right: '0px' })

// 右键上下文菜单
const showContextMenu = ref(false)
const contextMenuStyle = ref<{ top: string; left: string }>({ top: '0px', left: '0px' })

// 移动菜单相关
const showMoveMenu = ref(false)
const moveMenuStyle = ref<{ top: string; left: string }>({ top: '0px', left: '0px' })

// 所有笔记本
const allNotebooks = computed(() => notebookStore.notebooks)

// 当前笔记本ID
const currentNotebookId = computed(() => {
  const map = notebookStore.getNodeToNotebookMap()
  const nb = map.get(props.node.id)
  return nb?.id
})

function toggleMenu(e: MouseEvent) {
  if (showMenu.value) {
    showMenu.value = false
  } else {
    // 计算菜单位置
    const btn = (e.currentTarget as HTMLElement)
    const rect = btn.getBoundingClientRect()
    menuStyle.value = {
      top: `${rect.bottom + 4}px`,
      right: `${window.innerWidth - rect.right}px`
    }
    showMenu.value = true
  }
}

function closeMenu() {
  showMenu.value = false
  showMoveMenu.value = false
}

// 移动菜单相关函数
function openMoveMenu(e: MouseEvent) {
  const btn = e.currentTarget as HTMLElement
  const rect = btn.getBoundingClientRect()
  // 计算左侧位置，确保不超出屏幕
  const menuWidth = 180
  const leftPos = rect.left - menuWidth - 8
  // 确保不超出屏幕左侧
  const finalLeft = Math.max(8, leftPos)
  moveMenuStyle.value = {
    top: `${rect.top}px`,
    left: `${finalLeft}px`
  }
  showMoveMenu.value = true
}

function closeMoveMenu() {
  showMoveMenu.value = false
}

async function handleMoveToNotebook(notebookId: string) {
  if (notebookId === currentNotebookId.value) return
  const success = await notebookStore.moveNodeToNotebook(props.node.id, notebookId)
  if (success) {
    closeMoveMenu()
    closeMenu()
  }
}

// 菜单中折叠按钮的处理函数
function handleMenuTag() {
  closeMenu()
  // 打开标签气泡
  const voiceNoteEl = voiceNoteRef.value
  if (voiceNoteEl) {
    const rect = voiceNoteEl.getBoundingClientRect()
    const btnRect = rect // 使用整个节点位置
    tagPopoverStyle.value = {
      top: `${btnRect.top + 32}px`,
      left: `${btnRect.left}px`
    }
    showTagPopover.value = true
  }
}

function handleMenuCopyLink() {
  closeMenu()
  handleCopyLink()
}

function handleMenuHideAi() {
  closeMenu()
  toggleHideAiResult()
}

function handleMenuRegenerate() {
  if (!canRegenerate.value) return
  closeMenu()
  handleRegenerate()
}

function handleMenuFavorite() {
  closeMenu()
  toggleFavorite()
}

// 标签气泡相关
const showTagPopover = ref(false)
const tagPopoverStyle = ref<{ top: string; left: string }>({ top: '0px', left: '0px' })
const isAddingTag = ref(false)
const isManagingTags = ref(false)
const newTagInput = ref('')
const tagInputRef = ref<HTMLInputElement | null>(null)
const showTagDropdown = ref(false)
const filteredTags = ref<Tag[]>([])

import type { Tag } from '@/types/tag'

// 详情气泡相关
const showDetailsPopover = ref(false)
const detailsPopoverStyle = ref<{ top: string; left: string }>({ top: '0px', left: '0px' })

// 笔记本名称（通过节点ID查找实际所属的笔记本，优先级最高）
const notebookName = computed(() => {
  // 优先通过节点ID在所有笔记本中查找实际所属的笔记本
  const nodeNotebook = notebookStore.notebooks.find(nb => nb.nodes?.some(n => n.id === props.node.id))
  if (nodeNotebook) return nodeNotebook.name
  // 如果找不到，使用 notebookId prop（如果有的话）
  if (props.notebookId) {
    const notebook = notebookStore.notebooks.find(n => n.id === props.notebookId)
    if (notebook) return notebook.name
  }
  // 最后使用当前笔记本（如果有的话）
  if (notebookStore.currentNotebook) return notebookStore.currentNotebook.name
  return t('notebook.myNotebooks')
})

// 字数统计
const wordCount = computed(() => {
  const transcript = props.node.transcript || ''
  const agentResult = props.node.agentResult || ''
  const totalText = transcript + agentResult
  // 统计中文字符和英文单词
  const chineseChars = totalText.match(/[一-龥]/g)?.length || 0
  const englishWords = totalText.match(/[a-zA-Z]+/g)?.length || 0
  return chineseChars + englishWords
})

// 格式化日期时间
function formatDateTime(timestamp: number) {
  const date = new Date(timestamp)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}`
}

// 获取节点类型名称
function getNodeTypeName(type: string) {
  switch (type) {
    case 'voice-note':
      return t('voiceNote.detailsVoiceNote')
    case 'text-note':
      return t('voiceNote.detailsTextNote')
    case 'image-note':
      return t('voiceNote.detailsImageNote')
    default:
      return type
  }
}

function openDetailsPopover() {
  closeMenu()
  const voiceNoteEl = voiceNoteRef.value
  if (voiceNoteEl) {
    // 找到菜单按钮的位置，使气泡与按钮右对齐
    const menuBtn = voiceNoteEl.querySelector('.menu-btn') as HTMLElement
    const popoverWidth = 280

    if (menuBtn) {
      const btnRect = menuBtn.getBoundingClientRect()
      // 气泡右边缘与按钮右边缘对齐
      let left = btnRect.right - popoverWidth

      // 确保不超出左边界
      if (left < 8) {
        left = 8
      }

      detailsPopoverStyle.value = {
        top: `${btnRect.bottom + 4}px`,
        left: `${left}px`
      }
    } else {
      // 如果找不到按钮，使用节点位置
      const rect = voiceNoteEl.getBoundingClientRect()
      let left = rect.right - popoverWidth
      if (left < 8) {
        left = 8
      }
      detailsPopoverStyle.value = {
        top: `${rect.bottom + 4}px`,
        left: `${left}px`
      }
    }
    showDetailsPopover.value = true
  }
}

function closeDetailsPopover() {
  showDetailsPopover.value = false
}

// 获取节点标签（带颜色信息）
const nodeTags = computed<Tag[]>(() => {
  const tagNames = props.node.tags || []
  return tagNames.map(name => {
    const tag = tagStore.getTagByName(name)
    if (tag) {
      return tag
    }
    // 如果标签不存在于 store，创建临时标签对象
    return {
      id: `temp-${name}`,
      name,
      color: tagStore.getNextColor(),
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
  })
})

function toggleTagPopover(e: MouseEvent) {
  if (showTagPopover.value) {
    closeTagPopover()
  } else {
    const btn = (e.currentTarget as HTMLElement)
    const rect = btn.getBoundingClientRect()
    tagPopoverStyle.value = {
      top: `${rect.bottom + 4}px`,
      left: `${rect.left}px`
    }
    showTagPopover.value = true
    isAddingTag.value = false
    newTagInput.value = ''
  }
}

function closeTagPopover() {
  showTagPopover.value = false
  isAddingTag.value = false
  isManagingTags.value = false
  newTagInput.value = ''
  showTagDropdown.value = false
}

function toggleManageTags() {
  isManagingTags.value = !isManagingTags.value
}

function startAddingTag() {
  isAddingTag.value = true
  newTagInput.value = ''
  showTagDropdown.value = false
  nextTick(() => {
    tagInputRef.value?.focus()
  })
}

function cancelAddingTag() {
  isAddingTag.value = false
  newTagInput.value = ''
  showTagDropdown.value = false
}

// 处理 Enter 键添加标签（检查输入法组合状态）
function handleTagInputEnter(event: KeyboardEvent) {
  if (event.isComposing) return
  event.preventDefault()
  confirmAddTag()
}

async function handleTagInputChange() {
  const query = newTagInput.value.trim()
  if (query) {
    filteredTags.value = tagStore.searchTags(query)
    showTagDropdown.value = filteredTags.value.length > 0
  } else {
    showTagDropdown.value = false
    filteredTags.value = []
  }
}

async function selectExistingTag(tagName: string) {
  // 确保 store 中有这个标签
  await tagStore.ensureTagExists(tagName)

  // 添加到节点
  const currentTags = props.node.tags || []
  if (!currentTags.includes(tagName)) {
    emit('update-node', props.node.id, { tags: [...currentTags, tagName] })
  }

  // 重置输入状态
  isAddingTag.value = false
  newTagInput.value = ''
  showTagDropdown.value = false
}

async function confirmAddTag() {
  const tagName = newTagInput.value.trim()
  if (!tagName) {
    cancelAddingTag()
    return
  }

  // 创建或获取标签
  await tagStore.ensureTagExists(tagName)

  // 添加到节点
  const currentTags = props.node.tags || []
  if (!currentTags.includes(tagName)) {
    emit('update-node', props.node.id, { tags: [...currentTags, tagName] })
  }

  // 重置输入状态
  isAddingTag.value = false
  newTagInput.value = ''
  showTagDropdown.value = false
}

function removeTagFromNode(tagName: string) {
  const currentTags = props.node.tags || []
  const newTags = currentTags.filter(t => t !== tagName)
  emit('update-node', props.node.id, { tags: newTags })
}

// 关联笔记气泡相关
const showRelatedNotesPopover = ref(false)
const relatedNotesPopoverStyle = ref<{ top: string; right: string }>({ top: '0px', right: '0px' })
const relatedNotes = ref<SemanticSearchResult[]>([])
const isSearchingRelated = ref(false)
const relatedNotesSource = ref<'transcript' | 'agentResult'>('transcript')

// 关联笔记详情弹窗
const showRelatedNodePopup = ref(false)
const relatedNodeUrl = ref('')
const relatedNodeData = ref<NodePopupData | null>(null)

// 打开关联笔记气泡
async function openRelatedNotesPopover(text: string, source: 'transcript' | 'agentResult', event: MouseEvent) {
  const btn = event.currentTarget as HTMLElement
  const rect = btn.getBoundingClientRect()
  relatedNotesPopoverStyle.value = {
    top: `${rect.bottom + 4}px`,
    right: `${window.innerWidth - rect.right}px`
  }
  showRelatedNotesPopover.value = true
  relatedNotesSource.value = source
  relatedNotes.value = []
  isSearchingRelated.value = true

  // 执行语义搜索
  try {
    const results = await vectorStore.semanticSearch(text, 10)
    // 过滤掉当前节点本身
    relatedNotes.value = results.filter(r => r.nodeId !== props.node.id)
  } catch (error) {
    console.error('Semantic search error:', error)
    relatedNotes.value = []
  } finally {
    isSearchingRelated.value = false
  }
}

// 关闭关联笔记气泡
function closeRelatedNotesPopover() {
  showRelatedNotesPopover.value = false
  relatedNotes.value = []
  isSearchingRelated.value = false
}

// 跳转到关联笔记（显示详情弹窗）
async function navigateToRelatedNote(result: SemanticSearchResult) {
  // 查找节点数据
  const nodeData = await findNodeByNodeId(result.nodeId)
  if (nodeData) {
    relatedNodeData.value = nodeData
    relatedNodeUrl.value = generateDeepLinkUrl(result.nodeId)
    showRelatedNodePopup.value = true
  }
}

// 关闭关联笔记详情弹窗
function closeRelatedNodePopup() {
  showRelatedNodePopup.value = false
  relatedNodeUrl.value = ''
  relatedNodeData.value = null
}

// 从关联笔记弹窗跳转到笔记位置
function handleRelatedNodeNavigate(data: { notebookId: string; nodeId: string }) {
  closeRelatedNodePopup()

  // 找到目标笔记本并跳转
  const notebook = notebookStore.notebooks.find(n => n.id === data.notebookId)
  if (notebook) {
    notebookStore.setCurrentNotebook(notebook)

    // 根据笔记本类型跳转到对应页面
    if (notebook.pdfPath) {
      router.push(`/pdf/${data.notebookId}?nodeId=${data.nodeId}`)
    } else {
      router.push(`/multi-chat/${data.notebookId}?nodeId=${data.nodeId}`)
    }
  }
}

// 获取关联笔记预览文本（截取前50字符）
function getPreviewText(text: string): string {
  if (text.length <= 50) return text
  return text.slice(0, 50) + '...'
}

// 右键上下文菜单处理
function handleTextContextMenu(e: MouseEvent) {
  const selection = window.getSelection()
  const selectedText = selection?.toString().trim()

  if (selectedText && selectedText.length > 0) {
    contextMenuStyle.value = {
      top: `${e.clientY}px`,
      left: `${e.clientX}px`
    }
    showContextMenu.value = true
  }
}

function closeContextMenu() {
  showContextMenu.value = false
}

async function handleCopySelection() {
  const selection = window.getSelection()
  const selectedText = selection?.toString().trim()

  if (selectedText) {
    try {
      await navigator.clipboard.writeText(selectedText)
    } catch (error) {
      console.error('Copy failed:', error)
    }
  }
  closeContextMenu()
}

// Markdown 渲染结果
const sanitizedTranscript = ref('')
const sanitizedAgentResult = ref('')

// 编辑转写内容
function handleEditTranscript() {
  if (props.node.transcriptStatus !== 'done') return
  emit('edit-transcript', props.node.id)
}

// 编辑AI回答
function handleEditAgent() {
  if (props.node.agentStatus !== 'done') return
  emit('edit-agent', props.node.id)
}

// Prevent cross-node text selection
function handleVoiceNoteMouseDown(e: MouseEvent) {
  // If clicking on this node's content, clear any existing selection first
  // This prevents selecting text across multiple nodes
  const target = e.target as HTMLElement
  if (target.closest('.transcript-content') || target.closest('.agent-content')) {
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      // Check if the selection starts outside this node
      const voiceNote = target.closest('.voice-note')
      if (voiceNote && !voiceNote.contains(range.startContainer)) {
        // Selection started in another node - clear it and start fresh
        selection.removeAllRanges()
      }
    }
  }
}

// 处理点击事件，激活节点
function handleClick(e: MouseEvent) {
  // 阻止事件冒泡，防止触发画布点击
  e.stopPropagation()

  // 如果菜单打开，关闭菜单
  if (showMenu.value) {
    showMenu.value = false
  }

  // 发送激活事件
  emit('activate', props.node.id)
}

function handleMouseEnter() {
  // 鼠标移入时激活节点，将其置于顶层（仅当 activateOnHover 为 true 时）
  if (props.activateOnHover !== false) {
    emit('activate', props.node.id)
  }
}

function handleMouseDown(e: MouseEvent) {
  // 右键不处理，让画布捕获用于拖拽
  if (e.button === 2) {
    return
  }

  e.stopPropagation()
  e.preventDefault()

  // Only allow drag if clicking directly on the header, not on text content
  const target = e.target as HTMLElement
  if (target.closest('.transcript-content') || target.closest('.agent-content') ||
      target.closest('.transcript-edit') || target.closest('.agent-edit') ||
      target.closest('.node-title-input')) {
    return // Don't drag when clicking on text content
  }

  // Get the voice-note element (parent of node-header)
  const voiceNoteEl = (e.currentTarget as HTMLElement).parentElement
  if (voiceNoteEl) {
    const rect = voiceNoteEl.getBoundingClientRect()
    const offsetX = e.clientX - rect.left
    const offsetY = e.clientY - rect.top
    emit('drag-start', props.node.id, offsetX, offsetY)
  }
}

function toggleContext() {
  emit('toggle-context', props.node.id)
}

function playAudio() {
  localIsPlaying.value = true
  emit('play', props.node.id)
  setTimeout(() => {
    localIsPlaying.value = false
  }, 3000)
}

// 打开印象笔记链接
function openEvernote() {
  if (!props.node.ever_id) return
  const prefix = settingsStore.settings.general.evernoteLinkPrefix || 'evernote:///view/3248616/s15/'
  const evernoteUrl = `${prefix}${props.node.ever_id}/${props.node.ever_id}/`
  window.open(evernoteUrl, '_blank')
  closeMenu()
}

function deleteNode() {
  showMenu.value = false
  emit('delete', props.node.id)
}

// 收藏功能
function toggleFavorite() {
  emit('toggle-favorite', props.node.id)
}

// 隐藏/显示 AI 回答
function toggleHideAiResult() {
  isAiResultHidden.value = !isAiResultHidden.value
}

// 展开/收起思考过程
function toggleThinkingExpanded() {
  isThinkingExpanded.value = !isThinkingExpanded.value
}

// 重新生成 AI 回答
function handleRegenerate() {
  if (!canRegenerate.value) return
  emit('regenerate-agent', props.node.id)
}

function handleTextDragStart(e: DragEvent) {
  // Get currently selected text
  const selectedText = window.getSelection()?.toString()

  if (selectedText && selectedText.trim() !== '') {
    // User has selected some text - drag only the selection
    if (e.dataTransfer) {
      e.dataTransfer.setData('text/plain', selectedText)
      e.dataTransfer.effectAllowed = 'copy'

      // Set drag image/visual feedback
      const dragGhost = document.createElement('div')
      dragGhost.style.background = 'var(--color-primary)'
      dragGhost.style.color = 'white'
      dragGhost.style.padding = '8px 12px'
      dragGhost.style.borderRadius = '4px'
      dragGhost.style.fontSize = '12px'
      dragGhost.style.position = 'absolute'
      dragGhost.style.top = '-9999px'
      dragGhost.textContent = t('canvas.dragToAsk', { count: selectedText.length })
      document.body.appendChild(dragGhost)
      e.dataTransfer.setDragImage(dragGhost, 0, 0)
      setTimeout(() => document.body.removeChild(dragGhost), 0)
    }
  } else {
    // No selection - prevent drag (don't drag entire content by default)
    e.preventDefault()
  }
}

function retryTranscription() {
  emit('retry-transcription', props.node.id)
}

function retryAgent() {
  emit('retry-agent', props.node.id)
}

// 复制转写内容
async function copyTranscript() {
  if (!props.node.transcript) return
  try {
    await navigator.clipboard.writeText(props.node.transcript)
  } catch (error) {
    console.error('复制失败:', error)
  }
}

// 复制 AI 回答
async function copyAgentResult() {
  if (!props.node.agentResult) return
  try {
    await navigator.clipboard.writeText(props.node.agentResult)
  } catch (error) {
    console.error('复制失败:', error)
  }
}

// 复制笔记链接
async function handleCopyLink() {
  const url = `onehand://${props.node.id}`
  try {
    await navigator.clipboard.writeText(url)
    console.log('Link copied:', url)
  } catch (error) {
    console.error('复制链接失败:', error)
  }
  emit('copy-link', props.node.id)
}

// 组件卸载时清理定时器
onUnmounted(() => {
  if (transcriptDebounceTimer) {
    clearTimeout(transcriptDebounceTimer)
  }
  if (renderDebounceTimer) {
    clearTimeout(renderDebounceTimer)
  }
  // 清理图片 blob URL
  if (imageBlobUrl.value) {
    URL.revokeObjectURL(imageBlobUrl.value)
  }
  // 清理 resize 事件监听器
  if (isResizing.value) {
    document.removeEventListener('mousemove', handleResizeMove)
    document.removeEventListener('mouseup', handleResizeEnd)
  }
})

// 组件引用
const voiceNoteRef = ref<HTMLElement | null>(null)

// 渲染 Mermaid 图表
async function renderMermaid() {
  if (voiceNoteRef.value) {
    // 等待 DOM 完全更新
    await nextTick()
    const result = await renderMermaidCharts(voiceNoteRef.value)

    // 如果渲染了 Mermaid 图表，触发重新测量高度
    if (result && result > 0) {
      // 通知父组件重新测量高度
      emit('update-node', props.node.id, {})
    }
  }
}

// 当组件挂载时渲染 Markdown 和 Mermaid
onMounted(async () => {
  // 加载图片节点的图片
  if (props.node.type === 'image-note') {
    await loadImage()
  }

  // 使用 props.notebookId 或 currentNotebook
  const notebookId = props.notebookId || notebookStore.currentNotebook?.id

  if (props.node.transcript) {
    let html = await renderMarkdown(props.node.transcript)
    // 处理相对路径图片
    if (notebookId) {
      html = await processImagePaths(html, notebookId)
    }
    sanitizedTranscript.value = html
  }

  if (props.node.agentResult) {
    let html = await renderMarkdown(props.node.agentResult)
    // 处理相对路径图片
    if (notebookId) {
      html = await processImagePaths(html, notebookId)
    }
    sanitizedAgentResult.value = html
  }

  // 渲染 Mermaid 图表 - 等待 DOM 更新
  await nextTick()
  await nextTick()
  await renderMermaid()
})

// 监听 transcript 变化，重新渲染 Markdown
// 使用防抖优化渲染性能
let transcriptDebounceTimer: number | null = null
watch(() => props.node.transcript, async (newTranscript) => {
  if (transcriptDebounceTimer) {
    clearTimeout(transcriptDebounceTimer)
  }

  transcriptDebounceTimer = window.setTimeout(async () => {
    let html = newTranscript ? await renderMarkdown(newTranscript) : ''
    // 处理相对路径图片
    const notebookId = props.notebookId || notebookStore.currentNotebook?.id
    if (notebookId && html) {
      html = await processImagePaths(html, notebookId)
    }
    sanitizedTranscript.value = html
    transcriptDebounceTimer = null
    // 渲染 Mermaid
    await nextTick()
    await nextTick()
    await renderMermaid()
  }, 100)
})

// 监听 agentResult 变化，重新渲染 Markdown（包括流式更新）
// 使用防抖优化流式渲染性能
let renderDebounceTimer: number | null = null
watch(() => props.node.agentResult, async (newAgentResult) => {
  // 清除之前的定时器
  if (renderDebounceTimer) {
    clearTimeout(renderDebounceTimer)
  }

  if (newAgentResult) {
    // 流式模式下，使用短延迟渲染 Markdown 以避免频繁重渲染
    // 在 processing 状态下使用更短的延迟（50ms）以实现流畅的流式效果
    const delay = props.node.agentStatus === 'processing' ? 50 : 100
    renderDebounceTimer = window.setTimeout(async () => {
      let html = await renderMarkdown(newAgentResult)
      // 处理相对路径图片（仅在非流式模式下，避免频繁处理）
      if (props.node.agentStatus !== 'processing') {
        const notebookId = props.notebookId || notebookStore.currentNotebook?.id
        if (notebookId) {
          html = await processImagePaths(html, notebookId)
        }
      }
      sanitizedAgentResult.value = html
      renderDebounceTimer = null
      // 渲染 Mermaid
      await nextTick()
      await nextTick()
      await renderMermaid()
    }, delay)
  } else {
    sanitizedAgentResult.value = ''
  }
}, { immediate: true })

// 监听 thinkingContent 变化，重新渲染 Markdown（包括流式更新）
let thinkingDebounceTimer: number | null = null
watch(() => props.node.thinkingContent, async (newThinkingContent) => {
  if (thinkingDebounceTimer) {
    clearTimeout(thinkingDebounceTimer)
  }

  if (newThinkingContent) {
    const delay = props.node.thinkingStatus === 'processing' ? 50 : 100
    thinkingDebounceTimer = window.setTimeout(async () => {
      const html = await renderMarkdown(newThinkingContent)
      sanitizedThinkingContent.value = html
      thinkingDebounceTimer = null
      await nextTick()
      await renderMermaid()
    }, delay)
  } else {
    sanitizedThinkingContent.value = ''
  }
}, { immediate: true })
</script>

<style scoped>
.voice-note {
  position: absolute;
  background: var(--bg-secondary);
  border-radius: 8px;
  box-shadow: 0 2px 8px var(--shadow-color);
  padding: 4px;
  box-sizing: border-box;
  contain: layout style paint;
  transition: box-shadow 0.2s;
}

:root.dark .voice-note {
  background: var(--bg-primary);
}

.voice-note.active {
  box-shadow: 0 4px 20px rgba(66, 153, 225, 0.4), 0 0 0 3px var(--color-primary);
  border: 1px solid var(--color-primary);
}

/* 拖动调整宽度的手柄 */
.resize-handle {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 6px;
  cursor: ew-resize;
  z-index: 10;
  border-radius: 0 8px 8px 0;
  transition: background-color 0.2s;
}

.resize-handle:hover {
  background-color: var(--color-primary-light);
}

.voice-note.is-resizing {
  transition: none;
}

.voice-note.is-resizing .resize-handle {
  background-color: var(--color-primary);
}

.node-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  cursor: move;
  user-select: none;
  opacity: 0;
  height: 0;
  margin-bottom: 0;
  overflow: hidden;
  transition: opacity 0.2s, height 0.2s, margin-bottom 0.2s;
}

.voice-note.selected .node-header,
.voice-note.show-header .node-header,
.voice-note.active .node-header {
  opacity: 1;
  height: 32px;
  margin-bottom: 8px;
}

/* popupMode 下的 checkbox 禁用样式 */
.voice-note.popup-mode .node-header input[type="checkbox"] {
  opacity: 0.4;
  cursor: not-allowed;
}

.mic-icon-wrapper {
  display: flex;
  align-items: center;
  gap: 6px;
}

.text-note-indicator {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--bg-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-primary);
  flex-shrink: 0;
}

.image-note-indicator {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--bg-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-success);
  flex-shrink: 0;
}

.mic-icon {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--bg-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  position: relative;
  transition: background 0.2s;
  flex-shrink: 0;
}

.mic-icon:hover {
  background: var(--border-color);
}

.playing-animation {
  position: absolute;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  border: 2px solid var(--color-primary);
  animation: ripple 1s infinite;
}

@keyframes ripple {
  0% {
    transform: scale(1);
    opacity: 1;
  }
  100% {
    transform: scale(1.5);
    opacity: 0;
  }
}

.recording-duration {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 500;
  white-space: nowrap;
  min-width: 40px;
}

.node-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 90px;
  margin: 0 auto;
  text-align: center;
  cursor: text;
}

.node-title-placeholder {
  display: inline-block;
  width: 90px;
  height: 20px;
  margin: 0 auto;
  border: 1px dashed transparent;
  border-radius: 4px;
  cursor: text;
  transition: border-color 0.2s;
}

.node-title-placeholder:hover {
  border-color: var(--text-secondary);
}

.node-title-input {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  background: var(--bg-secondary);
  border: 1px solid var(--color-primary);
  border-radius: 4px;
  padding: 2px 4px;
  max-width: 200px;
  margin: 0 auto;
  text-align: center;
  outline: none;
}

.created-time-wrapper {
  display: flex;
  justify-content: flex-end;
  margin-left: auto;
  margin-right: 8px;
  min-width: 0;
  flex-shrink: 1;
  font-size: 12px;
  color: var(--text-secondary);
  overflow: hidden;
}

.created-time-text {
  white-space: nowrap;
}

.menu-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  color: var(--text-secondary);
  transition: all 0.2s;
  flex-shrink: 0;
}

.menu-btn:hover,
.menu-btn.active {
  background: var(--bg-hover);
  color: var(--text-primary);
}

/* 菜单遮罩层 */
.menu-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 2000;
}

/* 抽屉菜单 */
.node-menu-drawer {
  position: fixed;
  z-index: 2001;
  min-width: 120px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 4px 12px var(--shadow-color);
  padding: 4px;
}

/* 右键上下文菜单 */
.context-menu-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 2000;
}

.context-menu {
  position: fixed;
  z-index: 2001;
  min-width: 100px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 4px 12px var(--shadow-color);
  padding: 4px;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  border: none;
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
  color: var(--text-primary);
  font-size: 14px;
  text-align: left;
  transition: background 0.2s;
}

.menu-item:hover {
  background: var(--bg-hover);
}

.delete-menu-item {
  color: var(--color-error);
}

.delete-menu-item:hover {
  background: rgba(255, 68, 68, 0.1);
}

.menu-divider {
  height: 1px;
  background: var(--border-color);
  margin: 4px 8px;
}

.menu-item:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.menu-item:disabled:hover {
  background: transparent;
}

.menu-item .loading-spinner {
  animation: spin 1s linear infinite;
}

/* 功能按钮组 */
.action-buttons {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: 8px;
  flex-shrink: 0;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
  color: var(--text-secondary);
  transition: all 0.2s;
}

.action-btn:hover {
  background: var(--border-color);
  color: var(--text-primary);
}

.action-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.action-btn:disabled:hover {
  background: transparent;
  color: var(--text-secondary);
}

/* 收藏按钮 */
.favorite-btn {
  color: var(--text-secondary);
}

.favorite-btn.active,
.favorite-btn:active {
  color: var(--color-favorite);
}

/* 隐藏 AI 按钮 */
.hide-ai-btn {
  color: var(--text-secondary);
}

/* 重新生成按钮 */
.regenerate-btn {
  color: var(--text-secondary);
}

.regenerate-btn:not(:disabled):hover {
  color: var(--color-primary);
}

.regenerate-btn .loading-spinner {
  animation: spin 1s linear infinite;
}

/* 复制链接按钮 */
.copy-link-btn {
  color: var(--text-secondary);
}

.copy-link-btn:hover {
  color: var(--color-primary);
}

/* 图片预览区域 */
.image-box {
  background: white;
  border-left: 3px solid var(--color-success);
  padding: 10px;
  border-radius: 4px;
  margin-bottom: 3px;
  position: relative;
}

:root.dark .image-box {
  background: var(--bg-node-transcript);
}

.image-preview {
  max-width: 100%;
  max-height: 400px;
  border-radius: 4px;
  display: block;
  margin: 0 auto;
}

.image-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100px;
  color: var(--text-secondary);
  font-size: 14px;
}

.transcript-box {
  background: white;
  border-left: 3px solid var(--color-primary);
  padding: 10px;
  border-radius: 4px;
  margin-bottom: 3px;
  position: relative;
}

:root.dark .transcript-box {
  background: var(--bg-node-transcript);
}

.transcript-content-wrapper {
  position: relative;
  padding: 8px;
  margin: -8px;
}

/* 复制按钮样式 */
.copy-btn {
  position: absolute;
  right: 4px;
  bottom: 4px;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 4px;
  background: var(--bg-primary);
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: all 0.2s;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
  z-index: 10;
}

/* 关联笔记按钮样式 */
.related-btn {
  position: absolute;
  right: 36px;
  bottom: 4px;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 4px;
  background: var(--bg-primary);
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: all 0.2s;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
  z-index: 10;
}

.transcript-content-wrapper:hover .copy-btn,
.agent-content-wrapper:hover .copy-btn,
.transcript-content-wrapper:hover .related-btn,
.agent-content-wrapper:hover .related-btn {
  opacity: 1;
}

.copy-btn:hover,
.related-btn:hover {
  background: var(--accent-color, var(--color-primary));
  color: white;
}

.transcript-content,
.agent-content,
.thinking-content {
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-primary);
  white-space: normal;
  word-wrap: break-word;
  overflow-wrap: break-word;
  width: 100%;
  box-sizing: border-box;
  user-select: text;
  cursor: text;
  min-height: 24px;
}

/* LaTeX 占位符隐藏 */
.transcript-content :deep(.latex-placeholder),
.agent-content :deep(.latex-placeholder) {
  display: inline;
  padding: 0;
  margin: 0;
}

/* ========================================
   Markdown 渲染样式
   ======================================== */

/* 深度选择器，确保样式应用到 v-html 渲染的内容 */
.transcript-content :deep(h1),
.transcript-content :deep(h2),
.transcript-content :deep(h3),
.transcript-content :deep(h4),
.transcript-content :deep(h5),
.transcript-content :deep(h6),
.transcript-content :deep(p),
.transcript-content :deep(ul),
.transcript-content :deep(ol),
.transcript-content :deep(li),
.transcript-content :deep(code),
.transcript-content :deep(pre),
.transcript-content :deep(blockquote),
.transcript-content :deep(a),
.transcript-content :deep(img),
.transcript-content :deep(.katex),
.transcript-content :deep(.mermaid),
.transcript-content :deep(.mermaid-wrapper),
.agent-content :deep(h1),
.agent-content :deep(h2),
.agent-content :deep(h3),
.agent-content :deep(h4),
.agent-content :deep(h5),
.agent-content :deep(h6),
.agent-content :deep(p),
.agent-content :deep(ul),
.agent-content :deep(ol),
.agent-content :deep(li),
.agent-content :deep(code),
.agent-content :deep(pre),
.agent-content :deep(blockquote),
.agent-content :deep(a),
.agent-content :deep(img),
.agent-content :deep(.katex),
.agent-content :deep(.mermaid),
.agent-content :deep(.mermaid-wrapper) {
  all: revert;
}

/* 标题 */
.transcript-content :deep(h1),
.agent-content :deep(h1) {
  font-size: 1.5em;
  margin: 0.5em 0;
  font-weight: bold;
}

.transcript-content :deep(h2),
.agent-content :deep(h2) {
  font-size: 1.4em;
  margin: 0.5em 0;
  font-weight: bold;
}

.transcript-content :deep(h3),
.agent-content :deep(h3) {
  font-size: 1.3em;
  margin: 0.4em 0;
  font-weight: bold;
}

.transcript-content :deep(h4),
.agent-content :deep(h4) {
  font-size: 1.2em;
  margin: 0.4em 0;
  font-weight: bold;
}

.transcript-content :deep(h5),
.agent-content :deep(h5) {
  font-size: 1.1em;
  margin: 0.3em 0;
  font-weight: bold;
}

.transcript-content :deep(h6),
.agent-content :deep(h6) {
  font-size: 1em;
  margin: 0.3em 0;
  font-weight: bold;
}

/* 段落 */
.transcript-content :deep(p),
.agent-content :deep(p) {
  margin: 0.5em 0;
  line-height: 1.4;
}

/* 段落换行 */
.transcript-content :deep(br),
.agent-content :deep(br) {
  line-height: 1.6;
}

/* 列表 */
.transcript-content :deep(ul),
.agent-content :deep(ul) {
  list-style-type: disc;
  padding-left: 1.5em;
  margin: 0.3em 0;
}

.transcript-content :deep(ol),
.agent-content :deep(ol) {
  list-style-type: decimal;
  padding-left: 1.5em;
  margin: 0.3em 0;
}

.transcript-content :deep(li),
.agent-content :deep(li) {
  margin: 0.15em 0;
  padding: 0;
}

/* 强调 */
.transcript-content :deep(strong),
.agent-content :deep(strong) {
  font-weight: bold;
}

.transcript-content :deep(em),
.agent-content :deep(em) {
  font-style: italic;
}

/* 链接 */
.transcript-content :deep(a),
.agent-content :deep(a) {
  color: var(--color-primary);
  text-decoration: underline;
}

/* 图片 */
.transcript-content :deep(img),
.agent-content :deep(img) {
  max-width: 100%;
  border-radius: 4px;
}

/* 引用 */
.transcript-content :deep(blockquote),
.agent-content :deep(blockquote) {
  border-left: 3px solid var(--blockquote-border);
  padding-left: 0.8em;
  margin: 0.5em 0;
  padding: 0.3em 0 0.3em 0.5em;
  font-style: italic;
  color: var(--blockquote-text);
}

/* 行内代码 */
.transcript-content :deep(.inline-code),
.agent-content :deep(.inline-code),
.thinking-content :deep(code) {
  font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, monospace;
  background-color: rgba(0, 0, 0, 0.05);
  padding: 0.1em 0.4em;
  border-radius: 3px;
  font-size: 0.85em;
}

:root.dark .transcript-content :deep(.inline-code),
:root.dark .agent-content :deep(.inline-code),
:root.dark .thinking-content :deep(code) {
  background-color: rgba(255, 255, 255, 0.1);
}

/* ========================================
   代码块样式 (Highlight.js)
   ======================================== */
.transcript-content :deep(pre),
.agent-content :deep(pre) {
  background-color: rgba(0, 0, 0, 0.05);
  border-radius: 6px;
  overflow-x: auto;
  font-size: 0.85em;
  line-height: 1.5;
  margin: 0.5em 0;
  padding: 16px;
  display: block;
}
:root.dark .transcript-content :deep(pre),
:root.dark .agent-content :deep(pre) {
background-color: rgba(0, 0, 0, 1);
}

.transcript-content :deep(pre code),
.agent-content :deep(pre code) {
  font-family: 'SF Mono', Monaco, 'Cascadia Code', Consolas, monospace;
}

/* ========================================
   编辑框样式
   ======================================== */
.transcript-edit,
.agent-edit {
  width: 100%;
  min-height: 60px;
  padding: 8px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.98);
  color: var(--text-primary);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  font-size: 14px;
  line-height: 1.6;
  resize: none;
  outline: none;
  box-sizing: border-box;
  overflow: hidden;
  white-space: pre-wrap;
  word-wrap: break-word;
  position: relative;
  z-index: 10;
}

.agent-result-box {
  background: white;
  border-left: 3px solid var(--color-success);
  padding: 10px;
  border-radius: 4px;
  position: relative;
}

/* 思考过程区域样式 */
.thinking-box {
  background: var(--bg-thinking);
  border-left: 3px solid var(--color-thinking);
  padding: 8px 10px;
  border-radius: 4px;
  margin-bottom: 3px;
  position: relative;
}

:root.dark .thinking-box {
  background: var(--bg-thinking-dark);
}

.thinking-header {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
}

.thinking-arrow {
  color: var(--text-secondary);
  transition: transform 0.2s;
}

.thinking-arrow.expanded {
  transform: rotate(90deg);
}

.thinking-label {
  font-size: 12px;
  color: var(--color-thinking);
  font-weight: 500;
}

.thinking-indicator {
  margin-left: auto;
}

.thinking-content-wrapper {
  margin-top: 8px;
  padding: 8px;
  background: rgba(255, 255, 255, 0.5);
  border-radius: 4px;
}

:root.dark .thinking-content-wrapper {
  background: rgba(0, 0, 0, 0.1);
}

.thinking-content {
  /* 基础样式已与 transcript-content 合并定义 */
}

.thinking-content :deep(h1),
.thinking-content :deep(h2),
.thinking-content :deep(h3),
.thinking-content :deep(h4),
.thinking-content :deep(h5),
.thinking-content :deep(h6) {
  font-weight: bold;
  margin: 0.3em 0;
}

.thinking-content :deep(ul),
.thinking-content :deep(ol) {
  padding-left: 1.5em;
  margin: 0.3em 0;
}

:root.dark .agent-result-box {
  background: var(--bg-node-transcript);
}

.agent-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.agent-label {
  font-size: 12px;
  color: var(--color-success);
  font-weight: 500;
}

.streaming-indicator {
  display: flex;
  gap: 2px;
  align-items: center;
}

.streaming-indicator .dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--color-success);
  animation: bounce 1.4s infinite ease-in-out both;
}

.streaming-indicator .dot:nth-child(1) {
  animation-delay: -0.32s;
}

.streaming-indicator .dot:nth-child(2) {
  animation-delay: -0.16s;
}

@keyframes bounce {
  0%, 80%, 100% {
    transform: scale(0);
    opacity: 0;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}

.agent-content-wrapper {
  position: relative;
  padding: 8px;
  margin: -8px;
}

.agent-content {
  /* 基础样式已与 transcript-content 合并定义 */
}

/* ========================================
   状态和错误样式
   ======================================== */
.status-text {
  font-size: 14px;
  color: var(--text-secondary);
  font-style: italic;
}

.error-text {
  font-size: 14px;
  color: var(--color-error);
  display: flex;
  align-items: center;
  gap: 8px;
}

.error-text button {
  background: rgba(255, 68, 68, 0.1);
  border: 1px solid var(--color-error);
  color: var(--color-error);
  padding: 2px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.error-text button:hover {
  background: rgba(255, 68, 68, 0.2);
}

/* ========================================
   编辑模式样式
   ======================================== */
.editing-box {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
}

.content-edit {
  width: 100%;
  min-height: 150px;
  padding: 8px;
  border-radius: 6px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: inherit;
  font-size: 14px;
  line-height: 1.6;
  resize: vertical;
  outline: none;
  box-sizing: border-box;
}

.content-edit::placeholder {
  color: var(--text-secondary);
}

/* ========================================
   LaTeX 公式样式 (KaTeX)
   ======================================== */
.transcript-content :deep(.katex),
.agent-content :deep(.katex) {
  font-size: 1.1em;
  margin: 0 0.2em;
}

.transcript-content :deep(.katex-display),
.agent-content :deep(.katex-display) {
  display: block;
  margin: 0.8em 0;
  overflow-x: auto;
  overflow-y: hidden;
  text-align: center;
}

.transcript-content :deep(.katex-display .katex),
.agent-content :deep(.katex-display .katex) {
  display: inline-block;
}

.transcript-content :deep(.latex-error),
.agent-content :deep(.latex-error) {
  display: inline-block;
  background: rgba(255, 68, 68, 0.1);
  border: 1px solid rgba(255, 68, 68, 0.3);
  color: var(--color-error);
  padding: 0.5em 0.8em;
  border-radius: 3px;
  font-size: 0.85em;
  font-style: italic;
  white-space: pre-wrap;
  word-break: break-word;
}

/* ========================================
   Mermaid 图表样式
   ======================================== */
.transcript-content :deep(.mermaid-wrapper),
.agent-content :deep(.mermaid-wrapper) {
  margin: 1em 0;
  padding: 0;
  background: transparent;
  border: none;
  overflow-x: auto;
  text-align: center;
  display: block;
}

.transcript-content :deep(.mermaid-svg),
.agent-content :deep(.mermaid-svg) {
  max-width: 100%;
  height: auto;
  display: block;
  margin: 0 auto;
}

.transcript-content :deep(.mermaid-svg svg),
.agent-content :deep(.mermaid-svg svg) {
  display: block;
  width: 100%;
  height: auto;
}

.transcript-content :deep(.mermaid),
.agent-content :deep(.mermaid) {
  display: inline-block;
  width: 100%;
}

.transcript-content :deep(.mermaid svg),
.agent-content :deep(.mermaid svg) {
  max-width: 100%;
  height: auto;
}

.transcript-content :deep(.mermaid-wrapper.mermaid-rendered),
.agent-content :deep(.mermaid-wrapper.mermaid-rendered) {
  background: transparent;
  border: none;
  padding: 0.5em 0;
}

.transcript-content :deep(.mermaid-error),
.agent-content :deep(.mermaid-error) {
  display: inline-block;
  background: rgba(255, 68, 68, 0.1);
  border: 1px solid rgba(255, 68, 68, 0.3);
  color: var(--color-error);
  padding: 0.5em 1em;
  border-radius: 4px;
  font-size: 0.85em;
  font-style: italic;
  text-align: left;
  white-space: pre-wrap;
  word-break: break-word;
  max-width: 100%;
}

/* ========================================
   标签气泡样式
   ======================================== */

.tag-btn {
  color: var(--text-secondary);
}

.tag-btn.active,
.tag-btn:active {
  color: var(--color-primary);
}

.tag-popover-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 3100;
}

.tag-popover {
  position: fixed;
  z-index: 3101;
  min-width: 180px;
  max-width: 280px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 4px 12px var(--shadow-color);
  padding: 12px;
}

.tag-popover-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.tag-popover-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}

.tag-manage-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.tag-manage-btn:hover {
  background: var(--border-color);
  color: var(--text-primary);
}

.tag-manage-btn.active {
  background: var(--color-primary);
  color: white;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  min-height: 24px;
}

.tag-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 12px;
  border: 1px solid;
  font-size: 12px;
  transition: all 0.2s;
}

.tag-item:hover {
  transform: scale(1.05);
}

.tag-name {
  font-weight: 500;
}

.tag-remove-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2px;
  border: none;
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
  color: inherit;
  opacity: 0.6;
  transition: opacity 0.2s;
}

.tag-remove-btn:hover {
  opacity: 1;
  background: rgba(255, 255, 255, 0.2);
}

.tag-add-area {
  margin-top: 8px;
  padding-top: 8px;
}

.tag-add-area.has-tags {
  border-top: 1px solid var(--border-color);
}

.tag-add-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border-radius: 6px;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
}

.tag-add-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.tag-input-area {
  display: flex;
  align-items: center;
  gap: 4px;
  position: relative;
}

.tag-input {
  flex: 1;
  min-width: 0;
  padding: 6px 8px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-size: 12px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  outline: none;
}

.tag-input:focus {
  border-color: var(--color-primary);
}

.tag-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 32px;
  margin-top: 2px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  box-shadow: 0 2px 8px var(--shadow-color);
  max-height: 120px;
  overflow-y: auto;
  z-index: 10;
}

.tag-dropdown-item {
  display: flex;
  align-items: center;
  padding: 6px 8px;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.2s;
}

.tag-dropdown-item:hover {
  background: var(--bg-hover);
}

.tag-input-actions {
  display: flex;
  gap: 2px;
}

.tag-confirm-btn,
.tag-cancel-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.tag-confirm-btn {
  background: var(--color-primary);
  color: white;
}

.tag-confirm-btn:hover {
  background: var(--color-primary-hover);
}

.tag-cancel-btn {
  background: var(--bg-secondary);
  color: var(--text-secondary);
}

.tag-cancel-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

/* ========================================
   关联笔记气泡样式
   ======================================== */

.related-notes-popover-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 3100;
}

.related-notes-popover {
  position: fixed;
  z-index: 3101;
  min-width: 280px;
  max-width: 350px;
  max-height: 300px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 4px 12px var(--shadow-color);
  padding: 12px;
  display: flex;
  flex-direction: column;
}

.related-notes-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.related-notes-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}

.related-notes-count {
  font-size: 12px;
  color: var(--color-primary);
  background: rgba(255, 152, 0, 0.1);
  padding: 2px 8px;
  border-radius: 10px;
}

.related-notes-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
  gap: 8px;
}

.related-notes-loading .loading-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid var(--border-color);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.related-notes-loading span {
  font-size: 12px;
  color: var(--text-secondary);
}

.related-notes-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.related-note-item {
  padding: 10px;
  background: var(--bg-secondary);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.related-note-item:hover {
  background: var(--bg-hover);
}

.related-note-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  margin-bottom: 4px;
}

.related-notebook-name {
  color: var(--color-primary);
  font-weight: 500;
}

.related-note-separator {
  color: var(--text-secondary);
  opacity: 0.5;
}

.related-note-title {
  color: var(--text-primary);
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 80px;
}

.related-note-similarity {
  color: var(--color-success);
  font-weight: 500;
}

.related-note-preview {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.related-notes-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  font-size: 13px;
  color: var(--text-secondary);
}

/* 详情气泡
   ======================================== */

.details-popover-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 3200;
}

.details-popover {
  position: fixed;
  z-index: 3201;
  width: 280px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 4px 12px var(--shadow-color);
  overflow: hidden;
}

.details-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
}

.details-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.details-close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
  color: var(--text-secondary);
  transition: all 0.2s;
}

.details-close-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.details-content {
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.details-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.details-label {
  font-size: 13px;
  color: var(--text-secondary);
  min-width: 70px;
  flex-shrink: 0;
}

.details-value {
  font-size: 13px;
  color: var(--text-primary);
  word-break: break-word;
}

/* Spin动画 */
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* ========================================
   移动到笔记本菜单样式
   ======================================== */

.move-menu-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 3300;
}

.move-menu {
  position: fixed;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 4px 12px var(--shadow-color);
  z-index: 3301;
  min-width: 180px;
  max-height: 300px;
  overflow-y: auto;
  padding: 4px 0;
}

.move-menu-item {
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
  text-align: left;
}

.move-menu-item:hover:not(:disabled) {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.move-menu-item.current {
  color: var(--text-secondary);
  opacity: 0.6;
}

.move-menu-item:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.move-menu-item span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>