import type { AIChatRequest } from '../../shared/types'

/** 流式对话事件回调 */
export interface AIServiceHandlers {
  /** 收到一段增量内容 */
  onDelta: (id: string, delta: string) => void
  /** 流结束（aborted=true 表示手动停止） */
  onDone: (id: string, aborted?: boolean) => void
  /** 出错（如 API Key 无效、网络异常） */
  onError: (id: string, message: string) => void
}

/** AIService 依赖注入（与 electron-store 解耦） */
export interface AIServiceDeps {
  getApiKey: () => string
  getDefaultTemperature: () => number
  getDefaultMaxTokens: () => number
}

/** DeepSeek 接口地址（可通过 JEAK_DEEPSEEK_ENDPOINT 环境变量覆盖，便于本地测试/自定义代理） */
const DEEPSEEK_ENDPOINT =
  process.env.JEAK_DEEPSEEK_ENDPOINT || 'https://api.deepseek.com/chat/completions'

/**
 * 主进程 AI 服务：封装 DeepSeek Chat Completions 调用。
 * - 支持 SSE 流式响应，通过回调逐段推送增量
 * - 支持按会话 ID 中途停止（AbortController）
 * - API Key 仅由调用方（主进程）持有，渲染进程不可见
 */
export class AIService {
  /** 进行中的流式请求（用于停止） */
  private readonly activeStreams = new Map<string, AbortController>()

  constructor(private readonly deps: AIServiceDeps) {}

  /** 当前是否有进行中的流式请求 */
  get hasActive(): boolean {
    return this.activeStreams.size > 0
  }

  /**
   * 发起一次流式对话。
   * @param request   请求参数（含会话 id、消息列表、模型）
   * @param handlers  增量 / 结束 / 错误回调
   */
  async chat(request: AIChatRequest, handlers: AIServiceHandlers): Promise<void> {
    const apiKey = this.deps.getApiKey()
    if (!apiKey) {
      handlers.onError(request.id, '尚未配置 DeepSeek API Key，请点击对话面板右上角 ⚙ 进行设置。')
      return
    }

    const controller = new AbortController()
    this.activeStreams.set(request.id, controller)

    try {
      const response = await fetch(DEEPSEEK_ENDPOINT, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: request.model,
          messages: request.messages,
          stream: true,
          temperature: request.temperature ?? this.deps.getDefaultTemperature(),
          max_tokens: request.maxTokens ?? this.deps.getDefaultMaxTokens()
        })
      })

      if (!response.ok) {
        const detail = await response.text().catch(() => '')
        throw new Error(`DeepSeek API ${response.status}: ${detail.slice(0, 300)}`)
      }
      if (!response.body) {
        throw new Error('DeepSeek API 未返回响应流')
      }

      await this.consumeStream(response.body, request.id, handlers)
      handlers.onDone(request.id)
    } catch (error) {
      if (controller.signal.aborted) {
        handlers.onDone(request.id, true)
      } else {
        const message = error instanceof Error ? error.message : String(error)
        console.error('[AIService] chat 出错:', message)
        handlers.onError(request.id, message)
      }
    } finally {
      this.activeStreams.delete(request.id)
    }
  }

  /** 停止指定会话的流式响应 */
  stop(id: string): void {
    this.activeStreams.get(id)?.abort()
  }

  /** 一次性对话（内部复用流式通道，聚合并返回完整文本）。供插件 ai:chat 使用 */
  chatOnce(request: AIChatRequest): Promise<string> {
    return new Promise((resolve, reject) => {
      let buffer = ''
      void this.chat(request, {
        onDelta: (_id, delta) => {
          buffer += delta
        },
        onDone: (_id, aborted) => {
          if (aborted) reject(new Error('请求被中断'))
          else resolve(buffer)
        },
        onError: (_id, message) => reject(new Error(message))
      })
    })
  }

  /** 逐块解析 SSE 并转发增量内容 */
  private async consumeStream(
    body: ReadableStream<Uint8Array>,
    id: string,
    handlers: AIServiceHandlers
  ): Promise<void> {
    const reader = body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      // SSE 帧以空行分隔，保留不完整的尾部帧
      const frames = buffer.split('\n\n')
      buffer = frames.pop() ?? ''

      for (const frame of frames) {
        for (const line of frame.split('\n')) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data:')) continue
          const data = trimmed.slice(5).trim()
          if (!data || data === '[DONE]') continue
          try {
            const json = JSON.parse(data) as {
              choices?: Array<{ delta?: { content?: string } }>
            }
            const delta = json.choices?.[0]?.delta?.content
            if (typeof delta === 'string' && delta.length > 0) {
              handlers.onDelta(id, delta)
            }
          } catch {
            // 忽略非 JSON 行
          }
        }
      }
    }
  }
}
