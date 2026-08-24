# eslint-integration

对当前文件运行 ESLint，在编辑器底部问题面板展示错误与警告列表。

## 功能

- 点击「▶ 检查当前文件」对当前打开的文件执行 ESLint
- 结果以结构化诊断展示：Monaco Markers（行内波浪线）+ 底部问题面板
- 每条问题含：严重级别、消息、行号/列号、规则 ID

## 权限

| 权限 | 用途 |
|---|---|
| `lint:run` | 主进程执行 ESLint |
| `editor:get` | 读取当前文件路径 |
| `editor:apply` | 展示问题列表到编辑器 |

## 依赖

需要目标项目已安装 ESLint：

```bash
npm install --save-dev eslint
```

主进程会优先使用项目本地 `node_modules/.bin/eslint`，否则回退全局 `eslint`。

## 安装

```bash
cp -r eslint-integration ~/.jeak/plugins/
```

## 安全说明

ESLint 由主进程在受限工作目录内执行（路径白名单 + 输出上限 + 超时），
插件自身无法运行任意命令或访问系统。
