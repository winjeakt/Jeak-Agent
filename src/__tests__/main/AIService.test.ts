import { afterEach, describe, expect, it, vi } from 'vitest'
import { AIService } from '../../main/services/AIService'

/** 构造 SSE 流式 Response */
function sseResponse(chunks: string[], status = 200): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c))
      controller.close()
    }
  })
  return new Response(stream, { status, headers: { 'Content-Type': 'text/event-stream' } })
}

const contentFrame = (text: string): string => `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`
const doneFrame = 'data: [DONE]\n\n'

function makeDeps(overrides: Partial<ConstructorParameters<typeof AIService>[0]> = {}) {
  return {
    getApiKey: () => 'sk-test',
    getDefaultTemperature: () => 0.5,
    getDefaultMaxTokens: () => 2048,
    ...overrides
  }
}

const baseRequest = { id: 'r1', messages: [{ role: 'user' as const, content: 'hi' }], model: 'deepseek-chat' }
const baseHandlers = () => ({ onDelta: vi.fn(), onDone: vi.fn(), onError: vi.fn() })

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('AIService.chat 参数与错误', () => {
  it('未配置 API Key 走 onError', async () => {
    const svc = new AIService(makeDeps({ getApiKey: () => '' }))
    const onError = vi.fn()
    await svc.chat(baseRequest, { ...baseHandlers(), onError })
    expect(onError).toHaveBeenCalledWith('r1', expect.stringContaining('API Key'))
  })

  it('请求格式：URL / headers / body 字段', async () => {
    const fetchMock = vi.fn(async () => sseResponse([contentFrame('你好'), doneFrame]))
    vi.stubGlobal('fetch', fetchMock)
    const svc = new AIService(makeDeps({ getSkills: () => [], getMCPTools: () => [] }))
    const onDelta = vi.fn()
    const onDone = vi.fn()
    await svc.chat(baseRequest, { ...baseHandlers(), onDelta, onDone })

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('chat/completions')
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk-test')

    const body = JSON.parse(init.body as string)
    expect(body.model).toBe('deepseek-chat')
    expect(body.stream).toBe(true)
    expect(body.temperature).toBe(0.5)
    expect(body.max_tokens).toBe(2048)
    expect(body.tools).toBeUndefined()
    expect(body.messages).toEqual([{ role: 'user', content: 'hi' }])

    expect(onDelta).toHaveBeenCalledWith('r1', '你好')
    expect(onDone).toHaveBeenCalledWith('r1')
  })

  it('skills 注入 system 提示词（无 system 时置于开头）', async () => {
    const fetchMock = vi.fn(async () => sseResponse([doneFrame]))
    vi.stubGlobal('fetch', fetchMock)
    const svc = new AIService(makeDeps({ getSkills: () => [{ name: 'greet', description: '问候', body: '' }] }))
    await svc.chat(baseRequest, baseHandlers())

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.messages).toHaveLength(2)
    expect(body.messages[0].role).toBe('system')
    expect(body.messages[0].content).toContain('greet')
    expect(body.messages[0].content).toContain('问候')
  })

  it('已有 system 消息时追加而非覆盖', async () => {
    const fetchMock = vi.fn(async () => sseResponse([doneFrame]))
    vi.stubGlobal('fetch', fetchMock)
    const svc = new AIService(makeDeps({ getSkills: () => [{ name: 'greet', description: 'd', body: '' }] }))
    await svc.chat(
      { ...baseRequest, messages: [{ role: 'system', content: 'base' }, { role: 'user', content: 'hi' }] },
      baseHandlers()
    )
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.messages[0].content.startsWith('base')).toBe(true)
    expect(body.messages[0].content).toContain('greet')
  })

  it('非 2xx 响应走 onError', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('bad', { status: 401 })))
    const svc = new AIService(makeDeps())
    const onError = vi.fn()
    await svc.chat(baseRequest, { ...baseHandlers(), onError })
    expect(onError).toHaveBeenCalledWith('r1', expect.stringContaining('401'))
  })
})

describe('AIService.chat 工具调用', () => {
  const toolCallFrame = `data: ${JSON.stringify({
    choices: [{ delta: { tool_calls: [{ index: 0, id: 'call_1', type: 'function', function: { name: 'echo', arguments: '{"text":"hi"}' } }] } }]
  })}\n\n`

  const echoTool = {
    type: 'function',
    function: { name: 'echo', description: '', parameters: { type: 'object', properties: {} } }
  }

  it('两轮调用：工具执行后第二轮请求包含 tool 消息', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(sseResponse([toolCallFrame, doneFrame]))
      .mockResolvedValueOnce(sseResponse([contentFrame('结果'), doneFrame]))
    vi.stubGlobal('fetch', fetchMock)

    const callMCPTool = vi.fn(async (name: string, args: unknown) => {
      expect(name).toBe('echo')
      expect(args).toEqual({ text: 'hi' })
      return 'hi hi'
    })
    const onToolCall = vi.fn()
    const onToolResult = vi.fn()

    const svc = new AIService(makeDeps({ getMCPTools: () => [echoTool], callMCPTool }))
    await svc.chat(baseRequest, { ...baseHandlers(), onToolCall, onToolResult })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(onToolCall).toHaveBeenCalledWith('r1', 'echo', '{"text":"hi"}')
    expect(onToolResult).toHaveBeenCalledWith('r1', 'echo', true, 'hi hi')

    const firstBody = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(firstBody.tools).toHaveLength(1)

    const secondBody = JSON.parse((fetchMock.mock.calls[1][1] as RequestInit).body as string)
    const toolMsg = secondBody.messages.find((m: { role: string }) => m.role === 'tool')
    expect(toolMsg).toBeDefined()
    expect(toolMsg.content).toBe('hi hi')
    expect(toolMsg.tool_call_id).toBe('call_1')
  })

  it('工具失败：onToolResult ok=false，tool 消息带失败前缀', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(sseResponse([toolCallFrame, doneFrame]))
      .mockResolvedValueOnce(sseResponse([doneFrame]))
    vi.stubGlobal('fetch', fetchMock)

    const callMCPTool = vi.fn(async () => {
      throw new Error('boom')
    })
    const onToolResult = vi.fn()

    const svc = new AIService(makeDeps({ getMCPTools: () => [echoTool], callMCPTool }))
    await svc.chat(baseRequest, { ...baseHandlers(), onToolResult })

    expect(onToolResult).toHaveBeenCalledWith('r1', 'echo', false, 'boom')
    const secondBody = JSON.parse((fetchMock.mock.calls[1][1] as RequestInit).body as string)
    const toolMsg = secondBody.messages.find((m: { role: string }) => m.role === 'tool')
    expect(toolMsg.content).toBe('工具调用失败: boom')
  })
})
