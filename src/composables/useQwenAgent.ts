import type { Message, MessageContentItem } from '@/types/api'

export async function chatWithLLM(
  messages: Message[],
  config: {
    baseUrl: string
    apiKey: string
    model: string
  },
  onChunk?: (chunk: string) => void
): Promise<string> {
  try {
    // 移除 baseUrl 末尾的斜杠，避免双斜杠问题
    const baseUrl = config.baseUrl.replace(/\/+$/, '')
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        stream: true
      })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('No response body')
    }

    let fullContent = ''
    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value)
      const lines = chunk.split('\n')

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          if (data === '[DONE]') continue

          try {
            const parsed = JSON.parse(data)
            const content = parsed.choices?.[0]?.delta?.content || ''
            if (content) {
              fullContent += content
              onChunk?.(content)
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    }

    return fullContent
  } catch (error) {
    console.error('LLM chat failed:', error)
    throw error
  }
}

/**
 * 构建包含静态上下文和动态上下文的完整消息
 */
export function buildFullContextMessages(
  contextNodes: Array<{ transcript: string; agentResult: string }>,
  currentTranscript: string,
  staticContext?: string,
  dynamicContext?: string
): Message[] {
  const systemMessage: Message = {
    role: 'system',
    content: `YYou are an intelligent assistant. Based on the user's note content and context, provide useful responses, summaries, or expanded information. Reply in the same language as the user's input.`
  }

  const messages: Message[] = []

  // 1. 静态上下文
  if (staticContext && staticContext.trim()) {
    messages.push({
      role: 'user',
      content: staticContext
    })
  }

  // 2. 动态上下文
  if (dynamicContext && dynamicContext.trim()) {
    messages.push({
      role: 'user',
      content: dynamicContext
    })
  }

  // 3. 已选择的上下文记录
  for (const node of contextNodes) {
    if (node.transcript && node.agentResult) {
      messages.push(
        { role: 'user', content: node.transcript },
        { role: 'assistant', content: node.agentResult }
      )
    }
  }

  // 4. 当前问题
  messages.push({
    role: 'user',
    content: currentTranscript
  })

  return [systemMessage, ...messages]
}

export function buildContextMessages(
  contextNodes: Array<{ transcript: string; agentResult: string }>,
  currentTranscript: string
): Message[] {
  return buildFullContextMessages(contextNodes, currentTranscript, undefined, undefined)
}

/**
 * 构建包含图片的消息（Vision API）
 */
export function buildImageMessage(text: string, imageBase64: string): Message {
  return {
    role: 'user',
    content: [
      { type: 'text', text },
      { type: 'image_url', image_url: { url: imageBase64 } }
    ]
  }
}

/**
 * 构建图片分析请求消息
 */
export function buildImageAnalysisMessages(
  imageBase64: string,
  prompt: string,
  staticContext?: string,
  dynamicContext?: string,
  contextNodes?: Array<{ transcript: string; agentResult: string }>
): Message[] {
  const systemMessage: Message = {
    role: 'system',
    content: `You are an intelligent PDF analysis assistant. Analyze the PDF page image and provide helpful responses based on the user's request. Reply in the same language as the user's input.`
  }

  const messages: Message[] = []

  // 1. 静态上下文
  if (staticContext && staticContext.trim()) {
    messages.push({
      role: 'user',
      content: staticContext
    })
  }

  // 2. 动态上下文
  if (dynamicContext && dynamicContext.trim()) {
    messages.push({
      role: 'user',
      content: dynamicContext
    })
  }

  // 3. 已选择的上下文记录
  if (contextNodes) {
    for (const node of contextNodes) {
      if (node.transcript && node.agentResult) {
        messages.push(
          { role: 'user', content: node.transcript },
          { role: 'assistant', content: node.agentResult }
        )
      }
    }
  }

  // 4. 当前问题（包含图片）
  messages.push(buildImageMessage(prompt, imageBase64))

  return [systemMessage, ...messages]
}
