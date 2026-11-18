/** 验证隐藏文章的列表、搜索数据和静态产物，结束后恢复原站点。 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import { PATHS, ROOT } from './lib'
import { stringifyPost } from '../src/shared/frontmatter'

const id = randomUUID()
const slug = `hidden-check-${id}`
const title = `HIDDEN_TITLE_${id}`
const category = `HIDDEN_CATEGORY_${id}`
const tag = `HIDDEN_TAG_${id}`
const originalIndex = fs.readFileSync(PATHS.postsIndex)
const sources = [slug, `${slug}-draft`, `${slug}-visible`].map((name) =>
  path.join(PATHS.postsDir, `${name}.md`),
)
for (const file of sources) assert.ok(!fs.existsSync(file))

async function command(script: string, args: string[], base?: string) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], {
      cwd: ROOT,
      windowsHide: true,
      stdio: 'inherit',
      env: { ...process.env, ...(base ? { BLOG_BASE_HREF: base } : {}) },
    })
    child.on('error', reject)
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`构建检查失败：${code}`)),
    )
  })
}
async function build(base?: string) {
  await command('node_modules/tsx/dist/cli.mjs', ['scripts/prepare.ts'], base)
  await command('node_modules/@angular/cli/bin/ng.js', ['build'], base)
  await command('node_modules/tsx/dist/cli.mjs', ['scripts/postbuild.ts'], base)
}
const read = (file: string) =>
  fs.readFileSync(path.join(PATHS.dist, file), 'utf8')

try {
  const meta = {
    slug,
    title,
    date: '2026-01-01',
    tags: [tag],
    category,
    hidden: true,
  }
  fs.writeFileSync(sources[0], stringifyPost(meta, '公开的隐藏文章正文'))
  fs.writeFileSync(
    sources[1],
    stringifyPost(
      { ...meta, slug: `${slug}-draft`, draft: true },
      '不发布的草稿正文',
    ),
  )
  fs.writeFileSync(
    sources[2],
    stringifyPost(
      {
        ...meta,
        slug: `${slug}-visible`,
        title: `VISIBLE_TITLE_${id}`,
        tags: [],
        category: undefined,
        hidden: false,
      },
      '普通文章正文',
    ),
  )
  for (const base of ['/', '/blog/']) {
    await build(base)
    const index = JSON.parse(
      fs.readFileSync(path.join(PATHS.generated, 'posts.json'), 'utf8'),
    )
    assert.equal(
      index.find((post: { slug: string }) => post.slug === slug)?.hidden,
      true,
    )
    assert.ok(
      !index.some((post: { slug: string }) => post.slug === `${slug}-draft`),
    )
    for (const file of [
      'index.html',
      'archive/index.html',
      'categories/index.html',
      'tags/index.html',
      'rss.xml',
      'sitemap.xml',
    ]) {
      const html = read(file)
      assert.ok(!html.includes(title), `隐藏标题进入 ${file}`)
      assert.ok(!html.includes(category), `隐藏分类进入 ${file}`)
      assert.ok(!html.includes(tag), `隐藏标签进入 ${file}`)
      if (file === 'rss.xml' || file === 'sitemap.xml')
        assert.ok(!html.includes(`posts/${slug}/`))
    }
    assert.ok(
      !fs.existsSync(
        path.join(PATHS.dist, 'categories', category, 'index.html'),
      ),
    )
    assert.ok(!fs.existsSync(path.join(PATHS.dist, 'tags', tag, 'index.html')))
    const article = read(`posts/${slug}/index.html`)
    assert.ok(article.includes(title))
    assert.ok(article.includes('公开的隐藏文章正文'))
    assert.ok(article.includes('<meta name="robots" content="noindex"'))
    assert.ok(article.includes(`<base href="${base}"`))
    assert.ok(
      fs.existsSync(path.join(PATHS.dist, 'content/posts', `${slug}.md`)),
    )
    assert.ok(
      !fs.existsSync(
        path.join(PATHS.dist, 'content/posts', `${slug}-draft.md`),
      ),
    )
    assert.ok(read('rss.xml').includes(`VISIBLE_TITLE_${id}`))
    console.log(
      `[hidden-build] ${base}：隐藏列表、搜索索引、RSS、sitemap、直链与草稿检查通过`,
    )
  }
} finally {
  for (const file of sources) {
    assert.ok(
      path.resolve(file).startsWith(path.resolve(PATHS.postsDir) + path.sep),
    )
    if (fs.existsSync(file)) fs.unlinkSync(file)
  }
  await build()
  assert.equal(
    fs.readFileSync(PATHS.postsIndex, 'utf8').replaceAll('\r\n', '\n'),
    originalIndex.toString().replaceAll('\r\n', '\n'),
  )
  fs.writeFileSync(PATHS.postsIndex, originalIndex)
}
