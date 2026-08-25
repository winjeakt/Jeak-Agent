# Jeak Agent 插件开发指南

本指南面向完全没有接触过 Jeak Agent 插件机制的新开发者。按步骤操作，你可以在 **30 分钟内**完成一个 "Hello World" 插件的创建、加载与运行，并逐步掌握技能（Skills）与 MCP 工具的开发方法。

> 阅读前提：你已能通过 `npm run dev` 启动 Jeak Agent 开发环境（见仓库 `README.md` 的「快速开始」）。

---

## 目录

1. [引言：插件是什么](#1-引言插件是什么)
2. [环境准备](#2-环境准备)
3. [第一个插件：Hello World](#3-第一个插件hello-world)
4. [插件 API 速查（pluginAPI）](#4-插件-api-速查pluginapi)
5. [技能（Skills）开发](#5-技能skills开发)
6. [MCP 工具开发](#6-mcp-工具开发)
7. [调试与测试](#7-调试与测试)
8. [发布插件到 Awesome Copilot](#8-发布插件到-awesome-copilot)
9. [附录：plugin.json 全字段参考](#9-附录pluginjson-全字段参考)

---

## 1. 引言：插件是什么

一个 **Jeak Agent 插件**就是一个放在插件目录下的普通文件夹，里面至少包含一个 `plugin.json` 清单文件。插件可以具备三种能力，**一个插件可同时具备一种或多种**：

| 能力 | 载体文件 | 作用 | 示例 |
|------|----------|------|------|
| **命令** | `main.js`（入口脚本） | 在「插件管理」面板注册并运行命令，通过 AI / 文件 / 编辑器等 API 做事 | `demo-tools.hello` |
| **技能（Skills）** | `skills/<name>/SKILL.md` | 把一段专业指令注入 AI 的系统提示词，让 AI 掌握新能力 | `jeak-demo` |
| **MCP 工具** | `mcp.json` + `server.js` | 向 AI 暴露可被 function calling 调用的外部工具 | `echo`、`add_numbers` |

**最核心的一条机制**：插件入口脚本**不是** Node.js 的 CommonJS 模块，而是被注入到一个隔离的沙箱页面中直接执行，只能通过全局对象 `window.pluginAPI` 与宿主交互。它**没有** `require`、`module.exports`、`process` 等能力。

```js
// ❌ 错误：插件里不能这样写
// const fs = require('fs')
// module.exports = { activate() {} }

// ✅ 正确：只能通过 window.pluginAPI
window.pluginAPI.log('info', '我的插件已加载')
```

---

## 2. 环境准备

### 2.1 Node.js

- **命令型 / 技能型插件**：不依赖 Node.js 运行时，因为插件脚本运行在 Jeak Agent 自带的沙箱内。
- **MCP 工具型插件**：**也无需在系统 PATH 中安装 Node.js**。`mcp.json` 里可用 `${NODE}` 占位符，主进程会把它解析为 Electron 内置的 Node 运行时（`ELECTRON_RUN_AS_NODE=1`）。
- 仅当你希望**脱离应用、独立调试 `server.js`**（例如直接在终端跑 `node server.js`）时，才建议安装 Node.js 22 LTS（本仓库自带 `node-v22.12.0-win-x64`）。

### 2.2 推荐 IDE

[VS Code](https://code.visualstudio.com/)（任意带 JSON / Markdown 语法高亮的编辑器均可）。

### 2.3 插件目录

插件统一放在**插件根目录**下，每个插件是一个子目录：

| 平台 | 路径 |
|------|------|
| macOS / Linux | `~/.jeak/plugins/<插件名>/` |
| Windows | `C:\Users\<用户名>\.jeak\plugins\<插件名>\` |

只要某个直接子目录里存在合法的 `plugin.json`，就会被识别为一个插件。应用重启后，在「设置 → 插件管理」中可见、可启用、可运行。

> 官方示例插件 `demo-tools` 位于本仓库 `plugins-market/demo-tools/`，是学习的最佳参考。

---

## 3. 第一个插件：Hello World

目标：创建一个名为 `hello-world` 的插件，注册一条命令，运行后在日志中打印 "Hello, World!"。

### 3.1 创建目录

在插件根目录下创建 `hello-world/` 目录：

```text
~/.jeak/plugins/hello-world/
```

（Windows 对应 `C:\Users\<用户名>\.jeak\plugins\hello-world\`）

### 3.2 编写 plugin.json

新建 `plugin.json`：

```json
{
  "$schema": "https://jeak.dev/schemas/plugin-1.0.json",
  "name": "hello-world",
  "version": "1.0.0",
  "description": "我的第一个 Jeak Agent 插件：打印 Hello World",
  "author": { "name": "你的名字" },
  "license": "MIT",
  "entry": "main.js",
  "permissions": [],
  "contributes": {
    "commands": [
      { "command": "hello-world.say", "title": "Hello World" }
    ]
  }
}
```

字段说明：

- `name`（必填）：插件唯一标识。规则为**小写字母 / 数字 / 点 / 连字符**，首尾必须是字母或数字，禁止 `..` 与 `--`，长度 1-64。
- `version`（必填）：语义化版本号，格式 `x.y.z`。
- `entry`：入口脚本文件名。**默认是 `plugin.js`**；这里显式指定为 `main.js`。只允许纯文件名（禁止路径）。
- `permissions`：本插件申请的权限白名单。Hello World 只用到了 `log` / `registerCommand` / `onCommand` 这些**无需权限**的基础 API，所以填空数组 `[]`。
- `contributes.commands`：声明命令，供「插件管理」面板展示。`command` 建议带插件名前缀。

### 3.3 编写入口脚本 main.js

新建 `main.js`：

```js
;(function () {
  'use strict'

  // 注册一条命令（命令 ID 必须与 plugin.json 中声明的一致）
  window.pluginAPI.registerCommand('hello-world.say', 'Hello World')

  // 监听命令触发：当用户在「插件管理」面板点击「运行」时回调
  window.pluginAPI.onCommand(function (command) {
    if (command === 'hello-world.say') {
      window.pluginAPI.log('info', 'Hello, World! 我的第一个插件已运行。')
    }
  })

  // 加载完成时打印一条日志，用于确认插件已被加载
  window.pluginAPI.log('info', 'hello-world 插件已加载')
})()
```

要点：

- 整个脚本包在 IIFE 里，避免污染全局。
- 只能访问 `window.pluginAPI`，没有 `require` / `module.exports`。
- 脚本在插件被启用时**顶层直接执行**（不存在 `activate`/`deactivate` 生命周期），所以 `registerCommand`、`onCommand`、`log` 都直接写在顶层即可。

### 3.4 加载与运行

1. 重启应用（或在插件管理面板中重新启用该插件）。
2. 打开「设置 → 插件管理」，应能看到 `hello-world` 插件。
3. 启用后，点击其命令 `hello-world.say` 旁的「运行」。

在启动应用的终端里，应看到类似日志：

```text
[plugin:hello-world] (info) hello-world 插件已加载
[plugin:hello-world] (info) Hello, World! 我的第一个插件已运行。
```

看到这两行，你的第一个插件就成功了。

---

## 4. 插件 API 速查（pluginAPI）

入口脚本通过 `window.pluginAPI` 访问所有能力。带「需权限」标记的能力，必须在 `plugin.json` 的 `permissions` 中声明，否则调用会失败。

### 4.1 基础 API（无需权限）

| API | 签名 | 说明 |
|-----|------|------|
| `registerCommand` | `(command: string, title: string) => void` | 注册命令元信息（与 `contributes.commands` 对应） |
| `onCommand` | `(cb: (command: string) => void) => void` | 订阅命令触发事件 |
| `log` | `(level: 'info' \| 'warn' \| 'error', message: string) => void` | 输出日志到主进程 console |
| `meta.platform` | `string` | 运行平台（`darwin` / `win32` / `linux`） |

### 4.2 AI 能力

| API | 签名 | 权限 |
|-----|------|------|
| `ai.chat` | `(request: AIChatRequest) => Promise<string>` | `ai:chat` |
| `ai.streamChat` | `(request: AIChatRequest) => void` | `ai:stream` |
| `ai.stop` | `(id: string) => void` | — |
| `ai.onDelta` | `(cb) => () => void` | — |
| `ai.onDone` | `(cb) => () => void` | — |
| `ai.onError` | `(cb) => () => void` | — |

`AIChatRequest` 结构：

```ts
interface AIChatRequest {
  id: string                       // 会话 ID，用于关联流式增量
  messages: { role: 'system' | 'user' | 'assistant' | 'tool'; content: string }[]
  model: 'deepseek-chat' | 'deepseek-reasoner'
  temperature?: number
  maxTokens?: number
}
```

示例（一次性对话）：

```js
var reply = await window.pluginAPI.ai.chat({
  id: 'my-chat-' + Date.now(),
  messages: [
    { role: 'system', content: '你是一个简洁的助手。' },
    { role: 'user', content: '用一句话介绍你自己。' }
  ],
  model: 'deepseek-chat'
})
window.pluginAPI.log('info', 'AI 回复：' + reply)
```

### 4.3 文件系统能力

| API | 签名 | 权限 |
|-----|------|------|
| `fs.readTextFile` | `(filePath: string) => Promise<string>` | `fs:read` |
| `fs.writeTextFile` | `(filePath: string, content: string) => Promise<{ ok: boolean }>` | `fs:write` |

> 路径会由主进程做白名单与越界校验，插件只能访问被允许的范围。

### 4.4 编辑器能力

| API | 签名 | 权限 |
|-----|------|------|
| `editor.getState` | `() => Promise<unknown>` | `editor:get` |
| `editor.replaceSelection` | `(text: string) => Promise<{ ok: boolean }>` | `editor:apply` |
| `editor.showDiagnostics` | `(diagnostics: Diagnostic[]) => Promise<{ ok: boolean }>` | `editor:apply` |

### 4.5 Git / Lint / 项目能力

| API | 签名 | 权限 |
|-----|------|------|
| `git.diff` | `(request) => Promise<string>` | `git:diff` |
| `git.status` | `(request?) => Promise<string>` | `git:status` |
| `git.run` | `(request) => Promise<string>` | `git:run` |
| `lint.run` | `(request) => Promise<{ filePath; diagnostics }>` | `lint:run` |
| `project.get` | `() => Promise<{ root; openFiles }>` | `project:get` |

完整的权限枚举（共 11 项）：

```
ai:chat  ai:stream  fs:read  fs:write  editor:get  editor:apply
project:get  git:diff  git:status  git:run  lint:run
```

---

## 5. 技能（Skills）开发

**技能**是一段写给 AI 的专业指令。它会被注入到 AI 的系统提示词中，让 AI 在需要时「想起」并使用这些知识。

### 5.1 目录与命名

技能**无需在 `plugin.json` 中声明**，加载器会自动扫描插件目录下的 `skills/` 子目录：每个含 `SKILL.md` 的直接子目录即视为一个技能。

```text
hello-world/
├── plugin.json
├── main.js
└── skills/
    └── code-review/          ← 技能名（目录名）
        └── SKILL.md
```

### 5.2 SKILL.md 格式

`SKILL.md` 由两部分组成：

- **frontmatter**（`---` 包裹的 YAML）：`name` 与 `description` 两个字段。
  - `name`：技能名（缺省使用目录名）。
  - `description`：**一句话描述，会被注入 AI 系统提示词**，告诉 AI「何时该用这个技能」。
- **正文**：完整指令，同样注入 AI 上下文。

示例 `skills/code-review/SKILL.md`：

```markdown
---
name: code-review
description: 对用户提供的代码进行中文代码评审，输出问题清单与改进建议。
---

# 代码评审技能

当用户要求「评审 / review / 看看这段代码」时，按以下流程执行：

1. 先总结代码的整体用途与结构。
2. 从「正确性、可读性、性能、安全性」四个维度逐条检查。
3. 输出问题清单，每条包含：严重级别（🔴 严重 / 🟡 建议 / 🟢 可选）、位置、问题描述、修改建议。

## 输出格式

以 Markdown 表格呈现，并在结尾给出总体评分（1-10 分）。
```

### 5.3 如何让 AI 识别

- `description` 是关键：它决定了 AI 在什么场景下会「触发」这个技能。描述要写清楚**触发条件 + 做什么**。
- 加载成功后，主进程日志会显示该插件已加载的技能信息。
- 用户无需手动调用——只要对话内容命中描述，AI 就会自动应用该技能。

> 技能与 MCP 工具配合使用时，在正文中直接写出工具名（如 `demo-tools__echo`），AI 即可在技能指引下调用这些工具（见下一章）。

---

## 6. MCP 工具开发

**MCP（Model Context Protocol）工具**让 AI 能调用你自定义的外部函数（function calling）。Jeak Agent 会启动你声明的 MCP server，将其工具列表暴露给 AI。

一个 MCP 工具型插件至少包含：

```text
my-mcp-plugin/
├── plugin.json
├── mcp.json          ← 声明 MCP server
└── server.js         ← 实现 MCP 协议的工具
```

### 6.1 mcp.json 格式

顶层是一个 `mcpServers` 对象，key 是 server 名。支持两种传输类型：

**stdio 型**（本地子进程，通过 stdin/stdout 通信）：

```json
{
  "mcpServers": {
    "demo": {
      "type": "stdio",
      "command": "${NODE}",
      "args": ["${PLUGIN_ROOT}/server.js"]
    }
  }
}
```

**streamable-http 型**（远程 HTTP 端点）：

```json
{
  "mcpServers": {
    "remote": {
      "type": "streamable-http",
      "url": "https://example.com/mcp",
      "headers": { "Authorization": "Bearer <token>" }
    }
  }
}
```

### 6.2 占位符

| 占位符 | 解析结果 |
|--------|----------|
| `${NODE}` | Electron 内置 Node 可执行文件（配 `ELECTRON_RUN_AS_NODE=1`） |
| `${PLUGIN_ROOT}` | 插件目录的绝对路径 |
| `${PLUGIN_DATA}` | 插件数据目录（可写，用于持久化） |

> 因为 `${NODE}` 指向 Electron 内置 Node，所以**发布给用户的插件无需要求对方安装 Node.js**。

### 6.3 server.js 写法（零依赖，手写 MCP 协议）

`server.js` 只需使用 Node 内置模块，实现 MCP stdio 协议的最小子集（`initialize` / `ping` / `tools/list` / `tools/call`）。协议约定：**stdin 每行一个 JSON-RPC 2.0 消息，stdout 每行回复一个 JSON 消息**。

下面是一个完整的单工具示例（回显），可直接复制使用：

```js
'use strict'

const readline = require('readline')

const SERVER_NAME = 'my-echo'
const SERVER_VERSION = '1.0.0'
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
        instructions: 'my-echo 演示服务器：提供 echo 工具。'
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
    if (name === 'echo') {
      const text = String(args.text != null ? args.text : '')
      return respond(id, { content: [{ type: 'text', text }] })
    }
    return respondError(id, -32602, `Unknown tool: ${name}`)
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
```

> 想看多工具 + 更完整的实现，参考本仓库 `plugins-market/demo-tools/server.js`（含 `echo` / `add_numbers` / `get_current_time` / `list_directory` 四个工具）。

### 6.4 工具如何暴露给 AI

- 主进程启动 MCP server 后，会把工具名映射为 **`<插件名>__<工具名>`** 的格式暴露给 AI。例如插件 `demo-tools` 的 `echo` 工具，AI 实际调用名为 `demo-tools__echo`。
- 连接成功的日志形如：

```text
[mcp] demo-tools::demo 已连接，暴露 4 个工具
```

- 用户无需手动触发——AI 在对话中判断需要调用时，会自动通过 function calling 调用这些工具。

### 6.5 让 AI 更会用你的工具（结合技能）

建议为 MCP 工具插件配套一个技能，在 `SKILL.md` 正文中明确写出工具名与使用场景：

```markdown
---
name: my-echo-skill
description: 当用户要求「回显 / 重复某句话」时使用。
---

用户要求「回显 / 重复」时，调用 `my-mcp-plugin__echo` 工具，
参数 text 为待回显文本，然后把返回结果直接呈现给用户。
```

---

## 7. 调试与测试

### 7.1 查看日志

插件日志通过 `console` 输出，运行 `npm run dev` 的终端里可直接查看。不同来源使用不同前缀：

| 前缀 | 来源 | 示例 |
|------|------|------|
| `[plugin:<插件名>]` | 插件入口脚本的 `log` | `[plugin:hello-world] (info) hello-world 插件已加载` |
| `[mcp]` | MCP server 连接 / 工具暴露 | `[mcp] demo-tools::demo 已连接，暴露 4 个工具` |
| `[plugins]` | 插件系统整体初始化 | `[plugins] 初始化完成，共 4 个插件` |

> 注意：插件脚本内的 `console.log` 也会被转发到主进程日志，但**推荐统一使用 `window.pluginAPI.log`**，它会携带 `[plugin:<插件名>]` 前缀和级别，便于过滤。

### 7.2 重载插件

插件目录的变更（新增 / 修改 / 删除文件）**不会自动热重载**。生效方式：

1. **推荐**：在「设置 → 插件管理」中先**禁用再启用**该插件，触发重新加载。
2. **兜底**：重启应用（`npm run dev` 下 Ctrl+C 后重新启动）。

### 7.3 常见问题排查

| 现象 | 可能原因 | 解决 |
|------|----------|------|
| 插件管理面板里看不到插件 | `plugin.json` 缺失 / 不在插件根目录的直接子目录 | 检查目录结构与文件位置 |
| 报 `name 必须是 ...` | `name` 不符合命名规则（大写、下划线、`..`/`--` 等） | 改为小写字母/数字/点/连字符 |
| 报 `version 必须是 x.y.z` | 版本号格式不对 | 改为如 `1.0.0` |
| 报 `permissions 包含非法权限` | 声明了不存在的权限 | 对照 11 项合法权限 |
| 命令点了「运行」没反应 | `onCommand` 未注册 / 命令 ID 与 `registerCommand` 不一致 | 核对两端命令 ID |
| MCP 未连接 | `mcp.json` 格式错误 / `server.js` 报错 | 独立运行 `node server.js` 手动发 JSON-RPC 消息验证 |
| 技能未生效 | `SKILL.md` 不在 `skills/<name>/` 下 / frontmatter 缺失 | 检查路径与 frontmatter |

### 7.4 独立调试 MCP server

无需启动应用，直接用 Node 手动测试 `server.js`：

```bash
node server.js
```

随后手动粘贴一行 JSON-RPC 请求验证（回车后应返回结果）：

```text
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}
{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}
{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"echo","arguments":{"text":"hi"}}}
```

---

## 8. 发布插件到 Awesome Copilot

开发完成后，把插件分享到 **Awesome Copilot** 社区市场，供其他用户一键安装。

### 8.1 市场机制

Jeak Agent 的「插件市场」会读取 Awesome Copilot 社区仓库（当前市场源为 GitHub 仓库 `github/awesome-copilot`，`main` 分支）下的 `plugins/` 目录：其中**每个子目录就是一个插件**，市场会读取其 `plugin.json` 的 `name` / `description` / `version` 用于展示。

> 若 `plugin.json` 缺失或无法解析，市场会将该插件标记为「信息待完善」，仍可安装但展示信息不完整。因此**务必保证 `name`、`version`、`description` 三字段完整**。

### 8.2 目录规范

每个插件目录应包含：

```text
plugins/<插件名>/
├── plugin.json      ← 必填：name / version / description
├── main.js          ← 可选：命令入口
├── mcp.json         ← 可选：MCP server 声明
├── server.js        ← 可选：MCP server 实现
├── skills/          ← 可选：技能
│   └── <技能名>/SKILL.md
├── README.md        ← 推荐：说明用途、能力、使用方法
└── LICENSE          ← 推荐：开源协议
```

### 8.3 发布步骤

1. **Fork** 社区仓库 `github/awesome-copilot`。
2. **Clone** 你的 fork 到本地。
3. 在 `plugins/` 目录下新建 `<插件名>/` 子目录，放入完整插件文件。
4. 本地自测：把该目录复制到 `~/.jeak/plugins/` 验证可正常加载运行。
5. **Commit & Push** 到你的 fork。
6. 发起 **Pull Request**，标题注明插件名与功能简介。
7. 等待社区审核合并。合并后，其他用户在「插件市场 → 刷新列表」即可看到并安装。

### 8.4 安装地址

插件上架后，其 GitHub 安装地址形如：

```text
https://github.com/github/awesome-copilot/tree/main/plugins/<插件名>
```

---

## 9. 附录：plugin.json 全字段参考

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `$schema` | string | 否 | 规范地址，如 `https://jeak.dev/schemas/plugin-1.0.json` |
| `name` | string | **是** | 插件名：小写字母/数字/点/连字符，首尾字母数字，禁 `..` 与 `--`，1-64 字符 |
| `version` | string | **是** | 语义化版本号 `x.y.z` |
| `description` | string | 否 | 插件描述（市场展示用，建议必填） |
| `author` | object \| string | 否 | 作者，对象形如 `{ "name": "", "email": "", "url": "" }`，也兼容字符串 |
| `homepage` | string | 否 | 项目主页 |
| `repository` | string | 否 | 源码仓库地址 |
| `license` | string | 否 | 开源协议 |
| `keywords` | string[] | 否 | 关键词 |
| `extensions` | object | 否 | 客户端扩展（可放 `extensions["dev.jeak-agent"]` 命名空间） |
| `skills` | string \| string[] | 否 | 兼容 GitHub Copilot 插件格式的技能目录声明 |
| `agents` | string \| string[] | 否 | 兼容 GitHub Copilot 插件格式的 agent 目录声明 |
| `entry` | string | 否 | 入口脚本文件名（默认 `plugin.js`，仅允许纯 `.js` 文件名） |
| `permissions` | string[] | **是** | 申请的权限白名单（可为空数组 `[]`） |
| `contributes.commands` | object[] | 否 | 命令声明，每项 `{ "command": "", "title": "" }` |

**完整 plugin.json 示例**（命令 + 权限）：

```json
{
  "$schema": "https://jeak.dev/schemas/plugin-1.0.json",
  "name": "code-formatter",
  "version": "0.1.0",
  "description": "格式化当前编辑器的选中代码",
  "author": { "name": "your-name", "url": "https://example.com" },
  "license": "MIT",
  "keywords": ["format", "editor"],
  "entry": "main.js",
  "permissions": ["editor:get", "editor:apply"],
  "contributes": {
    "commands": [
      { "command": "code-formatter.format", "title": "格式化选中代码" }
    ]
  }
}
```

---

## 延伸阅读

- 官方示例插件：`plugins-market/demo-tools/`（命令 + 技能 + MCP 工具的完整范例）
- 插件系统架构：仓库根目录 `ARCHITECTURE.md`
- 权限与安全模型：仓库 `README.md` 的「安全模型」章节
