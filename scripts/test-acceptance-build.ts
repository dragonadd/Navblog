/** 真实构建回归；临时数据结束后移除，并恢复正式设置和产物。 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import { PATHS, ROOT } from './lib'

const original = fs.readFileSync(PATHS.settings, 'utf8')
const id = randomUUID(),
  slug = `acceptance-${id}`,
  draftSlug = `${slug}-draft`
const postFile = path.join(PATHS.postsDir, slug + '.md')
const draftFile = path.join(PATHS.postsDir, draftSlug + '.md')
const nested = path.join(PATHS.postsDir, `nested-${id}`)
const draftSecret = 'PRIVATEUNPUBLISHEDBODY' + id,
  nestedSecret = 'NESTED_BODY_' + id
const log = path.join(ROOT, 'tmp', 'acceptance-fixes', 'build.log')
fs.mkdirSync(path.dirname(log), { recursive: true })
for (const file of [postFile, draftFile, nested])
  assert.ok(!fs.existsSync(file))

async function command(script: string, args: string[], baseHref: string) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], {
      cwd: ROOT,
      windowsHide: true,
      env: { ...process.env, BLOG_BASE_HREF: baseHref },
    })
    child.stdout.on('data', (b) => fs.appendFileSync(log, b))
    child.stderr.on('data', (b) => fs.appendFileSync(log, b))
    child.on('error', reject)
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`构建失败，详见 ${log}`)),
    )
  })
}
async function build(baseHref = '/') {
  await command(
    'node_modules/tsx/dist/cli.mjs',
    ['scripts/prepare.ts'],
    baseHref,
  )
  await command('node_modules/@angular/cli/bin/ng.js', ['build'], baseHref)
  await command(
    'node_modules/tsx/dist/cli.mjs',
    ['scripts/postbuild.ts'],
    baseHref,
  )
}
function walk(dir: string): string[] {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)],
    )
}
try {
  fs.writeFileSync(
    PATHS.settings,
    JSON.stringify({
      ...JSON.parse(original),
      title: '站点 $$5 $&',
      subtitle: '',
      description: "说明 $& $$5 $'",
    }),
  )
  fs.writeFileSync(
    postFile,
    "---\ntitle: 文章 $$5 $&\ndate: 2026-11-11\nsummary: 摘要 $& $$5 $'\ntags: []\n---\n公开正文",
  )
  fs.writeFileSync(
    draftFile,
    `---\ntitle: 隐藏草稿-${id}\ndate: 2026-11-11\ndraft: true\ntags: []\n---\n${draftSecret}`,
  )
  fs.mkdirSync(nested)
  fs.writeFileSync(
    path.join(nested, 'private.md'),
    `---\nencrypted: true\n---\n${nestedSecret}`,
  )
  const failures: string[] = []
  const check = (ok: boolean, name: string) => {
    if (!ok) failures.push(name)
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}`)
  }
  for (const base of ['/', '/blog/']) {
    await build(base)
    const html = fs.readFileSync(path.join(PATHS.dist, 'index.html'), 'utf8')
    const article = fs.readFileSync(
      path.join(PATHS.dist, 'posts', slug, 'index.html'),
      'utf8',
    )
    check(
      html.includes('<title>站点 $$5 $&amp;</title>'),
      `${base}站点标题的美元符号保留`,
    )
    check(
      html.includes('content="说明 $&amp; $$5 $\'"'),
      `${base}站点描述的美元符号保留`,
    )
    check(
      article.includes('<title>文章 $$5 $&amp; - 站点 $$5 $&amp;</title>'),
      `${base}文章标题的美元符号保留`,
    )
    check(
      article.includes('content="摘要 $&amp; $$5 $\'"'),
      `${base}文章摘要的美元符号保留`,
    )
    check(
      !fs.existsSync(
        path.join(
          PATHS.dist,
          'content',
          'posts',
          path.basename(nested),
          'private.md',
        ),
      ),
      `${base}嵌套未验证文章不发布`,
    )
    check(
      !fs.existsSync(
        path.join(PATHS.dist, 'content', 'posts', draftSlug + '.md'),
      ),
      `${base}草稿源码不发布`,
    )
    const publicFiles = walk(PATHS.dist)
    check(
      publicFiles.every(
        (file) => !fs.readFileSync(file).includes(Buffer.from(draftSecret)),
      ),
      `${base}草稿正文及自动摘要不进公开产物`,
    )
    const generated = JSON.parse(
      fs.readFileSync(path.join(PATHS.generated, 'posts.json'), 'utf8'),
    )
    check(
      !generated.some((p: { slug: string }) => p.slug === draftSlug),
      `${base}公开索引排除草稿`,
    )
    const index = JSON.parse(fs.readFileSync(PATHS.postsIndex, 'utf8'))
    check(
      index.some((p: { slug: string }) => p.slug === draftSlug),
      `${base}仓库后台索引保留草稿`,
    )
    const rules = fs
      .readFileSync(path.join(PATHS.dist, '_redirects'), 'utf8')
      .trim()
      .split('\n')
      .filter((line) => line && !line.startsWith('#'))
    const matches = (route: string) =>
      rules.some((line) =>
        new RegExp(
          '^' +
            line
              .split(/\s+/)[0]
              .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
              .replace(/\*/g, '.*') +
            '$',
        ).test(route),
      )
    check(
      ![
        base + 'main.js',
        base + 'styles.css',
        base + 'data/auth.json',
        base + 'rss.xml',
        base + 'posts/' + slug + '/',
      ].some(matches),
      `${base}Cloudflare 回退不覆盖静态资源`,
    )
    check(matches(base + 'admin/settings'), `${base}后台子路由仍有回退`)
  }
  assert.deepEqual(failures, [], '构建回归失败')
} finally {
  fs.writeFileSync(PATHS.settings, original)
  for (const file of [postFile, draftFile])
    if (fs.existsSync(file)) fs.unlinkSync(file)
  assert.ok(
    path.resolve(nested).startsWith(path.resolve(PATHS.postsDir) + path.sep),
  )
  fs.rmSync(nested, { recursive: true, force: true })
  await build(process.env.BLOG_BASE_HREF || '/')
  console.log('[acceptance-build] 临时数据已移除，原设置和正式构建已恢复。')
}
