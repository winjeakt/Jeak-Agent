# demo-tools 示例插件

端到端演示 Jeak-Agent 插件体系的「MCP 工具 + 技能」能力：

- `mcp.json` — 声明一个 stdio 型 MCP server（`server.js`，零依赖、手写 MCP 协议）
- `skills/demo/SKILL.md` — 声明一个技能，其描述会注入 AI system 提示词
- `main.js` — 命令入口，演示「命令 → AI → 自动调用 MCP 工具」

## 提供的能力

| 类型 | 名称 | 说明 |
|------|------|------|
| MCP 工具 | `echo` | 回显文本 |
| MCP 工具 | `add_numbers` | 两数相加 |
| MCP 工具 | `get_current_time` | 当前时间 |
| MCP 工具 | `list_directory` | 列举目录 |
| 技能 | `jeak-demo` | 指引 AI 使用上述工具 |
| 命令 | `demo-tools.hello` | 打印欢迎语 |
| 命令 | `demo-tools.call-echo` | AI 调用 echo 工具 |

## 安装

复制整个目录到插件根目录后重启应用：

```text
~/.jeak/plugins/demo-tools/
  ├── plugin.json
  ├── mcp.json
  ├── server.js
  ├── main.js
  ├── README.md
  └── skills/demo/SKILL.md
```

## MCP server 说明

`mcp.json` 中 `command` 使用 `${NODE}` 占位符：由主进程解析为 Electron 内置的
Node 运行时（`ELECTRON_RUN_AS_NODE=1`），因此**无需在系统 PATH 中安装 Node**。

`server.js` 仅依赖 Node 内置模块（`readline` / `fs` / `path`），手写实现 MCP
stdio 协议的最小子集（`initialize` / `ping` / `tools/list` / `tools/call`）。

## 端到端验证结果

已通过真实应用运行验证（`npm run dev` 后读取主进程日志）：

```text
[plugin:demo-tools] (info) demo-tools 插件已加载
[mcp] demo-tools::demo 已连接，暴露 4 个工具
[plugins] 初始化完成，共 4 个插件
```

验证闭环：

| 环节 | 结果 |
|------|------|
| loader 加载示例插件 | ✅ `demo-tools 插件已加载` |
| `${NODE}` 解析为 Electron 内置 Node | ✅ server 经 `ELECTRON_RUN_AS_NODE` 拉起 |
| MCP server 握手 + 枚举工具 | ✅ `已连接，暴露 4 个工具` |
| 工具名映射（`demo-tools__echo` 等） | ✅ 工具索引建立无报错 |
| 类型检查 + 构建 | ✅ 两侧 `tsc` 通过，`out/main` 同步 |

## 体验 AI 自动调用工具

安装并配置 API Key 后，在对话面板输入：

> 帮我算一下 3 加 5 等于多少

AI 会自动识别并调用 `demo-tools__add_numbers`，聊天区显示「🔧 正在调用工具」，返回 `3 + 5 = 8`。

其它可触发示例：

| 提示语 | 触发工具 |
|--------|----------|
| 「回显一句话：你好」 | `echo` |
| 「现在几点了」 | `get_current_time` |
| 「列出 e:/ 目录」 | `list_directory` |

也可在「插件管理」中运行命令 `demo-tools.hello`（打招呼）或
`demo-tools.call-echo`（命令内发起 AI 对话，AI 自动调用 `echo`）。
