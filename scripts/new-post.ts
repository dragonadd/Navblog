// 新建文章：pnpm run new "文章标题" [slug]
import fs from 'node:fs'
import path from 'node:path'
import { PATHS } from './lib'
import { slugify, stringifyPost } from '../src/shared/frontmatter'

const title = process.argv[2]
if (!title) {
  console.log('用法: pnpm run new "文章标题" [slug]')
  process.exit(1)
}
const slug = slugify(process.argv[3] || title)
const file = path.join(PATHS.postsDir, `${slug}.md`)
if (fs.existsSync(file)) {
  console.error(`文件已存在: ${file}`)
  process.exit(1)
}
const d = new Date()
const p = (n: number) => String(n).padStart(2, '0')
const date = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
fs.mkdirSync(PATHS.postsDir, { recursive: true })
fs.writeFileSync(file, stringifyPost({ slug, title, date, tags: [] }, '在这里开始写作…\n'))
console.log(`已创建: ${path.relative(process.cwd(), file)}`)
