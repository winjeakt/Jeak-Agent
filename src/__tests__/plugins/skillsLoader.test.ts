import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { loadSkills } from '../../plugins/loader/skillsLoader'

describe('loadSkills', () => {
  let dir: string
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'jeak-skills-'))
  })
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('无 skills 目录返回空数组', () => {
    expect(loadSkills(dir)).toEqual([])
  })

  it('解析 frontmatter 的 name/description/body', () => {
    mkdirSync(join(dir, 'skills', 'greet'), { recursive: true })
    writeFileSync(join(dir, 'skills', 'greet', 'SKILL.md'), '---\nname: 打招呼\ndescription: 问候用户\n---\n你好！')
    const skills = loadSkills(dir)
    expect(skills).toHaveLength(1)
    expect(skills[0].name).toBe('打招呼')
    expect(skills[0].description).toBe('问候用户')
    expect(skills[0].body).toBe('你好！')
    expect(skills[0].path).toBe(join(dir, 'skills', 'greet'))
  })

  it('缺少 name 时回退目录名', () => {
    mkdirSync(join(dir, 'skills', 'greet'), { recursive: true })
    writeFileSync(join(dir, 'skills', 'greet', 'SKILL.md'), '---\ndescription: d\n---\nbody')
    expect(loadSkills(dir)[0].name).toBe('greet')
  })

  it('无 frontmatter 时 body 为原文', () => {
    mkdirSync(join(dir, 'skills', 'greet'), { recursive: true })
    writeFileSync(join(dir, 'skills', 'greet', 'SKILL.md'), 'just body')
    const s = loadSkills(dir)[0]
    expect(s.body).toBe('just body')
    expect(s.name).toBe('greet')
  })

  it('无 SKILL.md 的目录被跳过', () => {
    mkdirSync(join(dir, 'skills', 'empty'), { recursive: true })
    expect(loadSkills(dir)).toEqual([])
  })

  it('隐藏目录与普通文件被跳过', () => {
    mkdirSync(join(dir, 'skills', '.hidden'), { recursive: true })
    writeFileSync(join(dir, 'skills', '.hidden', 'SKILL.md'), 'x')
    writeFileSync(join(dir, 'skills', 'plain.txt'), 'x')
    expect(loadSkills(dir)).toEqual([])
  })

  it('单个 skill 失败不阻塞其余', () => {
    mkdirSync(join(dir, 'skills', 'good'), { recursive: true })
    writeFileSync(join(dir, 'skills', 'good', 'SKILL.md'), '---\nname: good\n---\nok')
    // bad：SKILL.md 被做成目录，readFileSync 会抛错，应被跳过
    mkdirSync(join(dir, 'skills', 'bad', 'SKILL.md'), { recursive: true })
    expect(loadSkills(dir).map((s) => s.name)).toEqual(['good'])
  })

  it('块标量 description 解析为单行', () => {
    mkdirSync(join(dir, 'skills', 'multi'), { recursive: true })
    writeFileSync(
      join(dir, 'skills', 'multi', 'SKILL.md'),
      '---\nname: multi\ndescription: >-\n  line one\n  line two\n---\nbody'
    )
    expect(loadSkills(dir)[0].description).toBe('line one line two')
  })
})
