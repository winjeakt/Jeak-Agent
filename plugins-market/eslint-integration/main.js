/**
 * eslint-integration 插件（Agent Plugins 1.0）
 *
 * 对当前文件运行 ESLint，并将错误/警告列表展示到编辑器底部问题面板
 * （通过 editor.showDiagnostics -> 主进程 -> Monaco Markers）。
 *
 * ESLint 由主进程能力执行（本地 node_modules/.bin/eslint 或全局 eslint），
 * 插件仅声明 lint:run 权限并通过受限 API 调用，自身无法访问 Node/系统命令。
 *
 * 安装：复制到 ~/.jeak/plugins/eslint-integration/ 后重启应用。
 */
;(function () {
  'use strict'

  var handlers = {}

  handlers['eslint-integration.lint'] = async function () {
    // 1. 获取当前文件路径
    var state = await window.pluginAPI.editor.getState()
    if (!state || !state.path) {
      window.pluginAPI.log('warn', '请先打开一个文件再运行 ESLint 检查')
      return
    }

    window.pluginAPI.log('info', '正在检查: ' + state.path)

    // 2. 调用主进程 lint API
    var result
    try {
      result = await window.pluginAPI.lint.run({ filePath: state.path })
    } catch (e) {
      window.pluginAPI.log('error', 'ESLint 检查失败: ' + (e && e.message ? e.message : String(e)))
      return
    }

    var diagnostics = result.diagnostics || []
    var errors = diagnostics.filter(function (d) {
      return d.severity === 'error'
    }).length
    var warnings = diagnostics.filter(function (d) {
      return d.severity === 'warning'
    }).length

    window.pluginAPI.log(
      'info',
      '检查完成：' + errors + ' 个错误，' + warnings + ' 个警告'
    )

    // 3. 展示到编辑器底部问题面板
    if (diagnostics.length > 0) {
      await window.pluginAPI.editor.showDiagnostics(diagnostics)
    } else {
      await window.pluginAPI.editor.showDiagnostics([])
      window.pluginAPI.log('info', '未发现任何问题 ✓')
    }
  }

  // 上报命令
  window.pluginAPI.registerCommand('eslint-integration.lint', '检查当前文件')

  // 命令分发
  window.pluginAPI.onCommand(function (command) {
    var handler = handlers[command]
    if (handler) {
      void handler()
    } else {
      window.pluginAPI.log('warn', '未找到命令处理器: ' + command)
    }
  })

  window.pluginAPI.log('info', 'eslint-integration 插件已加载')
})()
