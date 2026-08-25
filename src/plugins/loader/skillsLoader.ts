import { existsSync, readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import type { SkillInfo } from '../../shared/types'

/** 扫描 skills/ 下每个含 SKILL.md 的直接子目录（Agent Plugins 1.0） */
export function loadSkills(dir: string): SkillInfo[] {
  const skillsRoot = join(dir, 'skills')
  if (!existsSync(skillsRoot)) return []

  let entries: string[]
  try {
    entries = readdirSync(skillsRoot)
  } catch {
    return []
  }

  const skills: SkillInfo[] = []
  for (const entry of entries) {
    if (entry.startsWith('.')) continue
    const skillDir = join(skillsRoot, entry)
    try {
      if (!statSync(skillDir).isDirectory()) continue
    } catch {
      continue
    }
    const skillMd = join(skillDir, 'SKILL.md')
    if (!existsSync(skillMd)) continue
    try {
      skills.push(parseSkill(entry, skillDir, readFileSync(skillMd, 'utf-8')))
    } catch {
      // 单个 skill 失败不阻塞其余
    }
  }
  return skills
}

function parseSkill(fallbackName: string, dir: string, raw: string): SkillInfo {
  const { frontmatter, body } = splitFrontmatter(raw)
  const name =
    typeof frontmatter.name === 'string' && frontmatter.name.trim()
      ? frontmatter.name.trim()
      : fallbackName
  const description = typeof frontmatter.description === 'string' ? frontmatter.description : ''
  return { name, description, path: dir, body }
}

/** 极简 YAML frontmatter 解析：仅提取 name / description 顶层标量 */
function splitFrontmatter(raw: string): { frontmatter: Record<string, string>; body: string } {
  const m = raw.match(/^\uFEFF?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/)
  if (!m) return { frontmatter: {}, body: raw }

  const frontmatter: Record<string, string> = {}
  let blockKey: 'name' | 'description' | null = null
  let blockIndent = 0
  let blockLines: string[] = []
  const flushBlock = (): void => {
    if (blockKey) frontmatter[blockKey] = blockLines.join(' ').trim()
    blockKey = null
    blockLines = []
  }

  for (const line of m[1].split(/\r?\n/)) {
    const trimmed = line.trim()
    if (trimmed === '') {
      flushBlock()
      continue
    }
    const indent = line.match(/^[ \t]*/)?.[0].length ?? 0

    // YAML 块标量续行（description: >- 后的缩进行）
    if (blockKey !== null && indent > blockIndent) {
      blockLines.push(trimmed)
      continue
    }
    flushBlock()

    const idx = line.indexOf(':')
    if (idx <= 0) continue
    const key = line.slice(0, idx).trim()
    if (key !== 'name' && key !== 'description') continue
    let val = line.slice(idx + 1).trim()

    if (val === '>-' || val === '|-' || val === '>' || val === '|') {
      blockKey = key
      blockIndent = indent
      blockLines = []
      continue
    }

    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    frontmatter[key] = val
  }
  flushBlock()

  return { frontmatter, body: raw.slice(m[0].length) }
}
