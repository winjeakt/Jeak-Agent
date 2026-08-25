import * as monaco from 'monaco-editor'

/**
 * C++ 语法高亮增强。
 *
 * Monaco 内置 cpp tokenizer 只有 keywords、没有 typeKeywords，
 * 导致 STL 容器（vector/string/map）与自定义类名都被当作普通 identifier，
 * 与变量无法区分。
 *
 * 本模块通过 setMonarchTokensProvider 覆盖内置 cpp tokenizer，
 * 在完整保留注释/字符串/数字/预处理器规则的基础上增加标识符分层：
 * - 基本类型 + STL 容器 + 标准库类型 -> `type`           -> 黄色
 * - 自定义类型（PascalCase 启发式）    -> `type.identifier` -> 黄色
 * - 关键字                            -> `keyword`        -> 紫色
 * - 运算符                            -> `operator`       -> 青色
 * - 其余标识符                        -> `identifier`     -> 默认前景色
 *
 * 颜色在 src/renderer/monaco.ts 的 codebuddy-dark / codebuddy-light 主题中定义。
 */

/** 类型关键字：基本类型、定宽整型、STL 容器、智能指针、流等 -> `type` */
const TYPE_KEYWORDS = [
  // 基本类型
  'void', 'bool', 'char', 'wchar_t', 'char8_t', 'char16_t', 'char32_t',
  'int', 'short', 'long', 'float', 'double', 'signed', 'unsigned',
  // 定宽整型
  'size_t', 'ssize_t', 'ptrdiff_t', 'intptr_t', 'uintptr_t',
  'int8_t', 'int16_t', 'int32_t', 'int64_t',
  'uint8_t', 'uint16_t', 'uint32_t', 'uint64_t',
  // 字符串
  'string', 'wstring', 'u16string', 'u32string', 'string_view',
  // 序列容器
  'vector', 'deque', 'list', 'forward_list', 'array',
  // 关联容器
  'map', 'multimap', 'set', 'multiset',
  'unordered_map', 'unordered_multimap', 'unordered_set', 'unordered_multiset',
  // 容器适配器
  'queue', 'priority_queue', 'stack',
  // 工具类型
  'pair', 'tuple', 'optional', 'variant', 'any',
  // 智能指针 / 函数对象
  'shared_ptr', 'unique_ptr', 'weak_ptr', 'function',
  // 流
  'istream', 'ostream', 'iostream', 'ifstream', 'ofstream', 'fstream',
  'istringstream', 'ostringstream', 'stringstream',
  'basic_string', 'basic_istream', 'basic_ostream',
  // 迭代器
  'iterator', 'const_iterator', 'reverse_iterator',
]

/** 增强版 C++ monarch tokenizer（覆盖内置实现） */
const cppLanguage: monaco.languages.IMonarchLanguage = {
  defaultToken: '',
  tokenPostfix: '.cpp',
  brackets: [
    { token: 'delimiter.curly', open: '{', close: '}' },
    { token: 'delimiter.parenthesis', open: '(', close: ')' },
    { token: 'delimiter.square', open: '[', close: ']' },
    { token: 'delimiter.angle', open: '<', close: '>' },
  ],
  typeKeywords: TYPE_KEYWORDS,
  keywords: [
    // 控制流
    'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'default', 'break', 'continue', 'goto', 'return',
    // 异常
    'try', 'catch', 'throw', 'noexcept',
    // 类 / 结构
    'class', 'struct', 'union', 'enum', 'public', 'private', 'protected',
    'virtual', 'override', 'final', 'friend', 'explicit',
    // 存储 / 修饰
    'const', 'constexpr', 'consteval', 'constinit', 'volatile', 'mutable',
    'static', 'extern', 'register', 'thread_local', 'inline',
    // 类型推导 / 模板 / 命名空间
    'auto', 'decltype', 'typeof', 'typename', 'template', 'concept', 'requires',
    'typedef', 'using', 'namespace', 'export',
    // 类型转换
    'static_cast', 'dynamic_cast', 'const_cast', 'reinterpret_cast',
    // 其他关键字
    'sizeof', 'alignas', 'alignof', 'typeid', 'new', 'delete', 'this', 'nullptr', 'operator', 'asm',
    // 协程
    'co_await', 'co_return', 'co_yield',
    // 字面量
    'true', 'false',
    // MSVC 扩展
    '__int8', '__int16', '__int32', '__int64', '__int128', '__asm', '__declspec',
    '__forceinline', '__restrict', '__stdcall', '__cdecl', '__fastcall',
    '__pragma', '__w64', '__uuidof', '__super', '__try', '__except', '__finally',
    '__leave', '__unaligned', '__alignof', '__typeof',
  ],
  operators: [
    '=', '>', '<', '!', '~', '?', ':', '==', '<=', '>=', '!=', '&&', '||',
    '++', '--', '+', '-', '*', '/', '&', '|', '^', '%', '<<', '>>',
    '+=', '-=', '*=', '/=', '&=', '|=', '^=', '%=', '<<=', '>>=',
  ],
  symbols: /[=><!~?:&|+\-*\/\^%]+/,
  escapes: /\\(?:[0abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,
  integersuffix: /([uU](ll|LL|l|L)|(ll|LL|l|L)?[uU]?)/,
  floatsuffix: /[fFlL]?/,
  encoding: /u|u8|U|L/,
  tokenizer: {
    root: [
      // C++11 原始字符串
      [/@encoding?R"(?:([^ ()\\\t]*))\(/, { token: 'string.raw.begin', next: '@raw.$1' }],
      // 自定义类型：PascalCase 标识符（首字母大写 + 次字母小写）
      [/[A-Z][a-z][a-zA-Z0-9_]*/, 'type.identifier'],
      // 标识符：类型 > 关键字 > 普通标识符
      [
        /[a-zA-Z_]\w*/,
        {
          cases: {
            '@typeKeywords': 'type',
            '@keywords': { token: 'keyword.$0' },
            '@default': 'identifier',
          },
        },
      ],
      // 预处理指令需在空白之前检查
      [/^\s*#\s*include/, { token: 'keyword.directive.include', next: '@include' }],
      [/^\s*#\s*\w+/, 'keyword.directive'],
      { include: '@whitespace' },
      // [[ 属性 ]]
      [/\[\s*\[/, { token: 'annotation', next: '@annotation' }],
      // 括号 / 分隔符
      [/[{}()<>\[\]]/, '@brackets'],
      // 运算符
      [
        /@symbols/,
        {
          cases: {
            '@operators': 'operator',
            '@default': '',
          },
        },
      ],
      // 数字
      [/\d*\d+[eE]([\-+]?\d+)?(@floatsuffix)/, 'number.float'],
      [/\d*\.\d+([eE][\-+]?\d+)?(@floatsuffix)/, 'number.float'],
      [/0[xX][0-9a-fA-F']*[0-9a-fA-F](@integersuffix)/, 'number.hex'],
      [/0[0-7']*[0-7](@integersuffix)/, 'number.octal'],
      [/0[bB][0-1']*[0-1](@integersuffix)/, 'number.binary'],
      [/\d[\d']*\d(@integersuffix)/, 'number'],
      [/\d(@integersuffix)/, 'number'],
      // 分隔符（在数字之后，避免 .\d 浮点数被误判）
      [/[;,.]/, 'delimiter'],
      // 字符串
      [/"([^"\\]|\\.)*$/, 'string.invalid'],
      [/"/, 'string', '@string'],
      [/'[^\\']'/, 'string'],
      [/(')(@escapes)(')/, ['string', 'string.escape', 'string']],
      [/'/, 'string.invalid'],
    ],
    whitespace: [
      [/[ \t\r\n]+/, ''],
      [/\/\*\*(?!\/)/, 'comment.doc', '@doccomment'],
      [/\/\*/, 'comment', '@comment'],
      [/\/\/.*\\$/, 'comment', '@linecomment'],
      [/\/\/.*$/, 'comment'],
    ],
    comment: [
      [/[^\/*]+/, 'comment'],
      [/\*\//, 'comment', '@pop'],
      [/[\/*]/, 'comment'],
    ],
    linecomment: [
      [/.*[^\\]$/, 'comment', '@pop'],
      [/[^]+/, 'comment'],
    ],
    doccomment: [
      [/[^\/*]+/, 'comment.doc'],
      [/\*\//, 'comment.doc', '@pop'],
      [/[\/*]/, 'comment.doc'],
    ],
    string: [
      [/[^\\"]+/, 'string'],
      [/@escapes/, 'string.escape'],
      [/\\./, 'string.escape.invalid'],
      [/"/, 'string', '@pop'],
    ],
    raw: [
      [/[^)]+/, 'string.raw'],
      [/\)$S2"/, { token: 'string.raw.end', next: '@pop' }],
      [/\)/, 'string.raw'],
    ],
    annotation: [
      { include: '@whitespace' },
      [/using|alignas/, 'keyword'],
      [/[a-zA-Z0-9_]+/, 'annotation'],
      [/[,:]/, 'delimiter'],
      [/[()]/, '@brackets'],
      [/\]\s*\]/, { token: 'annotation', next: '@pop' }],
    ],
    include: [
      [
        /(\s*)(<)([^<>]*)(>)/,
        [
          '',
          'keyword.directive.include.begin',
          'string.include.identifier',
          { token: 'keyword.directive.include.end', next: '@pop' },
        ],
      ],
      [
        /(\s*)(")([^"]*)(")/,
        [
          '',
          'keyword.directive.include.begin',
          'string.include.identifier',
          { token: 'keyword.directive.include.end', next: '@pop' },
        ],
      ],
    ],
  },
}

/**
 * 注册增强版 C++ tokenizer（幂等，重复调用会覆盖）。
 * 内置 cpp 通过 registerTokensProviderFactory 懒加载，setMonarchTokensProvider
 * 会覆盖该 factory，之后打开的 .cpp/.h 文件一律使用本增强 tokenizer。
 */
export function registerCppLanguage(): void {
  monaco.languages.setMonarchTokensProvider('cpp', cppLanguage)
}
