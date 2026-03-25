# Agent Guidelines for OneDay Project

## Project Overview

OneDay is an intelligent voice notebook desktop application built with Vue 3, TypeScript, and Electron. It provides voice recording, transcription, and AI-powered note organization.

## Build Commands

```bash
# Development
npm run dev              # Run electron app in dev mode (downloads model, builds, starts electron)
npm run electron:dev     # Same as dev

# Production Build
npm run build            # Full production build (download model, typecheck, build, electron-builder)
npm run build:dir         # Build directory output (no packaging)

# Platform-specific builds
npm run electron:build:win   # Windows build
npm run electron:build:mac   # macOS build

# Type Checking
npx vue-tsc --noEmit     # Run TypeScript type checker

# Preview
npm run preview           # Preview production build
```

**Note**: `download-model` runs automatically on install (postinstall). Models are downloaded to `models/` directory.

## Architecture

```
src/
├── components/     # Vue components (PascalCase: VoiceNote.vue, NodeListPanel.vue)
├── composables/    # Reusable composition functions (useCamelCase.ts)
├── stores/         # Pinia stores (useXxxStore.ts pattern)
├── types/          # TypeScript type definitions
├── utils/          # Utility functions
├── views/          # Route-level components (XxxView.vue)
├── router/         # Vue Router configuration
├── main.ts         # App entry point
└── App.vue         # Root component
```

## Code Style

### TypeScript
- **Strict mode enabled** in tsconfig.json
- Use explicit types; avoid `any`
- Import types with `import type { TypeName }`
- Use interface for object shapes, type for unions/primitives

```typescript
// Good
import type { CanvasNode } from '@/types/project'
const handleDelete = (nodeId: string): void => { }

// Avoid
const handleDelete = (nodeId: any) => { }
```

### Vue 3 Composition API
- Use `<script setup lang="ts">` syntax
- Define props with `defineProps<{...}>()`
- Define emits with `defineEmits<{ (e: 'event', ...): void }>()`
- Use `ref()`, `computed()`, `watch()`, `nextTick()` from vue
- Use `onMounted()`, `onUnmounted()` lifecycle hooks

```vue
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import MyComponent from '@/components/MyComponent.vue'
import type { SomeType } from '@/types/some'

const props = withDefaults(defineProps<{
  items: SomeType[]
  selectedId?: string | null
}>(), {
  selectedId: null
})

const emit = defineEmits<{
  'select': [id: string]
  'delete': [id: string]
}>()
</script>
```

### Naming Conventions
- **Files**: PascalCase for components/views (VoiceNote.vue), camelCase for utilities (useSherpaOnnx.ts)
- **Variables/Functions**: camelCase
- **Types/Interfaces**: PascalCase
- **Constants**: UPPER_SNAKE_CASE
- **CSS Classes**: kebab-case

### Imports
- Use path aliases: `@/` maps to `src/`
- Group imports: external libs → internal modules → relative imports
- Sort alphabetically within groups

```typescript
import { ref, computed } from 'vue'
import { useProjectStore } from '@/stores/projectStore'
import type { CanvasNode } from '@/types/project'
import MyComponent from './MyComponent.vue'
```

### Error Handling
- Use try-catch for async operations
- Log errors with `console.error()` before throwing
- Provide meaningful error messages

```typescript
try {
  const result = await someAsyncOperation()
  return result
} catch (error) {
  console.error('Operation failed:', error)
  throw new Error(`Failed to complete operation: ${error}`)
}
```

### State Management (Pinia)
- Use composition API style stores (`defineStore('name', () => {...})`)
- Expose reactive state and computed properties
- Use actions for async operations

```typescript
export const useProjectStore = defineStore('project', () => {
  const projects = ref<Project[]>([])
  const currentProject = computed(() => projects.value[0] ?? null)
  
  async function loadProjects() { ... }
  
  return { projects, currentProject, loadProjects }
})
```

### CSS/Styling
- Use CSS variables for theming (`var(--bg-primary)`, `var(--text-secondary)`)
- Use scoped styles in components
- Avoid inline styles except for dynamic values
- Use `:deep()` for styling child components

```vue
<style scoped>
.container {
  display: flex;
  background: var(--bg-secondary);
}

.container :deep(.child-component) {
  color: var(--text-primary);
}
</style>
```

## Testing

No dedicated test framework is currently configured. For manual testing:
1. Run `npm run dev` to start the application
2. Test functionality in the Electron window
3. Check browser console for runtime errors

## Common Patterns

### API Calls
Use the `chatWithLLM` composable for LLM interactions:
```typescript
import { chatWithLLM, buildFullContextMessages } from '@/composables/useQwenAgent'

const result = await chatWithLLM(messages, {
  baseUrl: settings.llm.baseUrl,
  apiKey: settings.llm.apiKey,
  model: settings.llm.model
}, (chunk) => { /* streaming callback */ })
```

### Electron IPC
Access Electron APIs via `window.electronAPI`:
```typescript
const appDataPath = await window.electronAPI.getAppPath('userData')
```

## Working with this Codebase

- **Adding a new view**: Create in `src/views/` and add route in `src/router/index.ts`
- **Adding a new component**: Create in `src/components/`, use PascalCase filename
- **Adding a new store**: Create in `src/stores/`, use `useXxxStore` naming
- **Type changes**: Update files in `src/types/` and ensure TypeScript compiles

Before committing:
1. Run `npx vue-tsc --noEmit` to verify types
2. Check for any TypeScript errors
