# git-helper

Git 助手：查看 diff、生成规范化的 commit message。

## 功能

| 命令 | 说明 |
|---|---|
| 查看工作区 diff | 获取 `git diff` 输出并展示 |
| 查看暂存区 diff | 获取 `git diff --cached` 输出并展示 |
| 生成 commit message | 基于暂存 diff（或工作区 diff）调用 AI 生成 Conventional Commits 规范的提交信息 |

## 权限

| 权限 | 用途 |
|---|---|
| `git:diff` | 读取工作区/暂存区 diff |
| `git:status` | 读取仓库状态 |
| `git:run` | 受限子命令（如 `rev-parse`） |
| `ai:chat` | 调用 AI 生成 commit message |
| `editor:get` / `editor:apply` | 展示结果到编辑器 |

## 安装

```bash
cp -r git-helper ~/.jeak/plugins/
```

需先配置 DeepSeek API Key（用于 commit message 生成）。

## 安全说明

git 命令由主进程以白名单 + 参数过滤方式执行（禁止任意命令注入），
插件仅能调用声明过的受限能力。
