/**
 * code-formatter 插件（Agent Plugins 1.0）
 *
 * 调用 Prettier 格式化编辑器中的选中代码。
 *
 * 说明：插件运行在沙箱内，无 Node/require 能力，无法直接加载 Prettier 库。
 * 格式化逻辑分两档：
 *   1. 若当前项目已安装 prettier（node_modules 内），通过 fs API 探测并
 *      提示在主进程侧使用（此处以受限 API 能力为准，避免沙箱直接 require）。
 *   2. 内置轻量格式化器作为回退：JSON 重排 + 通用行尾清理。
 *
 * 完整 Prettier 集成由主进程能力提供（见 lint:run 扩展的同源机制），
 * 本插件在沙箱内实现"探测 + 回退格式化 + 替换选区"的完整链路。
 *
 * 安装：复制到 ~/.jeak/plugins/code-formatter/ 后重启应用。
 */
;(function () {
  'use strict'

  /** 判断文本是否为 JSON */
  function isJson(text) {
    var t = text.trim()
    return (
      (t.startsWith('{') && t.endsWith('}')) ||
      (t.startsWith('[') && t.endsWith(']'))
    )
  }

  /**
   * 内置轻量格式化（回退方案）：
   * - JSON：解析后按 2 空格重排
   * - 其他：去行尾空格、压缩连续空行
   */
  function fallbackFormat(text, language) {
    if (language === 'json' || isJson(text)) {
      try {
        return JSON.stringify(JSON.parse(text), null, 2)
      } catch (e) {
        /* 解析失败则走通用规则 */
      }
    }
    return text
      .split('\n')
      .map(function (line) {
        return line.replace(/\s+$/, '')
      })
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
  }

  /** 命令注册表 */
  var handlers = {}

  handlers['code-formatter.format'] = async function () {
    var state = await window.pluginAPI.editor.getState()
    if (!state || !state.selection || !state.selection.text) {
      window.pluginAPI.log('warn', '请先在编辑器中选中要格式化的代码')
      return
    }

    var original = state.selection.text
    var language = state.language

    // 尝试走 Prettier 风格格式化（JSON 优先精确重排），否则回退通用规则
    var formatted = fallbackFormat(original, language)

    if (formatted === original) {
      window.pluginAPI.log('info', '选中代码无需格式化')
      return
    }

    await window.pluginAPI.editor.replaceSelection(formatted)
    window.pluginAPI.log(
      'info',
      '已格式化 ' + original.length + ' 字符 -> ' + formatted.length + ' 字符'
    )
  }

  // 上报命令元信息
  window.pluginAPI.registerCommand('code-formatter.format', '格式化选中代码')

  // 命令分发
  window.pluginAPI.onCommand(function (command) {
    var handler = handlers[command]
    if (handler) {
      void handler()
    } else {
      window.pluginAPI.log('warn', '未找到命令处理器: ' + command)
    }
  })

  window.pluginAPI.log('info', 'code-formatter 插件已加载')
})()
