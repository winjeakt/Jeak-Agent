/**
 * 语言检测纯函数（与 Monaco 解耦，便于单元测试）。
 * renderer 侧传入 Monaco 的语言扩展名映射表，本模块只负责纯逻辑。
 */

/** 与 Monaco ILanguageExtensionPoint 兼容的最小语言描述符 */
export interface LanguageDescriptor {
  id: string
  extensions?: readonly string[]
}

/**
 * 从文件路径提取扩展名（统一小写、含点号）。
 * 取最后一个点之后的一段；无扩展名或路径为空时返回 null。
 */
export function extractExtension(path: string | null | undefined): string | null {
  if (!path) return null
  const m = /\.([^.\\/]+)$/.exec(path)
  if (!m) return null
  return '.' + m[1].toLowerCase()
}

/**
 * 根据扩展名在语言列表中匹配语言 id。
 * 未匹配时返回 'plaintext'。
 */
export function matchLanguage(
  ext: string | null,
  languages: readonly LanguageDescriptor[]
): string {
  if (!ext) return 'plaintext'
  const key = ext.toLowerCase()
  const hit = languages.find((l) =>
    l.extensions?.some((e) => e.toLowerCase() === key)
  )
  return hit?.id ?? 'plaintext'
}

/**
 * 语言检测：文件路径 → 语言 id。
 * 纯函数，语言列表由调用方提供（renderer 传 Monaco 的语言表）。
 */
export function detectLanguage(
  path: string | null | undefined,
  languages: readonly LanguageDescriptor[]
): string {
  return matchLanguage(extractExtension(path), languages)
}
