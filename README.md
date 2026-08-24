# Jeak Agent

> AI Native 本地化编程助手桌面平台

Jeak Agent 是一款基于 **DeepSeek API** 的本地化 AI 编程辅助桌面应用，以 **Agent Plugins 1.0** 为标准，构建开放、安全的插件生态系统。

## ✨ 特性

- **AI Native**：内置 DeepSeek 流式对话，支持代码解释（`Ctrl+E`）、上下文感知
- **插件优先**：所有功能通过插件扩展，遵循 Agent Plugins 1.0 标准
- **安全第一**：插件运行在多层沙箱内（进程隔离 + Electron 沙箱 + 上下文隔离 + 权限白名单）
- **本地化**：API Key 仅存于本地加密存储，不经手任何第三方服务器

## 🛠 技术栈

| 层 | 技术 |
|---|---|
| 桌面框架 | Electron |
| UI 框架 | React + TypeScript |
| 代码编辑器 | Monaco Editor |
| 状态管理 | Zustand |
| 本地存储 | electron-store（加密） |
| 插件标准 | Agent Plugins 1.0 |
| 构建工具 | Vite + electron-vite + electron-builder |

## 📦 快速开始

### 环境要求

- Node.js ≥ 18
- npm

### 安装与运行

```bash
# 安装依赖
npm install

# 开发模式（热更新）
npm run dev

# 类型检查
npm run typecheck

# 打包
npm run build:win    # Windows
npm run build:mac    # macOS
npm run build:linux  # Linux
```

### 配置 API Key

1. 运行 `npm run dev` 启动应用
2. 点击对话面板右上角 ⚙ 打开设置
3. 填入 DeepSeek API Key（[获取地址](https://platform.deepseek.com/)）
4. 选择模型（`deepseek-chat` 通用 / `deepseek-reasoner` 深度推理）

> API Key 由主进程加密存储（electron-store），仅用于请求 DeepSeek 服务，不会暴露给渲染进程或插件。

## 📁 项目结构

```text
jeak-agent/
├── src/
│   ├── main/                          # 主进程
│   │   ├── main.ts                    # 入口：窗口管理、IPC、插件初始化
│   │   └── services/
│   │       └── AIService.ts           # DeepSeek 流式对话服务
│   ├── preload/                       # 预加载脚本
│   │   ├── mainPreload.ts             # 主窗口受限 API（window.jeak）
│   │   └── pluginPreload.ts           # 插件沙箱受限 API（window.pluginAPI）
│   ├── renderer/                      # 渲染进程（UI）
│   │   ├── App.tsx                    # 三栏布局（文件树/编辑器/对话）
│   │   ├── components/
│   │   │   ├── Editor/                # Monaco 编辑器、AI 解释浮层、问题面板
│   │   │   ├── ChatPanel/             # 对话面板、设置
│   │   │   ├── FileTree/              # 文件树
│   │   │   └── PluginManager/         # 插件管理面板
│   │   ├── stores/                    # Zustand 状态管理
│   │   └── services/                  # 渲染进程服务
│   ├── plugins/                       # 插件系统（主进程侧）
│   │   ├── loader/                    # 发现器、加载器（plugin.json 校验）
│   │   ├── runtime/                   # 沙箱、安全上下文、管理器
│   │   └── api/                       # 插件 API（ai/fs/editor/project/git/lint）
│   └── shared/                        # 共享类型定义
├── plugins-market/                    # 示例插件
│   ├── code-formatter/                # 代码格式化
│   ├── git-helper/                    # Git 辅助
│   └── eslint-integration/            # ESLint 集成
├── ARCHITECTURE.md                    # 架构方案文档
├── electron.vite.config.ts
├── electron-builder.yml
└── package.json
```

## 🔌 插件系统

插件遵循 **Agent Plugins 1.0** 标准，存放在 `~/.jeak/plugins/` 目录。

### 插件结构

```
my-plugin/
├── plugin.json          # 插件清单（名称、版本、权限、入口、命令）
├── main.js              # 插件入口脚本
└── SKILL.md             # 技能说明文档
```

### plugin.json 示例

```json
{
  "$schema": "https://jeak.dev/schemas/plugin-1.0.json",
  "name": "code-formatter",
  "version": "1.0.0",
  "description": "格式化选中代码",
  "author": "jeak",
  "license": "MIT",
  "entry": "main.js",
  "permissions": ["editor:get", "editor:apply"],
  "contributes": {
    "commands": [
      { "command": "code-formatter.format", "title": "格式化选中代码" }
    ]
  }
}
```

### 可用权限

| 权限 | 说明 |
|---|---|
| `ai:chat` / `ai:stream` | AI 一次性/流式对话 |
| `fs:read` / `fs:write` | 文件读写（路径白名单 + 大小上限） |
| `editor:get` / `editor:apply` | 读取编辑器状态 / 写入（含问题列表） |
| `project:get` | 读取项目信息 |
| `git:diff` / `git:status` / `git:run` | Git 操作（白名单子命令） |
| `lint:run` | 运行 ESLint |

### 安装插件

```bash
cp -r my-plugin ~/.jeak/plugins/
```

重启应用后，在「设置 → 插件管理」中启用、运行或卸载插件。

## 🔒 安全模型

插件运行在多层安全沙箱内：

1. **进程隔离**：每个插件独立渲染进程
2. **Electron 沙箱**：`sandbox: true` + `nodeIntegration: false`
3. **上下文隔离**：`contextIsolation: true`，仅通过严格 preload 暴露受限 API
4. **CSP 限制**：宿主页面 `default-src 'none'`，插件无法发起任何网络请求
5. **权限白名单**：所有 IPC 由主进程逐项校验权限
6. **路径防穿越**：文件/命令访问强制限制在允许范围内

## 🗺 开发路线图

- [x] **Phase 1** — 核心框架（Electron + React + Monaco）
- [x] **Phase 2** — AI 能力（DeepSeek 流式对话、代码解释）
- [x] **Phase 3** — 插件系统（发现、加载、沙箱运行时）
- [x] **Phase 4** — 核心插件（代码格式化、Git 辅助、ESLint 集成）
- [x] **Phase 5** — 文件系统（项目打开、文件树、文件保存）
- [x] **Phase 6** — 体验优化与打包发布（electron-builder 三平台 + GitHub Actions + 自动更新）

## 📄 License

[MIT](./LICENSE) © jeak
