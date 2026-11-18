/** 临时加密夹具构建和产物扫描，结束时删除夹具并恢复正式站点构建。 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { encryptPostBody } from '../src/shared/post-crypto'
import { stringifyPost } from '../src/shared/frontmatter'
import { PATHS, ROOT } from './lib'

const id = randomUUID()
const slug = `crypto-verification-${id}`
const draftSlug = `${slug}-draft`
const secret = `PRIVATE_BODY_${randomUUID()}_必须保密`
const password = `TEMP_PASSWORD_${randomUUID()}`
const summary = `PUBLIC_SUMMARY_${id}`
const fixturePaths = [slug, draftSlug].map((s) =>
  path.join(PATHS.postsDir, `${s}.md`),
)
for (const file of fixturePaths) assert.ok(!fs.existsSync(file))

async function command(script: string, args: string[] = []) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], {
      cwd: ROOT,
      stdio: 'inherit',
      windowsHide: true,
    })
    child.on('error', reject)
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`验证命令退出码 ${code}`)),
    )
  })
}
async function build() {
  await command('node_modules/tsx/dist/cli.mjs', ['scripts/prepare.ts'])
  await command('node_modules/@angular/cli/bin/ng.js', ['build'])
  await command('node_modules/tsx/dist/cli.mjs', ['scripts/postbuild.ts'])
}
function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const file = path.join(dir, e.name)
    return e.isDirectory() ? walk(file) : [file]
  })
}

try {
  const body = await encryptPostBody(secret, password)
  fs.writeFileSync(
    fixturePaths[0],
    stringifyPost(
      {
        slug,
        title: '加密构建验收',
        date: '2026-11-10',
        tags: ['公开测试'],
        encrypted: true,
        summary,
      },
      body,
    ),
  )
  fs.writeFileSync(
    fixturePaths[1],
    stringifyPost(
      {
        slug: draftSlug,
        title: '加密草稿',
        date: '2026-11-10',
        tags: [],
        encrypted: true,
        draft: true,
      },
      body,
    ),
  )
  await build()
  const files = walk(PATHS.dist)
  for (const file of [
    ...files,
    PATHS.postsIndex,
    path.join(PATHS.generated, 'posts.json'),
  ]) {
    const bytes = fs.readFileSync(file)
    assert.ok(
      !bytes.includes(Buffer.from(secret)),
      `正文泄漏：${path.relative(ROOT, file)}`,
    )
    assert.ok(
      !bytes.includes(Buffer.from(password)),
      `密码泄漏：${path.relative(ROOT, file)}`,
    )
  }
  const html = fs.readFileSync(
    path.join(PATHS.dist, 'posts', slug, 'index.html'),
    'utf8',
  )
  assert.ok(html.includes(summary))
  assert.ok(html.includes('encrypted-post'))
  assert.ok(!html.includes('ciphertext'))
  const rss = fs.readFileSync(path.join(PATHS.dist, 'rss.xml'), 'utf8')
  assert.ok(rss.includes(summary))
  assert.ok(!rss.includes('ciphertext'))
  assert.ok(rss.includes('你好，NavBlog'))
  const index = JSON.parse(fs.readFileSync(PATHS.postsIndex, 'utf8')).find(
    (p: { slug: string }) => p.slug === slug,
  )
  assert.equal(index.encrypted, true)
  assert.equal(index.summary, summary)
  assert.equal(index.words, 0)
  assert.ok(
    fs
      .readFileSync(
        path.join(PATHS.dist, 'content', 'posts', `${slug}.md`),
        'utf8',
      )
      .includes('ciphertext'),
  )
  assert.ok(
    !fs.existsSync(
      path.join(PATHS.dist, 'content', 'posts', `${draftSlug}.md`),
    ),
  )
  console.log(
    `[crypto-build] 已扫描 ${files.length} 个公开文件；正文/密码无泄漏，RSS/索引/预渲染与草稿检查通过。`,
  )
} finally {
  for (const file of fixturePaths) {
    assert.ok(
      path.resolve(file).startsWith(path.resolve(PATHS.postsDir) + path.sep),
    )
    if (fs.existsSync(file)) fs.unlinkSync(file)
  }
  await build()
  console.log('[crypto-build] 临时夹具已移除，正式站点构建已恢复。')
}
