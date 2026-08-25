'use strict'

/**
 * demo-tools 的 MCP server（零依赖，手写 MCP stdio 协议）。
 * 仅使用 Node.js 内置模块，跨平台运行，无需 npm install。
 *
 * 协议：每行一个 JSON-RPC 2.0 消息，以 \n 结尾。
 * 支持方法：initialize / ping / tools/list / tools/call。
 */

const readline = require('readline')
const fs = require('fs')
const path = require('path')

const SERVER_NAME = 'demo-tools'
const SERVER_VERSION = '1.0.0'

// 保守协商版本（必须落在 client 的 SUPPORTED_PROTOCOL_VERSIONS 内）
const PROTOCOL_VERSION = '2025-03-26'

// 工具定义（JSON Schema）
const TOOLS = [
  {
    name: 'echo',
    description: '回显一段文本，用于验证工具调用链路是否贯通',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: '要回显的文本' }
      },
      required: ['text']
    }
  },
  {
    name: 'add_numbers',
    description: '计算两个数字之和',
    inputSchema: {
      type: 'object',
      properties: {
        a: { type: 'number', description: '第一个数字' },
        b: { type: 'number', description: '第二个数字' }
      },
      required: ['a', 'b']
    }
  },
  {
    name: 'get_current_time',
    description: '获取当前本地时间（ISO 8601 格式）',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'list_directory',
    description: '列出指定目录下的文件与子目录',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '要列出的目录绝对路径' }
      },
      required: ['path']
    }
  }
]

function send(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n')
}

function respond(id, result) {
  send({ jsonrpc: '2.0', id, result })
}

function respondError(id, code, message) {
  send({ jsonrpc: '2.0', id, error: { code, message } })
}

function handleRequest(msg) {
  const { id, method, params } = msg

  switch (method) {
    case 'initialize':
      return respond(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
        instructions:
          'demo-tools 演示服务器：提供 echo / add_numbers / get_current_time / list_directory 四个工具。'
      })

    case 'ping':
      return respond(id, {})

    case 'tools/list':
      return respond(id, { tools: TOOLS })

    case 'tools/call':
      return handleToolCall(id, params)

    default:
      return respondError(id, -32601, `Method not found: ${method}`)
  }
}

function handleToolCall(id, params) {
  const name = params && params.name
  const args = (params && params.arguments) || {}

  try {
    let text = ''

    switch (name) {
      case 'echo':
        text = String(args.text != null ? args.text : '')
        break

      case 'add_numbers': {
        const a = Number(args.a)
        const b = Number(args.b)
        if (Number.isNaN(a) || Number.isNaN(b)) {
          return respondError(id, -32602, 'add_numbers 需要有效的数字参数 a 与 b')
        }
        text = `${a} + ${b} = ${a + b}`
        break
      }

      case 'get_current_time':
        text = new Date().toISOString()
        break

      case 'list_directory': {
        const dir = String(args.path || '.')
        const entries = fs.readdirSync(dir, { withFileTypes: true })
        text = entries
          .map((e) => `${e.isDirectory() ? '[D]' : '[F]'} ${path.join(dir, e.name)}`)
          .join('\n')
        break
      }

      default:
        return respondError(id, -32602, `Unknown tool: ${name}`)
    }

    return respond(id, { content: [{ type: 'text', text }] })
  } catch (error) {
    return respondError(id, -32603, error instanceof Error ? error.message : String(error))
  }
}

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity })

rl.on('line', (line) => {
  if (!line || !line.trim()) return
  let msg
  try {
    msg = JSON.parse(line)
  } catch {
    return // 忽略无法解析的行
  }
  // 仅处理带 id 的请求；通知（如 notifications/initialized）无 id，直接忽略
  if (msg && typeof msg === 'object' && typeof msg.method === 'string' && 'id' in msg) {
    handleRequest(msg)
  }
})

// stdin 关闭（client 断开）时退出，避免进程挂起
rl.on('close', () => process.exit(0))
