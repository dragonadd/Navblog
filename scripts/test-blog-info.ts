import '@angular/compiler'
import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { createEnvironmentInjector } from '@angular/core'
import { readBlogInfo as readInfo } from '../src/shared/blog-info'
import type { BlogSettings, PostMeta } from '../src/shared/types'
import { BlogInfoComponent } from '../src/app/components/blog-info.component'
import { BlogService } from '../src/app/services/blog.service'
import { LocalDemoService } from '../src/app/services/local-demo.service'
import {
  availableSidebarModules,
  mergeThemeSettings,
  normalizeThemeSettings,
  sidebarModuleSide,
} from '../src/shared/theme-settings'

const content = {
  announcement: false,
  categories: false,
  tags: false,
  toc: false,
}
const post = (
  slug: string,
  date: string,
  extra: Partial<PostMeta> = {},
): PostMeta => ({ slug, title: slug, date, tags: [], ...extra })

test('旧配置不自动开启博客信息，不从版权年份猜测运行起始日或评论数', () => {
  const settings = normalizeThemeSettings({ since: 2020 }) as any
  assert.equal(settings.sidebarBlogInfo, false)
  assert.equal(settings.blogStartDate, '')
  assert.equal(settings.blogCommentCount, null)
  assert.equal(settings.blogCommentCountDate, '')
  assert.ok(
    !availableSidebarModules(settings, content).includes('blogInfo' as any),
  )
})

test('博客信息沿用模块位置和开关，隐藏位置不影响手机可用模块', () => {
  for (const side of ['left', 'right', 'hidden']) {
    const settings = normalizeThemeSettings({
      sidebarBlogInfo: 'true',
      sidebarPositions: { blogInfo: side },
    } as any)
    assert.equal(sidebarModuleSide(settings, 'blogInfo' as any), side)
    assert.ok(
      availableSidebarModules(settings, content).includes('blogInfo' as any),
    )
    assert.ok(
      !availableSidebarModules(
        { ...settings, sidebarBlogInfo: false } as any,
        content,
      ).includes('blogInfo' as any),
    )
  }
  assert.equal(
    normalizeThemeSettings({ sidebarBlogInfo: 'false' } as any).sidebarBlogInfo,
    false,
  )
  assert.throws(
    () => normalizeThemeSettings({ sidebarBlogInfo: 1 } as any),
    /布尔/,
  )
})

test('读取旧设置文件时不继承已部署的新模块开关，保留旧的全部隐藏布局', () => {
  const base = normalizeThemeSettings({
    sidebarBlogInfo: true,
  } as any) as BlogSettings
  const legacy = {
    sidebarPositions: Object.fromEntries(
      [
        'profile',
        'announcement',
        'stats',
        'latestPosts',
        'moments',
        'contact',
        'categories',
        'tags',
        'toc',
      ].map((key) => [key, 'hidden']),
    ),
  }
  const settings = normalizeThemeSettings(
    mergeThemeSettings(base, legacy as any),
  )
  assert.equal(settings.sidebarBlogInfo, false)
  const modules = availableSidebarModules(settings, content)
  assert.ok(
    modules.every((key) => sidebarModuleSide(settings, key) === 'hidden'),
  )
  assert.equal(
    normalizeThemeSettings(mergeThemeSettings(base, null)).sidebarBlogInfo,
    true,
  )
})

test('起始日期使用真实日历日期，规范化不改写输入，空日期保持未配置', () => {
  const original = { blogStartDate: ' 2024-02-29 ' }
  assert.equal(
    normalizeThemeSettings(original as any).blogStartDate,
    '2024-02-29',
  )
  assert.deepEqual(original, { blogStartDate: ' 2024-02-29 ' })
  assert.equal(
    normalizeThemeSettings({ blogStartDate: '' } as any).blogStartDate,
    '',
  )
  for (const blogStartDate of [
    '2023-02-29',
    '2026-04-31',
    '2026-00-10',
    '2026-1-1',
    '2026/01/01',
    '0000-01-01',
    '2026-01-01T00:00:00Z',
    2026,
    null,
  ]) {
    assert.throws(
      () => normalizeThemeSettings({ blogStartDate } as any),
      /日期|文本/,
    )
  }
})

test('评论总数仅接受带核实日期的非负整数快照，真实零与未配置区别对待', () => {
  assert.equal(
    normalizeThemeSettings({ blogCommentCount: null } as any).blogCommentCount,
    null,
  )
  const zero = normalizeThemeSettings({
    blogCommentCount: 0,
    blogCommentCountDate: '2026-11-10',
  } as any)
  assert.equal(zero.blogCommentCount, 0)
  assert.equal(zero.blogCommentCountDate, '2026-11-10')
  for (const blogCommentCount of [
    -1,
    0.5,
    '12',
    false,
    NaN,
    Infinity,
    Number.MAX_SAFE_INTEGER + 1,
  ]) {
    assert.throws(
      () =>
        normalizeThemeSettings({
          blogCommentCount,
          blogCommentCountDate: '2026-11-10',
        } as any),
      /评论|整数/,
    )
  }
  assert.throws(
    () => normalizeThemeSettings({ blogCommentCount: 12 } as any),
    /核实日期/,
  )
  assert.throws(
    () => normalizeThemeSettings({ blogCommentCountDate: '2026-11-10' } as any),
    /总数/,
  )
  assert.throws(
    () =>
      normalizeThemeSettings({
        blogCommentCount: 12,
        blogCommentCountDate: '2026-02-30',
      } as any),
    /日期/,
  )
})

test('文章数和最后活动排除草稿与隐藏文章，保留公开加密文章，不改动索引', () => {
  const posts = [
    post('public', '2026-11-01T00:00:00Z'),
    post('encrypted', '2026-11-02T00:00:00Z', { encrypted: true }),
    post('hidden', '2026-11-12T00:00:00Z', { hidden: true }),
    post('draft', '2026-11-12T00:00:00Z', { draft: true }),
  ]
  const original = structuredClone(posts)
  const info = readInfo(
    { since: 2020 },
    posts,
    [],
    new Date('2026-11-13T12:00:00Z'),
  )
  assert.equal(info?.articleCount, 2)
  assert.equal(info?.lastActivity, '2026-11-02T00:00:00.000Z')
  assert.equal(info?.runningDays, null)
  assert.equal(info?.commentCount, null)
  assert.deepEqual(posts, original)
})

test('运行天数按本地日历相减，起始当天为零，闰日和未来起始日期均正确', () => {
  for (const [start, now, days] of [
    ['2024-02-29', new Date(2024, 1, 29, 23, 59), 0],
    ['2024-02-29', new Date(2024, 2, 1, 0, 1), 1],
    ['2026-11-01', new Date(2026, 10, 13, 0, 1), 12],
    ['2026-12-01', new Date(2026, 10, 13, 12), null],
    ['', new Date(2026, 10, 13, 12), null],
  ] as const)
    assert.equal(
      readInfo({ blogStartDate: start }, [], [], now)?.runningDays,
      days,
    )
})

test('夏令时和访客时区不会把两个日历日误算为一天', () => {
  const original = process.env.TZ
  try {
    for (const zone of ['Asia/Shanghai', 'America/New_York']) {
      process.env.TZ = zone
      const info = readInfo(
        { blogStartDate: '2026-03-07' },
        [],
        [],
        new Date(2026, 2, 9, 0, 1),
      )
      assert.equal(info?.runningDays, 2, zone)
    }
  } finally {
    if (original === undefined) delete process.env.TZ
    else process.env.TZ = original
  }
})

test('最后活动取文章与碎碎念发布和更新时间中的最新实际时间', () => {
  const posts = [
    post('post', '2026-11-10T00:00:00Z', { updated: '2026-11-09T00:00:00Z' }),
  ]
  const moments = [
    {
      id: 'moment',
      date: '2026-11-03T00:00:00Z',
      updated: '2026-11-12T10:00:00+08:00',
      text: '动态',
    },
    { id: 'future', date: '2026-12-01T00:00:00Z', text: '未来时间' },
  ]
  assert.equal(
    readInfo({}, posts, [], new Date('2026-11-13T12:00:00Z'))?.lastActivity,
    '2026-11-10T00:00:00.000Z',
  )
  assert.equal(
    readInfo({}, posts, moments, new Date('2026-11-13T12:00:00Z'))
      ?.lastActivity,
    '2026-11-12T02:00:00.000Z',
  )
  const local = readInfo(
    {},
    [post('local', '2026-11-10 12:30')],
    [],
    new Date(2026, 10, 13, 12),
  )
  assert.equal(
    local?.lastActivity,
    new Date(2026, 10, 10, 12, 30).toISOString(),
  )
})

test('空站点显示暂无活动，损坏或缺失的内容时间显示不可用，不生成当前时间', () => {
  const now = new Date('2026-11-13T12:00:00Z')
  const empty = readInfo({}, [], [], now)
  assert.equal(empty?.lastActivity, null)
  assert.equal(empty?.activityUnavailable, false)
  for (const date of [
    '',
    'invalid',
    '2026-02-30',
    '2026-11-10 24:00',
    '2026-11-10T12:99:00Z',
  ]) {
    const info = readInfo({}, [post('bad-date', date)], [], now)
    assert.equal(info?.lastActivity, null)
    assert.equal(info?.activityUnavailable, true)
    assert.equal(info?.articleCount, 1)
  }
  const unavailable = readInfo(
    {},
    [post('known', '2026-11-01T00:00:00Z')],
    null,
    now,
  )
  assert.equal(unavailable?.lastActivity, null)
  assert.equal(unavailable?.activityUnavailable, true)
})

test('配置的评论零值保留为快照，与 Giscus 是否启用独立，不产生实时总数', () => {
  const info = readInfo(
    { blogCommentCount: 0, blogCommentCountDate: '2026-11-10' },
    [],
    [],
    new Date(2026, 10, 13),
  )
  assert.equal(info?.commentCount, 0)
  assert.equal(info?.commentCountDate, '2026-11-10')
})

const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document')
const listeners = new Map<string, () => void>()
beforeEach(() => {
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      addEventListener: (event: string, handler: () => void) =>
        listeners.set(event, handler),
      removeEventListener: (event: string, handler: () => void) => {
        if (listeners.get(event) === handler) listeners.delete(event)
      },
    },
  })
})
afterEach(() => {
  listeners.clear()
  if (originalDocument)
    Object.defineProperty(globalThis, 'document', originalDocument)
  else Reflect.deleteProperty(globalThis, 'document')
})

function componentFixture() {
  const posts = [
    post('public', '2026-11-10T00:00:00Z'),
    post('encrypted', '2026-11-09T00:00:00Z', { encrypted: true }),
    post('hidden', '2026-11-12T00:00:00Z', { hidden: true }),
    post('draft', '2026-11-12T00:00:00Z', { draft: true }),
  ]
  let settings: Partial<BlogSettings> = {
    sidebarBlogInfo: true,
    blogStartDate: '2026-11-13',
    blogCommentCount: null,
    blogCommentCountDate: '',
  }
  let moments = JSON.stringify([
    { id: 'moment', date: '2026-11-11T00:00:00Z', text: '公开动态' },
  ])
  const injector = createEnvironmentInjector(
    [
      BlogService,
      {
        provide: LocalDemoService,
        useValue: {
          readJson: (file: string, fallback: unknown) =>
            file === 'data/posts.json'
              ? posts
              : file === 'data/settings.json'
                ? settings
                : fallback,
          read: (file: string) =>
            file === 'data/moments.json' ? moments : undefined,
        },
      },
    ],
    null as any,
  )
  return {
    injector,
    blog: injector.get(BlogService),
    component: injector.runInContext(() => new BlogInfoComponent()),
    setMoments: (source: string) => {
      moments = source
    },
    setSettings: (value: Partial<BlogSettings>) => {
      settings = { ...settings, ...value }
    },
  }
}

test('实际模块读取公共数据，演示保存后更新，损坏碎碎念只使最后活动不可用', (t) => {
  t.mock.timers.enable({
    apis: ['Date', 'setInterval'],
    now: new Date(2026, 10, 13, 12).getTime(),
  })
  const f = componentFixture()
  try {
    assert.equal(f.component.info().articleCount, 2)
    assert.equal(f.component.info().lastActivity, '2026-11-11T00:00:00.000Z')
    f.setMoments(
      JSON.stringify([
        {
          id: 'edited',
          date: '2026-11-01T00:00:00Z',
          updated: '2026-11-12T00:00:00Z',
          text: '编辑过的动态',
        },
      ]),
    )
    f.setSettings({ blogCommentCount: 0, blogCommentCountDate: '2026-11-12' })
    f.blog.refreshDemo()
    assert.equal(f.component.info().lastActivity, '2026-11-12T00:00:00.000Z')
    assert.equal(f.component.info().commentCount, 0)
    f.setMoments('{')
    f.blog.refreshDemo()
    assert.doesNotThrow(() => f.component.info())
    assert.equal(f.component.info().articleCount, 2)
    assert.equal(f.component.info().lastActivity, null)
    assert.equal(f.component.info().activityUnavailable, true)
  } finally {
    f.injector.destroy()
  }
})

test('模块跨午夜自动更新，标签页唤醒立即更新，销毁后停止时钟和监听', (t) => {
  const start = new Date(2026, 10, 13, 23, 59, 50).getTime()
  t.mock.timers.enable({ apis: ['Date', 'setInterval'], now: start })
  const f = componentFixture()
  try {
    assert.equal(f.component.info().runningDays, 0)
    t.mock.timers.tick(60000)
    assert.equal(f.component.info().runningDays, 1)
    t.mock.timers.setTime(new Date(2026, 10, 15, 12).getTime())
    listeners.get('visibilitychange')?.()
    assert.equal(f.component.info().runningDays, 2)
    f.injector.destroy()
    t.mock.timers.tick(86400000)
    assert.equal(f.component.info().runningDays, 2)
    assert.equal(listeners.size, 0)
  } finally {
    if (!f.injector.destroyed) f.injector.destroy()
  }
})
