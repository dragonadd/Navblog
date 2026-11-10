import '@angular/compiler'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { test } from 'node:test'
import { createEnvironmentInjector, signal } from '@angular/core'
import { normalizeThemeSettings } from '../src/shared/theme-settings'
import {
  normalizeMeta,
  parseFrontMatter,
  stringifyPost,
} from '../src/shared/frontmatter'
import { ThemeService } from '../src/app/services/theme.service'
import { BlogService } from '../src/app/services/blog.service'
import { PATHS, readPostFiles } from './lib'

test('旧设置获得默认值，关闭选项和加载模式保留，封面宽度受限', () => {
  const original = { title: '旧博客' }
  const defaults = normalizeThemeSettings(original)
  assert.equal(defaults.coverWidth, 280)
  assert.equal(defaults.listMode, 'page')
  assert.equal(defaults.latestPosts, true)
  assert.deepEqual(original, { title: '旧博客' })
  const configured = normalizeThemeSettings({
    latestPosts: false,
    articleToc: false,
    coverWidth: 900,
    listMode: 'scroll',
  })
  assert.equal(configured.latestPosts, false)
  assert.equal(configured.articleToc, false)
  assert.equal(configured.coverWidth, 360)
  assert.equal(configured.listMode, 'scroll')
  assert.equal(normalizeThemeSettings({ coverWidth: 100 }).coverWidth, 200)
})

test('全宽文章元数据可解析、保存并重读，不影响摘要及评论', () => {
  const m = normalizeMeta(
    { title: '测试', hideSidebar: true, comments: false },
    'test',
    '公开摘要',
  )
  const parsed = parseFrontMatter(stringifyPost(m, '公开摘要'))
  const result = normalizeMeta(parsed.data, 'test', parsed.body)
  assert.equal(result.hideSidebar, true)
  assert.equal(result.comments, false)
  assert.equal(result.summary, '公开摘要')
  assert.equal(
    normalizeMeta({ hideSidebar: false }, 'test').hideSidebar,
    undefined,
  )
})

test('主题色相 0、重置、深浅色 HEX 和固定主题不受旧缓存影响', () => {
  const originals = new Map(
    ['document', 'window', 'localStorage'].map((k) => [
      k,
      Object.getOwnPropertyDescriptor(globalThis, k),
    ]),
  )
  const styles = new Map<string, string>()
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      documentElement: {
        classList: { contains: () => false },
        style: { setProperty: (k: string, v: string) => styles.set(k, v) },
      },
    },
  })
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { __BLOG_CURRENT_HUE__: 180 },
  })
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { setItem() {}, removeItem() {} },
  })
  const injector = createEnvironmentInjector(
    [
      ThemeService,
      {
        provide: BlogService,
        useValue: { settings: signal({ themeHue: 0, themeFixed: true }) },
      },
    ],
    null as any,
  )
  try {
    const theme = injector.get(ThemeService)
    assert.equal(theme.defaultHue, 0)
    assert.equal(theme.hue(), 0)
    assert.equal(theme.hex, '#d41111')
    theme.dark.set(true)
    assert.equal(theme.hex, '#e75555')
    theme.setHue(900)
    assert.equal(theme.hue(), 360)
    theme.resetHue()
    assert.equal(styles.get('--hue'), '0')
  } finally {
    injector.destroy()
    for (const [k, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, k, descriptor)
      else Reflect.deleteProperty(globalThis, k)
    }
  }
})

test('静态归档有对应年月锚点，文章与 RSS 正文仍完整输出', () => {
  const archive = fs.readFileSync(`${PATHS.dist}/archive/index.html`, 'utf8')
  const rss = fs.readFileSync(`${PATHS.dist}/rss.xml`, 'utf8')
  for (const { meta } of readPostFiles().filter((p) => !p.meta.draft)) {
    const month = /^\d{4}-\d{2}/.test(meta.date)
      ? meta.date.slice(0, 7)
      : 'unknown'
    assert.ok(archive.includes(`id="archive-${month}"`))
    const html = fs.readFileSync(
      `${PATHS.dist}/posts/${meta.slug}/index.html`,
      'utf8',
    )
    assert.ok(html.includes('id="prerender"'))
    assert.ok(html.includes('class="prose-blog"'))
    assert.ok(rss.includes('<title>' + meta.title + '</title>'))
  }
})
