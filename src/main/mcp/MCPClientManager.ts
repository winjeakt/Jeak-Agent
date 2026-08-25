import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type { AIToolDefinition, MCPServerConfig } from '../../shared/types'

interface ServerConnection {
  client: Client
  transport: StdioClientTransport | StreamableHTTPClientTransport
}

interface ToolEntry {
  /** 暴露给 AI 的唯一工具名（pluginName__toolName） */
  aiName: string
  /** MCP server 中的原始工具名 */
  mcpName: string
  pluginName: string
  connection: ServerConnection
  definition: AIToolDefinition
}

/**
 * MCP 客户端管理器：连接插件声明的 MCP servers（mcp.json），
 * 枚举工具并统一暴露给 AI（function calling）。
 *
 * 工具命名：为避免不同插件/服务器间的工具名冲突，暴露给 AI 的名字统一为
 * `<pluginName>__<mcpToolName>`（非法字符替换为下划线）。
 */
export class MCPClientManager {
  /** key: `${pluginName}::${serverName}` */
  private connections = new Map<string, ServerConnection>()
  /** key: aiName */
  private toolIndex = new Map<string, ToolEntry>()

  constructor(
    /** 获取插件数据目录（PLUGIN_DATA），通常位于 userData/plugin-data/<name> */
    private readonly getPluginDataDir: (pluginName: string) => string
  ) {}

  /** 当前已连接的 MCP server 数量 */
  get connectedServerCount(): number {
    return this.connections.size
  }

  /** 连接某插件的全部 MCP servers（幂等；失败单个跳过，不阻塞整体加载） */
  async connectPlugin(
    pluginName: string,
    pluginDir: string,
    servers: Record<string, MCPServerConfig>
  ): Promise<void> {
    // 幂等：先清理该插件已有的连接，避免重复连接泄漏
    await this.disconnectPlugin(pluginName)
    for (const [serverName, config] of Object.entries(servers)) {
      const key = `${pluginName}::${serverName}`
      try {
        const connection = await this.connectServer(config, pluginDir, pluginName)
        this.connections.set(key, connection)
        const { tools } = await connection.client.listTools()
        let count = 0
        for (const tool of tools ?? []) {
          if (!tool?.name) continue
          const aiName = this.toAIToolName(pluginName, tool.name)
          const definition: AIToolDefinition = {
            type: 'function',
            function: {
              name: aiName,
              description: tool.description ?? `MCP 工具 ${tool.name}`,
              parameters: (tool.inputSchema as Record<string, unknown>) ?? {
                type: 'object',
                properties: {}
              }
            }
          }
          this.toolIndex.set(aiName, {
            aiName,
            mcpName: tool.name,
            pluginName,
            connection,
            definition
          })
          count += 1
        }
        console.log(`[mcp] ${key} 已连接，暴露 ${count} 个工具`)
      } catch (error) {
        console.error(`[mcp] 连接 ${key} 失败:`, error)
      }
    }
  }

  /** 断开某插件的全部 MCP servers 并清理其工具索引 */
  async disconnectPlugin(pluginName: string): Promise<void> {
    for (const [key, conn] of [...this.connections]) {
      if (key.startsWith(`${pluginName}::`)) {
        await conn.client.close().catch(() => {})
        this.connections.delete(key)
      }
    }
    for (const [aiName, entry] of [...this.toolIndex]) {
      if (entry.pluginName === pluginName) this.toolIndex.delete(aiName)
    }
  }

  /** 全部已连接 MCP servers 暴露给 AI 的工具定义 */
  listTools(): AIToolDefinition[] {
    return [...this.toolIndex.values()].map((e) => e.definition)
  }

  /** 调用工具（按 AI 侧工具名），返回文本结果 */
  async callTool(aiName: string, args: unknown): Promise<string> {
    const entry = this.toolIndex.get(aiName)
    if (!entry) throw new Error(`MCP 工具不存在: ${aiName}`)
    const result = await entry.connection.client.callTool({
      name: entry.mcpName,
      arguments: (args ?? {}) as Record<string, unknown>
    })
    return extractText(result)
  }

  /** 关闭全部连接 */
  async dispose(): Promise<void> {
    for (const conn of this.connections.values()) {
      await conn.client.close().catch(() => {})
    }
    this.connections.clear()
    this.toolIndex.clear()
  }

  private async connectServer(
    config: MCPServerConfig,
    pluginDir: string,
    pluginName: string
  ): Promise<ServerConnection> {
    const client = new Client({ name: 'jeak-agent', version: '0.2.0' })
    const pluginDataDir = this.getPluginDataDir(pluginName)

    if (config.type === 'stdio') {
      // Electron 内置 Node：无系统 node 时以纯 Node 模式运行 server 脚本
      const nodeCommand = process.execPath
      const command = expandPlaceholders(config.command, pluginDir, pluginDataDir, nodeCommand)
      const env = this.buildEnv(config.env, pluginDir, pluginDataDir, nodeCommand)
      // ${NODE} 指向 electron 可执行文件，需 ELECTRON_RUN_AS_NODE=1 才能作为 node 运行
      if (config.command.includes('${NODE}')) {
        env.ELECTRON_RUN_AS_NODE = '1'
      }
      const transport = new StdioClientTransport({
        command,
        args: config.args?.map((a) => expandPlaceholders(a, pluginDir, pluginDataDir, nodeCommand)),
        env,
        cwd: config.cwd ? expandPlaceholders(config.cwd, pluginDir, pluginDataDir, nodeCommand) : undefined
      })
      await client.connect(transport)
      return { client, transport }
    }

    const transport = new StreamableHTTPClientTransport(new URL(config.url), {
      requestInit: config.headers ? { headers: config.headers } : undefined
    })
    await client.connect(transport)
    return { client, transport }
  }

  private buildEnv(
    env: Record<string, string> | undefined,
    pluginDir: string,
    pluginDataDir: string,
    nodeCommand: string
  ): Record<string, string> {
    const base: Record<string, string> = {
      ...(process.env as Record<string, string>),
      PLUGIN_ROOT: pluginDir,
      PLUGIN_DATA: pluginDataDir
    }
    if (env) {
      for (const [k, v] of Object.entries(env)) {
        base[k] = expandPlaceholders(v, pluginDir, pluginDataDir, nodeCommand)
      }
    }
    return base
  }

  private toAIToolName(pluginName: string, mcpName: string): string {
    const safe = mcpName.replace(/[^a-zA-Z0-9_-]/g, '_')
    return `${pluginName}__${safe}`
  }
}

/** 展开 mcp.json 中的占位符：${PLUGIN_ROOT} / ${PLUGIN_DATA} / ${NODE}（Node 运行时） */
function expandPlaceholders(
  value: string,
  pluginDir: string,
  pluginDataDir: string,
  nodeCommand: string
): string {
  return value
    .replace(/\$\{PLUGIN_ROOT\}/g, pluginDir)
    .replace(/\$\{PLUGIN_DATA\}/g, pluginDataDir)
    .replace(/\$\{NODE\}/g, nodeCommand)
}

/** 从 MCP 调用结果中提取文本内容（宽松解析，兼容 SDK 的联合类型） */
function extractText(result: unknown): string {
  const r = result as {
    content?: Array<{ type?: string; text?: string }>
    isError?: boolean
  }
  const texts = (r.content ?? [])
    .filter((c) => c?.type === 'text' && typeof c.text === 'string')
    .map((c) => c.text as string)
  if (texts.length > 0) return texts.join('\n')
  return r.isError ? '工具执行失败（无文本输出）' : '（无输出）'
}
