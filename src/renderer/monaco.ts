import * as monaco from 'monaco-editor'
import { loader } from '@monaco-editor/react'
import editorWorker from 'monaco-editor/editor/editor.worker.js?worker'
import jsonWorker from 'monaco-editor/language/json/json.worker.js?worker'
import cssWorker from 'monaco-editor/language/css/css.worker.js?worker'
import htmlWorker from 'monaco-editor/language/html/html.worker.js?worker'
import tsWorker from 'monaco-editor/language/typescript/ts.worker.js?worker'
import type { EditorLanguage } from '@shared/types'
import { registerLuaLanguage } from './lua'
import { registerCppLanguage } from './cpp'

/**
 * Monaco 本地化配置：
 * - 使用本地打包的 monaco-editor（不依赖 CDN）
 * - 为各语言配置本地 worker（语法高亮 / 智能提示依赖这些 worker）
 */
self.MonacoEnvironment = {
  getWorker(_workerId: string, label: string): Worker {
    switch (label) {
      case 'json':
        return new jsonWorker()
      case 'css':
      case 'scss':
      case 'less':
        return new cssWorker()
      case 'html':
      case 'handlebars':
      case 'razor':
        return new htmlWorker()
      case 'typescript':
      case 'javascript':
        return new tsWorker()
      default:
        return new editorWorker()
    }
  }
}

// ===== 配色常量 =====
// CodeBuddy 品牌强调色：紫（用于光标、选区、滚动条等 UI 强调）
const PURPLE = '#6C4DFF'
const PURPLE_SOFT = '#A78BFA'

// One Dark Pro 语义配色（深色）
const OD = {
  comment: '#7F848E', // 灰：注释
  keyword: '#C678DD', // 紫：关键字
  string: '#98C379', // 绿：字符串
  number: '#D19A66', // 橙：数字
  constant: '#D19A66', // 橙：常量 / 布尔
  func: '#61AFEF', // 蓝：函数
  type: '#E5C07B', // 黄：类型 / 类 / 接口 / 枚举
  variable: '#E06C75', // 红：变量
  property: '#E06C75', // 红：属性 / JSON key
  operator: '#56B6C2', // 青：运算符
  tag: '#E06C75', // 红：HTML/JSX 标签
  attribute: '#D19A66', // 橙：属性名
  delimiter: '#ABB2BF', // 分隔符
  builtin: '#56B6C2', // 青：Lua 内置函数 / 标准库
  builtinWow: '#E5C07B' // 黄：魔兽世界 API
}

// One Light 语义配色（亮色）
const OL = {
  comment: '#A0A1A7',
  keyword: '#A626A4',
  string: '#50A14F',
  number: '#986801',
  constant: '#986801',
  func: '#4078F2',
  type: '#C18401',
  variable: '#E45649',
  property: '#E45649',
  operator: '#0184BC',
  tag: '#E45649',
  attribute: '#986801',
  delimiter: '#383A42',
  builtin: '#0184BC',
  builtinWow: '#C18401'
}

// 通用 token 规则（暗色，One Dark Pro 风格）
const darkRules = [
  { token: 'comment', foreground: OD.comment, fontStyle: 'italic' },
  { token: 'comment.doc', foreground: OD.comment, fontStyle: 'italic' },
  { token: 'keyword', foreground: OD.keyword },
  { token: 'keyword.control', foreground: OD.keyword },
  { token: 'keyword.operator', foreground: OD.keyword },
  { token: 'constant', foreground: OD.constant },
  { token: 'keyword.constant', foreground: OD.constant },
  { token: 'string', foreground: OD.string },
  { token: 'string.escape', foreground: OD.operator },
  { token: 'regexp', foreground: OD.string },
  { token: 'number', foreground: OD.number },
  { token: 'type', foreground: OD.type },
  { token: 'type.identifier', foreground: OD.type },
  { token: 'class', foreground: OD.type },
  { token: 'interface', foreground: OD.type },
  { token: 'enum', foreground: OD.type },
  { token: 'namespace', foreground: OD.type },
  { token: 'function', foreground: OD.func },
  { token: 'variable', foreground: OD.variable },
  { token: 'variable.predefined', foreground: OD.variable },
  { token: 'property', foreground: OD.property },
  { token: 'tag', foreground: OD.tag },
  { token: 'metatag', foreground: OD.tag },
  { token: 'attribute.name', foreground: OD.attribute },
  { token: 'attribute.value', foreground: OD.string },
  { token: 'key', foreground: OD.property },
  { token: 'value', foreground: OD.string },
  { token: 'operator', foreground: OD.operator },
  { token: 'delimiter', foreground: OD.delimiter },
  { token: 'predefined', foreground: OD.builtin },
  { token: 'predefined.wow', foreground: OD.builtinWow }
]

// 通用 token 规则（亮色，One Light 风格）
const lightRules = [
  { token: 'comment', foreground: OL.comment, fontStyle: 'italic' },
  { token: 'comment.doc', foreground: OL.comment, fontStyle: 'italic' },
  { token: 'keyword', foreground: OL.keyword },
  { token: 'keyword.control', foreground: OL.keyword },
  { token: 'keyword.operator', foreground: OL.keyword },
  { token: 'constant', foreground: OL.constant },
  { token: 'keyword.constant', foreground: OL.constant },
  { token: 'string', foreground: OL.string },
  { token: 'string.escape', foreground: OL.operator },
  { token: 'regexp', foreground: OL.string },
  { token: 'number', foreground: OL.number },
  { token: 'type', foreground: OL.type },
  { token: 'type.identifier', foreground: OL.type },
  { token: 'class', foreground: OL.type },
  { token: 'interface', foreground: OL.type },
  { token: 'enum', foreground: OL.type },
  { token: 'namespace', foreground: OL.type },
  { token: 'function', foreground: OL.func },
  { token: 'variable', foreground: OL.variable },
  { token: 'variable.predefined', foreground: OL.variable },
  { token: 'property', foreground: OL.property },
  { token: 'tag', foreground: OL.tag },
  { token: 'metatag', foreground: OL.tag },
  { token: 'attribute.name', foreground: OL.attribute },
  { token: 'attribute.value', foreground: OL.string },
  { token: 'key', foreground: OL.property },
  { token: 'value', foreground: OL.string },
  { token: 'operator', foreground: OL.operator },
  { token: 'delimiter', foreground: OL.delimiter },
  { token: 'predefined', foreground: OL.builtin },
  { token: 'predefined.wow', foreground: OL.builtinWow }
]

// 括号配对着色（bracketPairColorization）的六色循环
const bracketColors = [
  '#61AFEF',
  '#C678DD',
  '#E5C07B',
  '#56B6C2',
  '#D19A66',
  '#E06C75'
]
const bracketColorsLight = [
  '#4078F2',
  '#A626A4',
  '#C18401',
  '#0184BC',
  '#986801',
  '#E45649'
]

monaco.editor.defineTheme('codebuddy-dark', {
  base: 'vs-dark',
  inherit: true,
  rules: darkRules,
  colors: {
    'editor.background': '#282C34',
    'editor.foreground': '#ABB2BF',
    'editorCursor.foreground': PURPLE,
    'editor.selectionBackground': '#6C4DFF40',
    'editor.inactiveSelectionBackground': '#6C4DFF20',
    'editor.lineHighlightBackground': '#2C313A',
    'editorLineNumber.foreground': '#5C6370',
    'editorLineNumber.activeForeground': '#ABB2BF',
    'editorIndentGuide.background1': '#3B4048',
    'editorIndentGuide.activeBackground1': PURPLE_SOFT,
    'editorBracketMatch.background': '#6C4DFF30',
    'editorBracketMatch.border': PURPLE,
    'editorBracketHighlightingForeground1': bracketColors[0],
    'editorBracketHighlightingForeground2': bracketColors[1],
    'editorBracketHighlightingForeground3': bracketColors[2],
    'editorBracketHighlightingForeground4': bracketColors[3],
    'editorBracketHighlightingForeground5': bracketColors[4],
    'editorBracketHighlightingForeground6': bracketColors[5],
    'editorGutter.background': '#282C34',
    'editorWidget.background': '#21252B',
    'editorWidget.border': '#3E4451',
    'editorSuggestWidget.background': '#21252B',
    'editorSuggestWidget.border': '#3E4451',
    'editorSuggestWidget.selectedBackground': '#6C4DFF40',
    'editorSuggestWidget.highlightForeground': PURPLE_SOFT,
    'scrollbarSlider.background': '#6C4DFF40',
    'scrollbarSlider.hoverBackground': '#6C4DFF60',
    'scrollbarSlider.activeBackground': '#6C4DFF80',
    'minimap.background': '#282C34'
  }
})

monaco.editor.defineTheme('codebuddy-light', {
  base: 'vs',
  inherit: true,
  rules: lightRules,
  colors: {
    'editor.background': '#FAFAFA',
    'editor.foreground': '#383A42',
    'editorCursor.foreground': PURPLE,
    'editor.selectionBackground': '#6C4DFF26',
    'editor.lineHighlightBackground': '#F2F0FF',
    'editorLineNumber.foreground': '#A0A1A7',
    'editorLineNumber.activeForeground': '#383A42',
    'editorIndentGuide.background1': '#E5E5E6',
    'editorIndentGuide.activeBackground1': PURPLE_SOFT,
    'editorBracketMatch.background': '#6C4DFF20',
    'editorBracketMatch.border': PURPLE,
    'editorBracketHighlightingForeground1': bracketColorsLight[0],
    'editorBracketHighlightingForeground2': bracketColorsLight[1],
    'editorBracketHighlightingForeground3': bracketColorsLight[2],
    'editorBracketHighlightingForeground4': bracketColorsLight[3],
    'editorBracketHighlightingForeground5': bracketColorsLight[4],
    'editorBracketHighlightingForeground6': bracketColorsLight[5],
    'editorGutter.background': '#FAFAFA'
  }
})

// 让 @monaco-editor/react 使用本地 monaco 实例而非 CDN
loader.config({ monaco })

// 增强 Lua 语法高亮（内置函数 / WoW API / 自定义函数分层着色）
registerLuaLanguage()

// 增强 C++ 语法高亮（STL 类型 / 自定义类型分层着色）
registerCppLanguage()

/**
 * 根据文件路径自动识别语言（利用 Monaco 内置的语言扩展名映射）。
 * 覆盖 Monaco 内置的全部语言（约 80 种），无需手动维护映射表。
 * @param path 文件路径
 * @returns 语言 id，未匹配时返回 'plaintext'
 */
export function detectLanguage(path: string | null | undefined): EditorLanguage {
  if (!path) return 'plaintext'
  const m = /\.([^.\\/]+)$/.exec(path)
  if (!m) return 'plaintext'
  const ext = '.' + m[1].toLowerCase()
  const langs = monaco.languages.getLanguages()
  const hit = langs.find((l) => l.extensions?.some((e) => e.toLowerCase() === ext))
  return (hit?.id as EditorLanguage) ?? 'plaintext'
}
