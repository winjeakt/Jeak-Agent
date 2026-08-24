# code-formatter

调用 Prettier 格式化编辑器中的选中代码。

## 功能

- 在编辑器中选中一段代码，点击插件管理面板的「▶ 格式化选中代码」
- JSON 精确按 2 空格重排；其他文本清理行尾空格与多余空行

## 权限

| 权限 | 用途 |
|---|---|
| `editor:get` | 读取编辑器选中内容 |
| `editor:apply` | 用格式化结果替换选区 |
| `fs:read` / `fs:write` | 预留：未来读写 `.prettierrc` 配置 |
| `lint:run` | 预留：未来复用主进程工具链探测 Prettier |

## 安装

```bash
cp -r code-formatter ~/.jeak/plugins/
```

重启应用后，在「设置 → 插件管理」启用并点击运行。

## 安全说明

插件运行在 Electron 沙箱内（`sandbox: true` + `contextIsolation: true`），
仅能通过 `window.pluginAPI` 使用声明过的受限权限，无法访问 Node.js 或系统 API。
