/** 用临时配置验证真实构建，结束后恢复原设置及正式产物。 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { spawn } from 'node:child_process'
import { PATHS, ROOT } from './lib'

const original = fs.readFileSync(PATHS.settings, 'utf8')
const settings = JSON.parse(original)
const log = path.join(ROOT, 'tmp', 'site-build-test.log')
fs.mkdirSync(path.dirname(log), { recursive: true })
fs.writeFileSync(
  path.join(ROOT, 'tmp', 'site-build-settings-backup.json'),
  original,
)
async function command(script: string, args: string[] = [], baseHref = '/') {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], {
      cwd: ROOT,
      windowsHide: true,
      env: { ...process.env, BLOG_BASE_HREF: baseHref },
    })
    child.stdout.on('data', (data) => fs.appendFileSync(log, data))
    child.stderr.on('data', (data) => fs.appendFileSync(log, data))
    child.on('error', reject)
    child.on('exit', (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`构建退出码 ${code}；日志 ${log}`)),
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
function bootstrap(html: string) {
  let dark = false
  const context = vm.createContext({
    window: { matchMedia: () => ({ matches: false }) },
    document: {
      documentElement: {
        classList: {
          toggle: (_: string, value: boolean) => {
            dark = value
          },
        },
        style: { setProperty() {} },
      },
    },
    localStorage: {
      getItem() {
        throw new Error('storage blocked')
      },
    },
  })
  for (const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g))
    vm.runInContext(match[1], context)
  return dark
}
try {
  fs.writeFileSync(
    PATHS.settings,
    JSON.stringify({
      ...settings,
      rssEnable: false,
      pwaEnable: false,
      appearance: 'dark',
    }),
  )
  await build()
  assert.ok(!fs.existsSync(path.join(PATHS.dist, 'rss.xml')))
  assert.ok(!fs.existsSync(path.join(PATHS.dist, 'manifest.webmanifest')))
  const offHtml = fs.readFileSync(path.join(PATHS.dist, 'index.html'), 'utf8')
  assert.ok(!offHtml.includes('rel="manifest"'))
  assert.ok(!offHtml.includes('application/rss+xml'))
  assert.equal(bootstrap(offHtml), true)
  fs.writeFileSync(
    PATHS.settings,
    JSON.stringify({
      ...settings,
      rssEnable: true,
      rssFullContent: false,
      pwaEnable: true,
      pwaName: '验收安装名称',
      pwaShortName: '验收',
      pwaIcon: 'icons/icon-192x192.png',
      pwaThemeColor: '#112233',
    }),
  )
  await build('/blog/')
  const manifest = JSON.parse(
    fs.readFileSync(path.join(PATHS.dist, 'manifest.webmanifest'), 'utf8'),
  )
  assert.equal(manifest.name, '验收安装名称')
  assert.equal(manifest.start_url, '/blog/')
  assert.equal(manifest.scope, '/blog/')
  assert.equal(manifest.icons[0].src, '/blog/icons/icon-192x192.png')
  const html = fs.readFileSync(path.join(PATHS.dist, 'index.html'), 'utf8')
  assert.ok(html.includes('<base href="/blog/"'))
  assert.ok(html.includes('application/rss+xml'))
  assert.ok(html.includes('apple-touch-icon'))
  const rss = fs.readFileSync(path.join(PATHS.dist, 'rss.xml'), 'utf8')
  assert.ok(rss.includes('博客搭好啦'))
  assert.ok(!rss.includes('def fib'))
  console.log(
    '[site-build] RSS/PWA 关闭、重新启用、摘要模式、子路径和存储受限初始主题全部通过。',
  )
} finally {
  fs.writeFileSync(PATHS.settings, original)
  await build(process.env.BLOG_BASE_HREF || '/')
  console.log('[site-build] 已恢复原设置和正式构建。')
}
