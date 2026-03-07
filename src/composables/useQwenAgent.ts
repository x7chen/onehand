import type { Message } from '@/types/api'

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
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
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
    content: `You are an intelligent notebook assistant. Based on the user's voice note content and context, provide useful responses, summaries, or expanded information. Reply in the same language as the user's input.`
  }

  const messages: Message[] = []

  // 1. 静态上下文
  if (staticContext && staticContext.trim()) {
    messages.push({
      role: 'user',
      content: `【静态上下文】\n${staticContext}`
    })
  }

  // 2. 动态上下文
  if (dynamicContext && dynamicContext.trim()) {
    messages.push({
      role: 'user',
      content: `【动态上下文】\n${dynamicContext}`
    })
  }

  // 3. 已选择的上下文记录
  for (const node of contextNodes) {
    if (node.transcript && node.agentResult) {
      messages.push(
        { role: 'user', content: `【上下文记录】${node.transcript}` },
        { role: 'assistant', content: `【AI 回答】${node.agentResult}` }
      )
    }
  }

  // 4. 当前问题
  messages.push({
    role: 'user',
    content: `【当前问题】${currentTranscript}`
  })

  return [systemMessage, ...messages]
}

export function buildContextMessages(
  contextNodes: Array<{ transcript: string; agentResult: string }>,
  currentTranscript: string
): Message[] {
  return buildFullContextMessages(contextNodes, currentTranscript, undefined, undefined)
}
