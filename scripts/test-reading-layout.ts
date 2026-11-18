import '@angular/compiler'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createEnvironmentInjector, signal } from '@angular/core'
import { BlogService } from '../src/app/services/blog.service'
import { SidebarComponent } from '../src/app/components/sidebar.component'
import {
  availableSidebarModules,
  articleTocVisible,
  normalizeThemeSettings,
  sidebarModuleSide,
} from '../src/shared/theme-settings'
import {
  readingScrollTop,
  scrollReadingTo,
} from '../src/app/services/reading-scroll'

const content = { announcement: true, categories: true, tags: true, toc: true }
test('文章页只显示已启用的右侧模块，联系卡片已移除', () => {
  const settings = normalizeThemeSettings({
    sidebarBlogInfo: true,
    sidebarPositions: {
      latestPosts: 'right',
      moments: 'right',
      blogInfo: 'right',
      toc: 'right',
    },
  })
  assert.deepEqual(
    availableSidebarModules(settings, content, { post: true }),
    ['latestPosts', 'moments', 'blogInfo', 'toc'],
  )
  assert.deepEqual(
    availableSidebarModules(settings, content, { post: true, mobile: true }),
    ['latestPosts', 'blogInfo'],
  )
  assert.deepEqual(
    availableSidebarModules(
      normalizeThemeSettings({
        sidebarBlogInfo: true,
        sidebarPositions: {
          latestPosts: 'left',
          moments: 'hidden',
          blogInfo: 'right',
          toc: 'right',
        },
      }),
      content,
      { post: true },
    ),
    ['blogInfo', 'toc'],
  )
  assert.deepEqual(
    availableSidebarModules(
      {
        ...settings,
        latestPosts: false,
        sidebarBlogInfo: false,
      },
      content,
      { post: true, mobile: true },
    ),
    [],
  )
  assert.ok(availableSidebarModules(settings, content).includes('profile'))
  assert.deepEqual(
    availableSidebarModules(
      {
        ...settings,
        latestPosts: false,
        sidebarBlogInfo: false,
        articleToc: false,
      },
      content,
      { post: true },
    ),
    ['moments'],
  )
})

test('旧左侧目录迁移为右侧；旧隐藏配置关闭桌面和手机目录，可重新开启', () => {
  const original = {
    sidebarPositions: { toc: 'left', contact: 'left' },
  } as unknown as Parameters<typeof normalizeThemeSettings>[0]
  const migrated = normalizeThemeSettings(original)
  assert.equal(migrated.sidebarPositions.toc, 'right')
  assert.ok(!('contact' in migrated.sidebarPositions))
  assert.equal(original.sidebarPositions?.toc, 'left')
  assert.equal(sidebarModuleSide(original, 'toc'), 'right')
  const hidden = normalizeThemeSettings({ sidebarPositions: { toc: 'hidden' } })
  assert.equal(articleTocVisible(hidden), false)
  assert.ok(
    !availableSidebarModules(hidden, content, { mobile: true }).includes('toc'),
  )
  assert.equal(
    articleTocVisible(
      normalizeThemeSettings({
        ...hidden,
        articleToc: true,
        sidebarPositions: { toc: 'right' },
      }),
    ),
    true,
  )
})

test('旧联系卡片字段和侧栏位置在设置规范化时清除', () => {
  const settings = normalizeThemeSettings({
    sidebarPositions: { contact: 'right' },
    contactEnable: true,
    contactFlip: true,
    contactTitle: 'legacy',
  } as any)
  assert.ok(!('contact' in settings.sidebarPositions))
  assert.ok(!('contactEnable' in settings))
  assert.ok(!('contactFlip' in settings))
  assert.ok(!('contactTitle' in settings))
})

test('最新发布独立按发布日期取三篇，排除隐藏与草稿，不按置顶和更新时间排序、不改变源数组', () => {
  const posts = signal([
    { slug: 'pinned', date: '2026-01-01', updated: '2026-12-01', pinned: true },
    { slug: 'new', date: '2026-11-15T01:00:00+08:00' },
    { slug: 'hidden', date: '2026-11-17', hidden: true },
    { slug: 'draft', date: '2026-11-17', draft: true },
    { slug: 'second', date: '2026-11-14' },
    { slug: 'third', date: '2026-11-13' },
  ])
  const source = structuredClone(posts())
  const injector = createEnvironmentInjector(
    [
      {
        provide: BlogService,
        useValue: { posts, settings: signal({ postsPerPage: 1 }) },
      },
    ],
    null as any,
  )
  try {
    const sidebar = injector.runInContext(() => new SidebarComponent())
    assert.deepEqual(
      sidebar.latest().map((p) => p.slug),
      ['new', 'second', 'third'],
    )
    assert.deepEqual(posts(), source)
    posts.set([source[0]])
    assert.equal(sidebar.latest().length, 1)
  } finally {
    injector.destroy()
  }
})

test('目录、评论和返回顶部定位正文容器，手机与减少动态效果使用正确回退', () => {
  const keys = ['document', 'window'] as const
  const originals = keys.map((key) =>
    Object.getOwnPropertyDescriptor(globalThis, key),
  )
  let container: any = {
    scrollTop: 320,
    getBoundingClientRect: () => ({ top: 76 }),
    scrollTo: (args: any) => {
      result = args
    },
  }
  let result: any,
    reduced = false
  const target = {
    getBoundingClientRect: () => ({ top: 200 }),
    scrollIntoView: (args: any) => {
      result = args
    },
  } as any
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { querySelector: () => container },
  })
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      scrollY: 500,
      matchMedia: () => ({ matches: reduced }),
      scrollTo: (args: any) => {
        result = args
      },
    },
  })
  try {
    assert.equal(readingScrollTop(), 320)
    scrollReadingTo(target)
    assert.deepEqual(result, { top: 420, behavior: 'smooth' })
    scrollReadingTo()
    assert.deepEqual(result, { top: 0, behavior: 'smooth' })
    container = null
    assert.equal(readingScrollTop(), 500)
    reduced = true
    scrollReadingTo(target)
    assert.deepEqual(result, { block: 'start', behavior: 'instant' })
  } finally {
    keys.forEach((key, i) => {
      if (originals[i]) Object.defineProperty(globalThis, key, originals[i]!)
      else Reflect.deleteProperty(globalThis, key)
    })
  }
})
