/**
 * demo-tools 插件（Agent Plugins 1.0）
 *
 * 演示「命令 → AI → MCP 工具」的端到端调用：
 *   - demo-tools.hello        打印欢迎语
 *   - demo-tools.call-echo    触发一次 AI 对话，AI 自动调用 MCP echo 工具
 *
 * MCP 工具（server.js 提供）会被主进程统一暴露给 AI（function calling），
 * 详见 mcp.json 与 skills/demo/SKILL.md。
 *
 * 安装：复制本目录到 ~/.jeak/plugins/demo-tools/ 后重启应用。
 */
;(function () {
  'use strict'

  var handlers = {}

  handlers['demo-tools.hello'] = function () {
    window.pluginAPI.log('info', '你好！我是 demo-tools 示例插件，已成功加载。')
  }

  handlers['demo-tools.call-echo'] = async function () {
    window.pluginAPI.log('info', '正在通过 AI 调用 MCP echo 工具…')
    var reply = await window.pluginAPI.ai.chat({
      id: 'demo-echo-' + Date.now(),
      messages: [
        {
          role: 'system',
          content:
            '你是一个演示助手。请调用 echo 工具，回显文本 "Hello from demo-tools plugin!"，' +
            '然后把工具返回的内容原样告诉我。'
        },
        { role: 'user', content: '请回显文本 Hello from demo-tools plugin!' }
      ],
      model: 'deepseek-chat'
    })
    window.pluginAPI.log('info', 'AI 回复：\n' + (reply || '').trim())
  }

  window.pluginAPI.registerCommand('demo-tools.hello', '演示：打招呼')
  window.pluginAPI.registerCommand('demo-tools.call-echo', '演示：AI 调用 MCP echo 工具')

  window.pluginAPI.onCommand(function (command) {
    var handler = handlers[command]
    if (handler) {
      void handler()
    } else {
      window.pluginAPI.log('warn', '未找到命令处理器: ' + command)
    }
  })

  window.pluginAPI.log('info', 'demo-tools 插件已加载')
})()
