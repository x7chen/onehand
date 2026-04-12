import { onMounted, onUnmounted } from 'vue'
import { parseDeepLinkUrl, findNodeByNodeId } from './useDeepLink'

/**
 * Composable to handle paste events on edit boxes
 * Converts onehand:// URLs to markdown links when pasted
 */
export function useLinkPaste() {

  async function handlePaste(event: ClipboardEvent) {
    const clipboardData = event.clipboardData
    if (!clipboardData) return

    const pastedText = clipboardData.getData('text/plain')
    if (!pastedText || !pastedText.startsWith('onehand://')) {
      return // Not a deep link, let default paste happen
    }

    // Check if we're in an editable element
    const target = event.target as HTMLElement
    if (!target || (target.tagName !== 'TEXTAREA' && target.tagName !== 'INPUT')) {
      return
    }

    // Prevent default paste
    event.preventDefault()

    // Parse the deep link
    const nodeId = parseDeepLinkUrl(pastedText)
    if (!nodeId) {
      // Invalid URL, paste as-is
      insertText(target as HTMLTextAreaElement | HTMLInputElement, pastedText)
      return
    }

    // Find the node to get its title
    try {
      const nodeData = await findNodeByNodeId(nodeId)
      if (nodeData) {
        // Create markdown link with node title
        const title = nodeData.node.title || '笔记'
        const markdownLink = `[${title}](${pastedText})`
        insertText(target as HTMLTextAreaElement | HTMLInputElement, markdownLink)
      } else {
        // Node not found, paste as-is
        insertText(target as HTMLTextAreaElement | HTMLInputElement, pastedText)
      }
    } catch (error) {
      console.error('Error finding node for paste:', error)
      insertText(target as HTMLTextAreaElement | HTMLInputElement, pastedText)
    }
  }

  function insertText(target: HTMLTextAreaElement | HTMLInputElement, text: string) {
    const start = target.selectionStart ?? 0
    const end = target.selectionEnd ?? 0
    const currentValue = target.value

    // Insert text at cursor position
    target.value = currentValue.substring(0, start) + text + currentValue.substring(end)

    // Move cursor to end of inserted text
    const newCursorPos = start + text.length
    target.selectionStart = newCursorPos
    target.selectionEnd = newCursorPos

    // Trigger input event for v-model reactivity
    target.dispatchEvent(new Event('input', { bubbles: true }))
  }

  function setupPasteListener() {
    // Listen for paste events on document and check if target is an edit box
    document.addEventListener('paste', handlePaste)
  }

  function removePasteListener() {
    document.removeEventListener('paste', handlePaste)
  }

  onMounted(() => {
    setupPasteListener()
  })

  onUnmounted(() => {
    removePasteListener()
  })

  return {
    handlePaste
  }
}