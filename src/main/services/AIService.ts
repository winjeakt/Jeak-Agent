import type {
  AIChatMessage,
  AIChatRequest,
  AIToolCall,
  AIToolDefinition,
  SkillInfo
} from '../../shared/types'

/** 流式对话事件回调 */
export interface AIServiceHandlers {
  /** 收到一段增量内容 */
  onDelta: (id: string, delta: string) => void
  /** 流结束（aborted=true 表示手动停止） */
  onDone: (id: string, aborted?: boolean) => void
  /** 出错（如 API Key 无效、网络异常） */
  onError: (id: string, message: string) => void
  /** 模型请求调用工具（function calling） */
  onToolCall?: (id: string, name: string, argsJson: string) => void
  /** 工具执行完毕（ok=true 成功，否则失败）；result 为文本结果或错误信息 */
  onToolResult?: (id: string, name: string, ok: boolean, result: string) => void
}

/** AIService 依赖注入（与 electron-store 解耦） */
export interface AIServiceDeps {
  getApiKey: () => string
  getDefaultTemperature: () => number
  getDefaultMaxTokens: () => number
  /** 当前可用的 MCP 工具（function calling） */
  getMCPTools?: () => AIToolDefinition[]
  /** 调用 MCP 工具，返回文本结果 */
  callMCPTool?: (name: string, args: unknown) => Promise<string>
  /** 当前可用的 Agent Skills（注入系统提示词） */
  getSkills?: () => SkillInfo[]
}

/** DeepSeek 接口地址（可通过 JEAK_DEEPSEEK_ENDPOINT 环境变量覆盖，便于本地测试/自定义代理） */
const DEEPSEEK_ENDPOINT =
  process.env.JEAK_DEEPSEEK_ENDPOINT || 'https://api.deepseek.com/chat/completions'

/** 单次对话内工具调用最大轮数（防止模型陷入工具死循环） */
const MAX_TOOL_ROUNDS = 8

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
      const tools = request.tools ?? this.deps.getMCPTools?.() ?? []
      const messages = this.buildMessages(request.messages, this.deps.getSkills?.() ?? [])

      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        const finished = await this.runRound(request, messages, tools, handlers, controller, apiKey)
        if (finished || controller.signal.aborted) break
      }
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

  /** 将 Agent Skills 注入系统提示词（追加到现有 system 消息或置于开头） */
  private buildMessages(original: AIChatMessage[], skills: SkillInfo[]): AIChatMessage[] {
    const messages = original.map((m) => ({ ...m }))
    if (skills.length === 0) return messages

    const skillBlock = skills.map((s) => `- ${s.name}: ${s.description || '（无描述）'}`).join('\n')
    const hint = `\n\n# 可用技能（Agent Skills）\n插件提供了以下技能，当用户任务匹配时请优先使用：\n${skillBlock}`

    const sysIndex = messages.findIndex((m) => m.role === 'system')
    if (sysIndex >= 0) {
      messages[sysIndex] = { ...messages[sysIndex], content: messages[sysIndex].content + hint }
    } else {
      messages.unshift({ role: 'system', content: hint.trimStart() })
    }
    return messages
  }

  /** 执行单轮对话；返回 true 表示已产出最终回复，false 表示执行了工具需继续 */
  private async runRound(
    request: AIChatRequest,
    messages: AIChatMessage[],
    tools: AIToolDefinition[],
    handlers: AIServiceHandlers,
    controller: AbortController,
    apiKey: string
  ): Promise<boolean> {
    const response = await fetch(DEEPSEEK_ENDPOINT, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: request.model,
        messages,
        stream: true,
        temperature: request.temperature ?? this.deps.getDefaultTemperature(),
        max_tokens: request.maxTokens ?? this.deps.getDefaultMaxTokens(),
        ...(tools.length > 0 ? { tools } : {})
      })
    })

    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      throw new Error(`DeepSeek API ${response.status}: ${detail.slice(0, 300)}`)
    }
    if (!response.body) {
      throw new Error('DeepSeek API 未返回响应流')
    }

    const { content, toolCalls } = await this.consumeStream(response.body, request.id, handlers)
    if (toolCalls.length === 0) return true

    messages.push({ role: 'assistant', content, tool_calls: toolCalls })
    for (const toolCall of toolCalls) {
      handlers.onToolCall?.(request.id, toolCall.function.name, toolCall.function.arguments)
      const { ok, text } = await this.executeTool(toolCall.function.name, toolCall.function.arguments)
      handlers.onToolResult?.(request.id, toolCall.function.name, ok, text)
      // 发给模型的消息语义保持不变：成功推原始结果，失败推「工具调用失败: ...」
      messages.push({ role: 'tool', content: ok ? text : `工具调用失败: ${text}`, tool_call_id: toolCall.id })
    }
    return false
  }

  /** 调用 MCP 工具，返回结构化的成功/失败结果（异常不中断对话） */
  private async executeTool(name: string, argsJson: string): Promise<{ ok: boolean; text: string }> {
    const caller = this.deps.callMCPTool
    if (!caller) return { ok: false, text: '当前环境未启用 MCP 工具调用' }
    let args: unknown
    try {
      args = JSON.parse(argsJson || '{}')
    } catch {
      args = {}
    }
    try {
      return { ok: true, text: await caller(name, args) }
    } catch (error) {
      return { ok: false, text: error instanceof Error ? error.message : String(error) }
    }
  }

  /** 逐块解析 SSE：累积正文内容与工具调用分片 */
  private async consumeStream(
    body: ReadableStream<Uint8Array>,
    id: string,
    handlers: AIServiceHandlers
  ): Promise<{ content: string; toolCalls: AIToolCall[] }> {
    const reader = body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let content = ''
    const toolCalls: AIToolCall[] = []

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
              choices?: Array<{ delta?: { content?: string; tool_calls?: DeltaToolCall[] } }>
            }
            const delta = json.choices?.[0]?.delta
            if (!delta) continue
            if (typeof delta.content === 'string' && delta.content.length > 0) {
              content += delta.content
              handlers.onDelta(id, delta.content)
            }
            if (Array.isArray(delta.tool_calls)) {
              this.accumulateToolCalls(toolCalls, delta.tool_calls)
            }
          } catch {
            // 忽略非 JSON 行
          }
        }
      }
    }
    return { content, toolCalls }
  }

  /** 累积流式工具调用分片（按 index 分组，拼接 id/name/arguments） */
  private accumulateToolCalls(acc: AIToolCall[], deltas: DeltaToolCall[]): void {
    for (const tc of deltas) {
      const index = typeof tc.index === 'number' ? tc.index : 0
      if (!acc[index]) {
        acc[index] = { id: '', type: 'function', function: { name: '', arguments: '' } }
      }
      if (typeof tc.id === 'string' && tc.id) acc[index].id = tc.id
      if (tc.type === 'function') acc[index].type = 'function'
      if (tc.function?.name) acc[index].function.name = tc.function.name
      if (tc.function?.arguments) acc[index].function.arguments += tc.function.arguments
    }
  }
}

/** 流式 delta 中的工具调用分片（宽松解析） */
interface DeltaToolCall {
  index?: number
  id?: string
  type?: string
  function?: { name?: string; arguments?: string }
}
