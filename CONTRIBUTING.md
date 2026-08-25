# 贡献指南

感谢你对 **Jeak Agent** 的关注！这份文档将帮助你了解如何报告问题、提出建议、搭建开发环境，以及提交你的第一个 Pull Request。

无论你是修复一个拼写错误、改进文档，还是贡献一个全新的插件，我们都非常欢迎。请花几分钟阅读本文，它能让协作更顺畅。

## 目录

- [报告 Bug](#报告-bug)
- [提出新功能建议](#提出新功能建议)
- [开发环境搭建](#开发环境搭建)
- [代码风格规范](#代码风格规范)
- [提交信息规范](#提交信息规范)
- [提交 PR 流程](#提交-pr-流程)
- [测试要求](#测试要求)
- [为 Awesome Copilot 市场贡献插件](#为-awesome-copilot-市场贡献插件)

---

## 报告 Bug

发现问题后，请优先使用 [Bug 报告模板](issues/new?template=bug_report.yml) 创建 Issue。一个高质量的 Bug 报告应包含：

1. **问题描述**：发生了什么，与预期有何不同。
2. **复现步骤**：用编号列表一步步说明如何稳定复现。
3. **环境信息**：操作系统、Node.js 版本、Jeak Agent 版本。
4. **日志 / 截图**：终端报错信息或界面截图（打码敏感内容）。

> 提交前请先搜索 [已有 Issues](issues)，避免重复。若问题涉及安全漏洞，请勿公开披露，直接联系维护者。

## 提出新功能建议

如果你有好的想法，请使用 [功能建议模板](issues/new?template=feature_request.yml) 创建 Issue。建议包含：

- **背景与动机**：这个功能解决什么实际问题？描述具体使用场景。
- **功能描述**：期望的行为或交互。
- **备选方案**：你考虑过的其他实现路径。

维护者会评估建议并打上相应标签。如果你计划亲自实现它，也请在 Issue 中说明，以便讨论方案和避免重复劳动。

## 开发环境搭建

### 前置要求

- **Node.js ≥ 18**（推荐 20 / 22 LTS，CI 使用 Node 22）
- **npm**（项目使用 npm 管理依赖，已提交 `package-lock.json`）

### 技术栈

Electron + React + TypeScript + Monaco Editor + Zustand + electron-store，构建基于 electron-vite 与 electron-builder。

### 步骤

```bash
# 1. Fork 仓库（见下文 PR 流程），然后克隆你的 Fork
git clone https://github.com/<你的用户名>/Jeak-Agent.git
cd Jeak-Agent

# 2. 安装依赖
npm install

# 3. 启动开发模式（Electron 窗口 + Vite HMR）
npm run dev
```

### 常用命令

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 启动开发模式（热更新） |
| `npm run typecheck` | 运行 TypeScript 类型检查 |
| `npm run test` | 运行全部测试并输出覆盖率报告 |
| `npm run test:watch` | 监听模式下运行测试 |
| `npm run lint` | 运行 ESLint 检查 |
| `npm run lint:fix` | 自动修复可修复的 lint 问题 |
| `npm run format` | 使用 Prettier 格式化代码 |
| `npm run format:check` | 检查代码格式是否符合规范 |
| `npm run build:win` | 构建 Windows 安装包（`build:mac` / `build:linux` 同理） |

## 代码风格规范

项目使用 **ESLint**（flat config，`eslint.config.mjs`）做静态检查，**Prettier**（`.prettierrc`）统一格式。

### 基础约定

- 使用 TypeScript，优先使用 `const` / `let`，避免 `var`。
- 缩进 2 空格，单引号，行尾不加分号（由 Prettier 统一处理）。
- 命名：组件与类用 `PascalCase`，函数与变量用 `camelCase`，常量用 `UPPER_SNAKE_CASE`。
- 中文注释与文档使用简体中文，代码标识符使用英文。

### 提交前请执行

```bash
# 修复可自动修复的 lint 问题
npm run lint:fix

# 统一格式化
npm run format

# 最后确认无残留问题
npm run lint
npm run format:check
```

> CI 不强制 lint 通过，但请确保你改动的文件不引入新的 lint / 格式问题。PR 模板中的检查清单会提醒你执行上述命令。

## 提交信息规范

项目遵循 [约定式提交（Conventional Commits）](https://www.conventionalcommits.org/zh-hans/)。提交信息格式为：

```
<type>(<scope>): <subject>
```

### type 类型

| type | 说明 |
| --- | --- |
| `feat` | 新功能 |
| `fix` | 修复 Bug |
| `docs` | 文档变更 |
| `style` | 代码风格（不影响逻辑，如格式化、缺失分号） |
| `refactor` | 重构（不改变外部行为） |
| `perf` | 性能优化 |
| `test` | 新增或修改测试 |
| `chore` | 构建、依赖、工具等杂项 |

### 示例

```bash
feat(marketplace): 支持从 GitHub 安装插件并桥接 skills
fix(loader): 修复 manifest 校验时未拒绝路径穿越
docs: 补充插件开发指南中的权限说明
test(aiservice): 覆盖工具调用失败分支
```

> `scope` 可选，用于标注影响模块。一个提交只做一件事，保持信息简短（首行不超过 72 字符）。

## 提交 PR 流程

1. **Fork**：点击仓库右上角 `Fork`，创建你自己的副本。
2. **克隆**：将你的 Fork 克隆到本地，并添加上游仓库：
   ```bash
   git clone https://github.com/<你的用户名>/Jeak-Agent.git
   cd Jeak-Agent
   git remote add upstream https://github.com/<原仓库>/Jeak-Agent.git
   ```
3. **创建分支**：从最新的 `main` 切出一个功能分支：
   ```bash
   git checkout main
   git pull upstream main
   git checkout -b feat/my-feature
   ```
4. **开发**：完成改动，遵循 [代码风格规范](#代码风格规范) 与 [测试要求](#测试要求)。
5. **提交**：按 [提交信息规范](#提交信息规范) 提交，保持提交历史清晰。
6. **推送**：将分支推送到你的 Fork：
   ```bash
   git push origin feat/my-feature
   ```
7. **发起 PR**：在 GitHub 上打开 Pull Request，按 PR 模板填写说明。关联相关 Issue（如 `Closes #123`）。
8. **等待 CI**：推送后 GitHub Actions 会自动运行测试（`.github/workflows/test.yml`），请确保全部通过。
9. **响应评审**：维护者会进行 Code Review，请及时回复并修改，直至合并。

> 小贴士：提交前先 `git rebase upstream/main` 保持分支最新，避免合并冲突。一个 PR 聚焦一个主题，避免堆叠无关改动。

## 测试要求

- 测试使用 [Vitest](https://vitest.dev/)，测试文件放在 `src/__tests__/` 目录下，命名规范为 `*.test.ts`。
- **新功能必须包含测试**，Bug 修复建议补充能复现该 Bug 的回归测试。
- 外部依赖（如 GitHub API、网络请求）使用 Mock 模拟，参考 `src/__tests__/plugins/marketplace-importer.test.ts` 的做法。
- 提交前运行 `npm run test`，确保全部通过且覆盖率不下降。

## 为 Awesome Copilot 市场贡献插件

Jeak Agent 的插件市场对接社区仓库 [github/awesome-copilot](https://github.com/github/awesome-copilot)（`main` 分支）。市场列表、插件安装与桥接均基于该仓库。

若想贡献一个插件，请：

1. **阅读官方指南**：前往 [github/awesome-copilot](https://github.com/github/awesome-copilot) 查看其 README 与贡献说明，了解收录标准与目录约定。
2. **了解插件结构**：参考本项目 [插件开发指南](docs/plugin-development.md)，插件目录包含：
   - `plugin.json` — 插件清单（名称、版本、权限、skills 声明等）
   - `mcp.json` — MCP 服务器配置（可选）
   - `skills/<技能名>/SKILL.md` — 技能定义
3. **提交插件**：将插件放入市场仓库的 `plugins/<插件名>/` 目录，按该仓库的流程发起 PR。

> 贡献插件前，请先在本地用 Jeak Agent 完整验证插件的加载、权限与功能，确保可正常工作。

---

再次感谢你的贡献！如有疑问，欢迎通过 Issue 与我们交流。
