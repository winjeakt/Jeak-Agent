import { installFromGitHub, removeBridgeEntry, loadBridgedSkills, readBridgeIndex } from './src/plugins/marketplace/marketplace-importer.ts'
import { homedir } from 'os'
import { join } from 'path'
import { rmSync, existsSync, readdirSync } from 'fs'

const pluginsRoot = join(homedir(), '.jeak', 'plugins')

function countSkillMd(dir: string): { count: number; paths: string[] } {
  let count = 0
  const paths: string[] = []
  let entries
  try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return { count, paths } }
  for (const e of entries) {
    const full = join(dir, e.name)
    if (e.isDirectory()) {
      const sub = countSkillMd(full)
      count += sub.count
      paths.push(...sub.paths)
    } else if (e.isFile() && e.name.toLowerCase() === 'skill.md') {
      count++
      paths.push(full)
    }
  }
  return { count, paths }
}

console.log('========== [1] 卸载 awesome-copilot ==========')
const oldDir = join(pluginsRoot, 'awesome-copilot')
if (existsSync(oldDir)) {
  rmSync(oldDir, { recursive: true, force: true })
  console.log('已删除目录: awesome-copilot')
} else {
  console.log('awesome-copilot 目录不存在（可能已卸载）')
}
removeBridgeEntry(pluginsRoot, 'awesome-copilot')
console.log('已删除索引条目: awesome-copilot')

console.log('\n========== [2] 安装 apify ==========')
const url = 'https://github.com/apify/apify-github-copilot-plugin/tree/main/apify'
console.log('安装 URL:', url)
const name = await installFromGitHub(url, pluginsRoot)
console.log('安装成功，返回插件名:', name)

console.log('\n========== [3] 目录结构 & SKILL.md ==========')
const apifyDir = join(pluginsRoot, 'apify')
const stats = countSkillMd(apifyDir)
console.log('插件目录:', apifyDir)
console.log('plugin.json 存在:', existsSync(join(apifyDir, 'plugin.json')))
console.log('SKILL.md 数量:', stats.count)
for (const p of stats.paths) console.log('   -', p.replace(apifyDir, '').replace(/\\/g, '/'))

console.log('\n========== [4] .jeak-index.json 中 apify 条目 ==========')
const index = readBridgeIndex(pluginsRoot)
const entry = index.plugins['apify']
if (entry) {
  console.log('source:', entry.source)
  console.log('installedAt:', entry.installedAt)
  console.log('skillFiles 数量:', entry.skillFiles.length)
  for (const f of entry.skillFiles) console.log('   -', f)
} else {
  console.log('(未找到 apify 条目)')
}

console.log('\n========== [5] loadBridgedSkills("apify") ==========')
const skills = loadBridgedSkills(pluginsRoot, 'apify')
console.log('桥接 skills 数量:', skills.length)
for (const s of skills) {
  console.log('   - name:', s.name)
  console.log('     description:', s.description.slice(0, 60))
}

console.log('\n========== 端到端验证完成 ==========')
