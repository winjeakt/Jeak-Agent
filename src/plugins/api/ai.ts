import { ipcMain } from 'electron'
import type { AIChatRequest } from '../../shared/types'
import type { PluginApiDeps } from './types'

/** 插件 AI API：ai.chat（一次性）/ ai.streamChat（流式） */
export function registerAiApi(deps: PluginApiDeps): void {
  // 一次性对话：invoke 返回完整文本（内部复用流式通道）
  ipcMain.handle('plugin:ai:chat', async (event, request: AIChatRequest) => {
    const ctx = deps.getContext(event)
    ctx.requirePermission('ai:chat')
    if (typeof request !== 'object' || request === null || !Array.isArray(request.messages)) {
      throw new Error('无效的 AI 请求')
    }
    return deps.aiService.chatOnce(request)
  })

  // 流式对话：增量通过事件逐段回传插件窗口
  ipcMain.on('plugin:ai:stream', (event, request: AIChatRequest) => {
    const ctx = deps.getContext(event)
    ctx.requirePermission('ai:stream')
    if (typeof request !== 'object' || request === null || !Array.isArray(request.messages)) {
      event.sender.send('plugin:ai:error', { id: request?.id ?? '', message: '无效的 AI 请求' })
      return
    }
    void deps.aiService.chat(request, {
      onDelta: (id, delta) => event.sender.send('plugin:ai:delta', { id, delta }),
      onDone: (id, aborted) => event.sender.send('plugin:ai:done', { id, aborted }),
      onError: (id, message) => event.sender.send('plugin:ai:error', { id, message })
    })
  })

  // 停止流式
  ipcMain.on('plugin:ai:stream:stop', (event, id: string) => {
    const ctx = deps.getContext(event)
    ctx.requirePermission('ai:stream')
    if (typeof id === 'string') deps.aiService.stop(id)
  })
}
