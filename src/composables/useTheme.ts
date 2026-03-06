import { ref, watchEffect } from 'vue'

export function useTheme(settings: any) {
  const isDark = ref(false)

  function updateTheme() {
    const theme = settings.settings.general.theme
    
    if (theme === 'dark') {
      isDark.value = true
    } else if (theme === 'light') {
      isDark.value = false
    } else {
      // System preference
      isDark.value = window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    
    // Apply theme class to document
    if (isDark.value) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    
    // Notify Electron main process to update window background
    if (window.electronAPI) {
      window.electronAPI.setTheme(isDark.value)
    }
  }

  // Watch for system theme changes
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  mediaQuery.addEventListener('change', () => {
    if (settings.settings.general.theme === 'system') {
      updateTheme()
    }
  })

  // Update theme when settings change
  watchEffect(() => {
    updateTheme()
  })

  return {
    isDark
  }
}
