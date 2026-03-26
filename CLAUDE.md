# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OneHand is an Electron + Vue 3 desktop application for intelligent voice note-taking. It features offline speech recognition via Sherpa-ONNX, AI-powered responses via OpenAI-compatible APIs, and an infinite canvas for organizing notes.

## Common Commands

```bash
# Development (builds frontend, compiles electron, launches app)
npm run dev

# Production build for current platform
npm run build

# Platform-specific builds
npm run electron:build:win   # Windows
npm run electron:build:mac   # macOS

# Type checking
npx vue-tsc --noEmit
```

The `download-model` script runs automatically during `npm install` to fetch the Sherpa-ONNX speech recognition model.

## Architecture

### Electron Main Process (`electron/main.js`)

The main process handles:
- BrowserWindow creation with dark mode defaults
- IPC handlers for file system operations (save, read, mkdir, etc.)
- Sherpa-ONNX speech recognition (initialized asynchronously)
- Config persistence in `userData/config.json`

### Renderer Process (Vue 3 Application)

**Entry Point**: `src/main.ts` → `src/App.vue`

**Router** (`src/router/index.ts`):
- `/` - Home view (project list)
- `/canvas/:projectId` - Infinite canvas for voice notes
- `/node-list/:projectId` - List view of all notes
- `/pdf/:projectId` - PDF reader with annotations
- `/settings` - Application settings

**State Management** (Pinia stores):
- `projectStore` - Projects, canvases, nodes, PDF page management
- `settingsStore` - User preferences (LLM config, theme, etc.)
- `contextStore` - Static/dynamic context files for AI

**Key Composables**:
- `useVoiceRecorder` - MediaRecorder-based audio capture
- `useQwenAgent` - OpenAI-compatible API integration with streaming
- `useSherpaOnnx` - Bridge to main process for transcription
- `useTheme` - Dark/light theme switching

### Data Model

```
Project
├── id, name, createdAt, updatedAt
├── canvases: CanvasPage[]  (multi-page support)
│   ├── id, type ('infinite' | 'pdf')
│   ├── viewport: { x, y, zoom }
│   ├── nodes: CanvasNode[]
│   └── pdfPage?: number
├── currentCanvasIndex
├── context?: ProjectContext
└── pdfPath?: string

CanvasNode
├── id, type ('voice-note' | 'text-note')
├── position, transcript, agentResult
├── transcriptStatus, agentStatus
└── audioPath, duration, pdfPage
```

### IPC Communication

The preload script (`electron/preload.js`) exposes `window.electronAPI`:
- File operations: `saveFile`, `saveFileBuffer`, `readFile`, `exists`, `mkdir`, `readdir`, `unlink`
- Dialog: `selectDirectory`, `showOpenDialog`
- App: `getAppPath`, `setTheme`, `readConfig`, `saveConfig`
- Transcription: `transcribeAudio(audioData, mimeType, config)`

## Key Implementation Notes

### Speech Recognition
- Uses Sherpa-ONNX Paraformer model for offline Chinese speech recognition
- Model downloaded to `build/models/sherpa-onnx-paraformer-zh-small-2024-03-09/`
- Audio format: WAV preferred; webm requires ffmpeg conversion (not bundled)

### AI Integration
- OpenAI-compatible streaming API (`/chat/completions` endpoint)
- Default provider: ModelScope (Qwen models)
- Context system: static (manual selection) + dynamic (auto-updating)
- Messages built in `useQwenAgent.buildFullContextMessages()`

### Multi-Page Canvas
- Projects support multiple canvas pages
- PDF projects create one canvas per page automatically
- Empty pages auto-removed on navigation (except first page)

### Build Configuration
- `electron-builder.yml` configures packaging
- Output directory: `release/`
- Includes model files in production builds