import { describe, expect, it } from 'vitest'
import {
  detectLanguage,
  extractExtension,
  matchLanguage
} from '../../shared/languageDetection'

const LANGS = [
  { id: 'typescript', extensions: ['.ts', '.tsx', '.mts'] },
  { id: 'javascript', extensions: ['.js', '.jsx'] },
  { id: 'python', extensions: ['.py'] },
  { id: 'lua', extensions: ['.lua'] },
  { id: 'cpp', extensions: ['.cpp', '.h'] }
]

describe('extractExtension', () => {
  it('提取扩展名并统一小写', () => {
    expect(extractExtension('src/main.ts')).toBe('.ts')
    expect(extractExtension('README.MD')).toBe('.md')
    expect(extractExtension('a/b/c.py')).toBe('.py')
  })

  it('取最后一个点之后的扩展名', () => {
    expect(extractExtension('foo.tar.gz')).toBe('.gz')
  })

  it('支持 Windows 反斜杠路径', () => {
    expect(extractExtension('C:\\Users\\dev\\main.ts')).toBe('.ts')
  })

  it('无扩展名返回 null', () => {
    expect(extractExtension('Makefile')).toBeNull()
    expect(extractExtension('src/foo')).toBeNull()
    expect(extractExtension('')).toBeNull()
  })

  it('空路径返回 null', () => {
    expect(extractExtension(null)).toBeNull()
    expect(extractExtension(undefined)).toBeNull()
  })
})

describe('matchLanguage', () => {
  it('按扩展名匹配（忽略大小写）', () => {
    expect(matchLanguage('.ts', LANGS)).toBe('typescript')
    expect(matchLanguage('.TS', LANGS)).toBe('typescript')
    expect(matchLanguage('.lua', LANGS)).toBe('lua')
  })

  it('未知扩展名返回 plaintext', () => {
    expect(matchLanguage('.unknown', LANGS)).toBe('plaintext')
  })

  it('空扩展名返回 plaintext', () => {
    expect(matchLanguage(null, LANGS)).toBe('plaintext')
  })
})

describe('detectLanguage', () => {
  it('根据路径识别语言', () => {
    expect(detectLanguage('src/app.ts', LANGS)).toBe('typescript')
    expect(detectLanguage('main.py', LANGS)).toBe('python')
    expect(detectLanguage('addon.lua', LANGS)).toBe('lua')
  })

  it('未知扩展名返回 plaintext', () => {
    expect(detectLanguage('README.md', LANGS)).toBe('plaintext')
  })

  it('无扩展名或无路径返回 plaintext', () => {
    expect(detectLanguage('Makefile', LANGS)).toBe('plaintext')
    expect(detectLanguage(null, LANGS)).toBe('plaintext')
    expect(detectLanguage(undefined, LANGS)).toBe('plaintext')
  })

  it('语言项缺少 extensions 字段时不误判', () => {
    expect(detectLanguage('x.ts', [{ id: 'foo' }])).toBe('plaintext')
  })
})
