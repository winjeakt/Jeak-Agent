import * as monaco from 'monaco-editor'

/**
 * Lua 语法高亮增强。
 *
 * Monaco 内置的 Lua tokenizer 把所有标识符统一标记为 `identifier`，
 * 导致 Lua 内置函数（print、string、table、math 等）和用户自定义函数
 * 都只显示默认前景色，缺乏专业编辑器的层次感。
 *
 * 本模块通过 `setMonarchTokensProvider` 覆盖内置 Lua tokenizer，
 * 在不破坏原有注释/字符串/数字规则的前提下，为标识符增加分层：
 *
 * - Lua 内置函数 / 标准库        -> `predefined`        -> 青色
 * - 魔兽世界 API（战斗脚本常用） -> `predefined.wow`    -> 黄色
 * - 用户自定义函数（可配置）      -> `function.custom`   -> 蓝色
 * - 函数定义名（function foo）    -> `function.name`     -> 蓝色
 *
 * 颜色在 src/renderer/monaco.ts 的 codebuddy-dark / codebuddy-light 主题中定义。
 */

/** Lua 内置函数与标准库（可按需扩展） */
const LUA_BUILTINS = [
  // 全局函数
  'print', 'type', 'tostring', 'tonumber', 'pcall', 'xpcall', 'require',
  'assert', 'error', 'select', 'next', 'ipairs', 'pairs', 'rawequal',
  'rawget', 'rawset', 'rawlen', 'setmetatable', 'getmetatable',
  'load', 'loadstring', 'loadfile', 'dofile', 'collectgarbage',
  // 标准库名
  'string', 'table', 'math', 'os', 'io', 'debug', 'coroutine', 'utf8',
  // 字符串库
  'format', 'gsub', 'gmatch', 'match', 'find', 'sub', 'upper', 'lower',
  'rep', 'reverse', 'len', 'byte', 'char',
  // 表库
  'insert', 'remove', 'sort', 'concat', 'unpack', 'pack', 'move',
  // 数学库
  'abs', 'ceil', 'floor', 'max', 'min', 'sqrt', 'random', 'randomseed',
  'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'pi', 'huge', 'fmod', 'tointeger',
  // os 库
  'time', 'clock', 'date', 'difftime', 'getenv', 'exit',
  // io 库
  'open', 'close', 'read', 'write', 'lines', 'flush',
  // coroutine 库
  'create', 'resume', 'yield', 'wrap', 'status', 'running',
]

/** 魔兽世界 API（战斗脚本 / WeakAuras 常用，可按需扩展） */
const WOW_API = [
  // 单位信息
  'UnitHealth', 'UnitHealthMax', 'UnitMana', 'UnitManaMax', 'UnitPower',
  'UnitPowerMax', 'UnitPowerType', 'UnitExists', 'UnitName', 'UnitGUID',
  'UnitClass', 'UnitLevel', 'UnitIsUnit', 'UnitIsDead', 'UnitIsDeadOrGhost',
  'UnitIsEnemy', 'UnitIsFriend', 'UnitCanAttack', 'UnitInRange',
  'UnitCastingInfo', 'UnitChannelInfo', 'UnitBuff', 'UnitDebuff', 'UnitAura',
  // 施法
  'CastSpellByName', 'CastSpellByID', 'SpellStopCasting', 'SpellTargetUnit',
  // 法术信息
  'GetSpellInfo', 'GetSpellCooldown', 'GetSpellCharges', 'IsSpellUsable',
  'IsSpellInRange', 'GetSpellLink', 'GetSpellTexture', 'GetSpellCount',
  // 时间 / 玩家
  'GetTime', 'GetServerTime', 'GetItemCooldown', 'GetInventoryItemCooldown',
  'GetItemCount', 'GetTalentInfo', 'GetSpecialization', 'GetActiveSpecGroup',
  // WoW 环境常用 table 辅助
  'wipe', 'tinsert', 'tremove', 'tsort',
]

/** 用户自定义函数（示例：WeakAuras APL 中的冷却/技能封装，可自行增删） */
const CUSTOM_FUNCTIONS = [
  'cd', 'Rupture',
]

/** 增强版 Lua monarch tokenizer（在 Monaco 内置基础上扩展标识符分层） */
const luaLanguage: monaco.languages.IMonarchLanguage = {
  defaultToken: '',
  tokenPostfix: '.lua',
  keywords: [
    'and', 'break', 'do', 'else', 'elseif', 'end', 'false', 'for', 'function',
    'goto', 'if', 'in', 'local', 'nil', 'not', 'or', 'repeat', 'return',
    'then', 'true', 'until', 'while',
  ],
  builtins: LUA_BUILTINS,
  wowapi: WOW_API,
  customFunctions: CUSTOM_FUNCTIONS,
  brackets: [
    { token: 'delimiter.bracket', open: '{', close: '}' },
    { token: 'delimiter.array', open: '[', close: ']' },
    { token: 'delimiter.parenthesis', open: '(', close: ')' },
  ],
  operators: [
    '+', '-', '*', '/', '%', '^', '#', '==', '~=', '<=', '>=', '<', '>',
    '=', ';', ':', ',', '.', '..', '...',
  ],
  symbols: /[=><!~?:&|+\-*\/\^%]+/,
  escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,
  tokenizer: {
    root: [
      // 函数定义名：function foo / local function foo -> foo 高亮为 function.name
      [/(function)\s+([a-zA-Z_]\w*)/, ['keyword', 'function.name']],
      // 标识符分层：关键字 > 内置函数 > WoW API > 自定义函数 > 普通标识符
      [
        /[a-zA-Z_]\w*/,
        {
          cases: {
            '@keywords': 'keyword',
            '@builtins': 'predefined',
            '@wowapi': 'predefined.wow',
            '@customFunctions': 'function.custom',
            '@default': 'identifier',
          },
        },
      ],
      { include: '@whitespace' },
      // 分隔符与运算符
      [/[{}()[\]]/, '@brackets'],
      [
        /@symbols/,
        {
          cases: {
            '@operators': 'delimiter',
            '@default': '',
          },
        },
      ],
      // 数字
      [/\d*\.\d+([eE][\-+]?\d+)?/, 'number.float'],
      [/0[xX][0-9a-fA-F_]*[0-9a-fA-F]/, 'number.hex'],
      [/\d+?/, 'number'],
      // 分隔符（在数字之后，避免 .\d 浮点数被误判）
      [/[;,.]/, 'delimiter'],
      // 未闭合字符串
      [/"([^"\\]|\\.)*$/, 'string.invalid'],
      [/'([^'\\]|\\.)*$/, 'string.invalid'],
      // 字符串
      [/"/, 'string', '@string."'],
      [/'/, 'string', "@string.'"],
    ],
    whitespace: [
      [/[ \t\r\n]+/, ''],
      [/--\[([=]*)\[/, 'comment', '@comment.$1'],
      [/--.*$/, 'comment'],
    ],
    comment: [
      [/[^\]]+/, 'comment'],
      [
        /\]([=]*)\]/,
        {
          cases: {
            '$1==$S2': { token: 'comment', next: '@pop' },
            '@default': 'comment',
          },
        },
      ],
      [/./, 'comment'],
    ],
    string: [
      [/[^\\"']+/, 'string'],
      [/@escapes/, 'string.escape'],
      [/\\./, 'string.escape.invalid'],
      [
        /["']/,
        {
          cases: {
            '$#==$S2': { token: 'string', next: '@pop' },
            '@default': 'string',
          },
        },
      ],
    ],
  },
}

/**
 * 注册增强版 Lua tokenizer（幂等，重复调用会覆盖）。
 *
 * 内置 Lua 通过 `registerTokensProviderFactory` 以懒加载方式注册 tokenizer，
 * 而 `setMonarchTokensProvider` 会覆盖该 factory，因此后续打开 .lua 文件时
 * 一律使用本增强 tokenizer，内置的懒加载 tokenizer 不会再生效。
 */
export function registerLuaLanguage(): void {
  monaco.languages.setMonarchTokensProvider('lua', luaLanguage)
}
