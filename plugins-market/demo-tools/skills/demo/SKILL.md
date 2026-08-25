---
name: jeak-demo
description: 演示 Jeak-Agent 插件体系：调用 MCP 工具完成回显、数字计算、时间查询与目录列举。
---

# Jeak 演示技能

本技能演示 Jeak-Agent 的「插件 → MCP 工具 → AI 调用」闭环。可用工具：

1. `demo-tools__echo` — 回显一段文本
2. `demo-tools__add_numbers` — 计算两个数字之和（参数 a、b）
3. `demo-tools__get_current_time` — 获取当前本地时间
4. `demo-tools__list_directory` — 列出指定目录内容（参数 path）

## 使用指引

- 用户要求「回显 / 重复某句话」→ 调用 `demo-tools__echo`
- 用户要求「计算 / 相加」→ 调用 `demo-tools__add_numbers`
- 用户询问「现在几点 / 当前时间」→ 调用 `demo-tools__get_current_time`
- 用户要求「列出 / 查看目录」→ 调用 `demo-tools__list_directory`

调用后把工具返回结果直接呈现给用户。
