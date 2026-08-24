/**
 * git-helper 插件（Agent Plugins 1.0）
 *
 * 功能：
 *   1. 查看工作区 / 暂存区 diff
 *   2. 基于暂存 diff 调用 AI 生成规范化 commit message
 *
 * diff 通过主进程 git API 获取（受限白名单命令），commit message 通过 AI API 生成。
 * 生成结果写入编辑器选区（或追加提示到日志）。
 *
 * 安装：复制到 ~/.jeak/plugins/git-helper/ 后重启应用。
 */
;(function () {
  'use strict'

  var handlers = {}

  /** 查看 diff：结果通过编辑器选区展示（或打印日志） */
  async function showDiff(scope) {
    var diff = await window.pluginAPI.git.diff({ scope: scope })
    if (!diff || !diff.trim()) {
      window.pluginAPI.log('warn', '没有检测到 ' + (scope === 'staged' ? '暂存区' : '工作区') + ' 变更')
      return
    }
    window.pluginAPI.log(
      'info',
      '[' + (scope === 'staged' ? '暂存区' : '工作区') + ' diff] ' + diff.length + ' 字符'
    )
    // 尝试把 diff 写入编辑器当前选区（若用户选中了位置）
    var state = await window.pluginAPI.editor.getState()
    if (state && state.selection && state.selection.text !== undefined) {
      try {
        await window.pluginAPI.editor.replaceSelection(diff.slice(0, 50000))
        return
      } catch (e) {
        /* 无选区或不可写则忽略 */
      }
    }
    window.pluginAPI.log('info', diff.slice(0, 2000))
  }

  handlers['git-helper.diff'] = function () {
    return showDiff('working')
  }

  handlers['git-helper.diff-staged'] = function () {
    return showDiff('staged')
  }

  handlers['git-helper.commit-message'] = async function () {
    // 1. 获取暂存区 diff（若为空则用工作区 diff）
    var diff = ''
    try {
      diff = await window.pluginAPI.git.diff({ scope: 'staged' })
    } catch (e) {
      /* ignore */
    }
    if (!diff || !diff.trim()) {
      try {
        diff = await window.pluginAPI.git.diff({ scope: 'working' })
      } catch (e) {
        /* ignore */
      }
    }
    if (!diff || !diff.trim()) {
      window.pluginAPI.log('warn', '没有可生成 commit message 的变更，请先 git add 或修改文件')
      return
    }

    // 2. 获取当前分支名（受限 git:run）
    var branch = ''
    try {
      branch = await window.pluginAPI.git.run({ args: ['rev-parse', '--abbrev-ref', 'HEAD'] })
    } catch (e) {
      /* ignore */
    }

    // 3. 调用 AI 生成 commit message（Conventional Commits 规范）
    var systemPrompt =
      '你是 Git 提交信息生成器。根据提供的 diff 生成一条符合 Conventional Commits 规范的中文 commit message，' +
      '格式：<type>(<scope>): <subject>，然后可选 body。只输出 commit message 本身，不要任何解释或代码块标记。'
    var userPrompt = '分支：' + (branch ? branch.trim() : 'unknown') + '\n\ndiff 如下：\n' + diff.slice(0, 8000)

    window.pluginAPI.log('info', '正在生成 commit message…')
    var message = await window.pluginAPI.ai.chat({
      id: 'git-helper-commit-' + Date.now(),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      model: 'deepseek-chat'
    })

    if (!message || !message.trim()) {
      window.pluginAPI.log('error', 'AI 未返回 commit message')
      return
    }

    window.pluginAPI.log('info', '生成的 commit message：\n' + message.trim())

    // 4. 尝试写入编辑器选区
    var state = await window.pluginAPI.editor.getState()
    if (state && state.selection && state.selection.text !== undefined) {
      try {
        await window.pluginAPI.editor.replaceSelection(message.trim())
      } catch (e) {
        /* ignore */
      }
    }
  }

  // 上报命令
  window.pluginAPI.registerCommand('git-helper.diff', '查看工作区 diff')
  window.pluginAPI.registerCommand('git-helper.diff-staged', '查看暂存区 diff')
  window.pluginAPI.registerCommand('git-helper.commit-message', '生成 commit message')

  // 命令分发
  window.pluginAPI.onCommand(function (command) {
    var handler = handlers[command]
    if (handler) {
      void handler()
    } else {
      window.pluginAPI.log('warn', '未找到命令处理器: ' + command)
    }
  })

  window.pluginAPI.log('info', 'git-helper 插件已加载')
})()
