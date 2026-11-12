import '@angular/compiler'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { afterEach, beforeEach, test } from 'node:test'
import {
  createEnvironmentInjector,
  ElementRef,
  ChangeDetectorRef,
  signal,
} from '@angular/core'
import { NavigationEnd, Router } from '@angular/router'
import { Subject } from 'rxjs'
import { normalizeThemeSettings } from '../src/shared/theme-settings'
import { HeaderComponent } from '../src/app/components/header.component'
import { AppComponent } from '../src/app/app.component'
import { AnnouncementComponent } from '../src/app/components/announcement.component'
import { SettingsPage } from '../src/app/admin/settings.page'
import { BlogService } from '../src/app/services/blog.service'
import { ThemeService } from '../src/app/services/theme.service'
import { ToastService } from '../src/app/services/toast.service'
import { AnnouncementStateService } from '../src/app/services/announcement-state.service'
import { LocalDemoService } from '../src/app/services/local-demo.service'
import { GitService } from '../src/app/services/git.service'
import { AdminStore } from '../src/app/admin/admin-store.service'

const fixture = JSON.parse(fs.readFileSync('data/settings.json', 'utf8'))
const originals = new Map(
  ['window', 'document', 'location'].map((key) => [
    key,
    Object.getOwnPropertyDescriptor(globalThis, key),
  ]),
)
const mediaListeners = new Set<() => void>()
let media: {
  matches: boolean
  addEventListener: Function
  removeEventListener: Function
}
beforeEach(() => {
  media = {
    matches: true,
    addEventListener: (_: string, handler: () => void) =>
      mediaListeners.add(handler),
    removeEventListener: (_: string, handler: () => void) =>
      mediaListeners.delete(handler),
  }
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { matchMedia: () => media },
  })
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      baseURI: 'https://example.test/blog/',
      getElementById() {},
      addEventListener() {},
    },
  })
  Object.defineProperty(globalThis, 'location', {
    configurable: true,
    value: { pathname: '/blog/', origin: 'https://example.test', hash: '' },
  })
})
afterEach(() => {
  mediaListeners.clear()
  for (const [key, value] of originals) {
    if (value) Object.defineProperty(globalThis, key, value)
    else Reflect.deleteProperty(globalThis, key)
  }
})

const normalize = (overrides: any = {}) =>
  normalizeThemeSettings({ ...fixture, ...overrides }) as any
const extraFixture = [
  {
    name: '更多',
    url: '',
    children: [
      { name: '关于', url: '/about' },
      { name: '隐藏子项', url: '/secret', visible: false },
    ],
  },
  { name: '隐藏父项', url: '/hidden', visible: false },
  { name: '外部链接', url: 'https://example.org/' },
]
function makeHeader(settings: any) {
  const inside = {},
    element = {
      contains: (target: any) => target === inside,
      querySelector: () => ({
        getBoundingClientRect: () => ({ left: 100, width: 500 }),
      }),
    }
  const injector = createEnvironmentInjector(
    [
      {
        provide: BlogService,
        useValue: {
          settings: signal(settings),
          posts: signal([]),
          publishedPosts: signal([]),
          url: (path: string) =>
            new URL(path.replace(/^\//, ''), 'https://example.test/blog/').href,
        },
      },
      {
        provide: ThemeService,
        useValue: { dark: signal(false), hue: signal(52), defaultHue: 52 },
      },
      { provide: ToastService, useValue: {} },
      { provide: Router, useValue: { navigate() {} } },
      { provide: ElementRef, useValue: { nativeElement: element } },
    ],
    null as any,
  )
  return {
    injector,
    inside,
    header: injector.runInContext(() => new HeaderComponent()) as any,
  }
}

test('旧侧栏方向迁移为各模块位置，显式覆盖生效且不修改输入', () => {
  const left = {
    profile: 'left',
    announcement: 'left',
    stats: 'left',
    latestPosts: 'left',
    moments: 'left',
    contact: 'left',
    categories: 'left',
    tags: 'left',
    toc: 'left',
  }
  assert.deepEqual(
    normalize({ sidebarReverse: false, sidebarPositions: undefined })
      .sidebarPositions,
    left,
  )
  const original = { sidebarReverse: true, sidebarPositions: { stats: 'left' } }
  assert.deepEqual(normalize(original).sidebarPositions, {
    profile: 'right',
    announcement: 'right',
    stats: 'left',
    latestPosts: 'right',
    moments: 'right',
    contact: 'right',
    categories: 'right',
    tags: 'right',
    toc: 'right',
  })
  assert.deepEqual(original, {
    sidebarReverse: true,
    sidebarPositions: { stats: 'left' },
  })
  assert.throws(
    () => normalize({ sidebarPositions: { profile: 'middle' } }),
    /位置|侧栏/,
  )
  assert.throws(() => normalize({ sidebarPositions: [] }), /位置|侧栏/)
})

test('桌面模块支持隐藏，全部隐藏时使用居中阅读布局，手机与全宽文章行为保留', () => {
  const original = { profile: 'hidden', stats: 'hidden', contact: 'right' }
  const normalized = normalize({ sidebarPositions: original })
  assert.equal(normalized.sidebarPositions.profile, 'hidden')
  assert.deepEqual(original, {
    profile: 'hidden',
    stats: 'hidden',
    contact: 'right',
  })
  const settings = signal(
    normalize({
      sidebarPositions: Object.fromEntries(
        Object.keys(normalized.sidebarPositions).map((key) => [key, 'hidden']),
      ),
      announcementEnable: true,
      announcementText: '隐藏测试',
      latestPosts: true,
      contactEnable: true,
    }),
  )
  const events = new Subject<any>()
  const injector = createEnvironmentInjector(
    [
      {
        provide: BlogService,
        useValue: {
          config: { baseHref: '/blog/' },
          settings,
          categories: signal([{ name: '分类', count: 1 }]),
          tags: signal([{ name: '标签', count: 1 }]),
          toc: signal([]),
          findPost: () => ({ hideSidebar: true }),
        },
      },
      { provide: ThemeService, useValue: {} },
      { provide: Router, useValue: { events } },
      {
        provide: AnnouncementStateService,
        useValue: { dismissed: signal('') },
      },
    ],
    null as any,
  )
  try {
    const app = injector.runInContext(() => new AppComponent()) as any
    assert.deepEqual(app.leftModules(), [])
    assert.deepEqual(app.rightModules(), [])
    assert.equal(app.noSidebar(), true)
    assert.equal(app.wideLayout(), false)
    media.matches = false
    mediaListeners.forEach((listener) => listener())
    assert.equal(app.noSidebar(), false)
    assert.ok(app.sidebarModules().includes('profile'))
    assert.ok(app.sidebarModules().includes('announcement'))
    media.matches = true
    mediaListeners.forEach((listener) => listener())
    events.next(new NavigationEnd(1, '/posts/full', '/posts/full'))
    assert.equal(app.hideSidebar(), true)
    assert.equal(app.noSidebar(), false)
  } finally {
    events.complete()
    injector.destroy()
  }
})

test('两级菜单清理空白并保留隐藏数据与分组，不修改原配置', () => {
  const menus = [
    {
      name: ' 更多 ',
      url: '',
      visible: 'true',
      children: [
        { name: ' 关于 ', url: ' /about ', visible: 'false', blank: 'true' },
      ],
    },
  ]
  const result = normalize({ menus }).menus
  assert.equal(result[0].name, '更多')
  assert.equal(result[0].url, '')
  assert.equal(result[0].children[0].name, '关于')
  assert.equal(result[0].children[0].url, '/about')
  assert.equal(result[0].children[0].visible, false)
  assert.equal(result[0].children[0].blank, true)
  assert.equal(menus[0].children[0].name, ' 关于 ')
  assert.equal(menus[0].children[0].visible, 'false')
})

test('菜单拒绝危险链接、缺失子链接和第三层，空占位行允许删除', () => {
  for (const url of [
    'javascript:alert(1)',
    'data:text/html,test',
    'https://user:secret@example.org/',
    'https://exa\nmple.org/',
  ])
    assert.throws(
      () => normalize({ menus: [{ name: '链接', url }] }),
      /菜单|链接/,
    )
  assert.throws(
    () =>
      normalize({
        menus: [
          { name: '分组', url: '', children: [{ name: '未填链接', url: '' }] },
        ],
      }),
    /菜单|链接/,
  )
  assert.throws(
    () =>
      normalize({
        menus: [
          {
            name: '分组',
            url: '',
            children: [
              {
                name: '子项',
                url: '/about',
                children: [{ name: '孙项', url: '/archive' }],
              },
            ],
          },
        ],
      }),
    /两级|二级/,
  )
  assert.deepEqual(normalize({ menus: [{ name: '', url: '' }] }).menus, [])
})

test('菜单格式错误有明确提示，合法链接和空的末级数组保持兼容', () => {
  assert.throws(
    () => normalize({ menus: [{ name: '坏链接', url: 'https://' }] }),
    /菜单.*链接/,
  )
  const urls = [
    '/about',
    'about',
    '#section',
    'mailto:hello@example.org',
    'tel:+8612345678',
  ]
  assert.deepEqual(
    normalize({
      menus: urls.map((url, index) => ({ name: `链接${index}`, url })),
    }).menus.map((item: any) => item.url),
    urls,
  )
  assert.equal(
    normalize({
      menus: [
        {
          name: '分组',
          url: '',
          children: [{ name: '关于', url: '/about', children: [] }],
        },
      ],
    }).menus[0].children.length,
    1,
  )
})

test('碎碎念和关于与其他内置菜单一样支持显隐和旧配置默认值', () => {
  const { injector, header } = makeHeader(
    normalize({ menuMoments: false, menuAbout: false }),
  )
  try {
    assert.deepEqual(
      header.visibleMenus().map((item: any) => item.url),
      ['/', '/archive', '/categories', '/tags'],
    )
    header.settings.set(
      normalize({ menuHome: false, menuMoments: 'true', menuAbout: 'false' }),
    )
    assert.deepEqual(
      header.visibleMenus().map((item: any) => item.url),
      ['/archive', '/categories', '/tags', '/moments'],
    )
  } finally {
    injector.destroy()
  }
})

test('额外菜单隐藏父子项但保留设置，空分组不生成无效入口', () => {
  const { injector, header } = makeHeader(normalize({ menus: extraFixture }))
  try {
    const view = header.extraMenus?.()
    assert.deepEqual(
      view?.map((item: any) => [
        item.name,
        item.children?.map((child: any) => child.name),
      ]),
      [
        ['更多', ['关于']],
        ['外部链接', []],
      ],
    )
    assert.equal(header.settings().menus.length, 3)
    assert.equal(header.settings().menus[0].children.length, 2)
    header.settings.set(
      normalize({
        menus: [
          {
            name: '全隐藏分组',
            url: '',
            children: [{ name: '子项', url: '/about', visible: false }],
          },
        ],
      }),
    )
    assert.deepEqual(header.extraMenus?.(), [])
  } finally {
    injector.destroy()
  }
})

test('二级菜单展开保持手机外层菜单，外部点击和Escape关闭，边缘面板被限制在导航内', () => {
  const { injector, header, inside } = makeHeader(
    normalize({ menus: extraFixture }),
  )
  try {
    header.mobileOpen.set(true)
    header.toggleExtra?.(0)
    assert.equal(header.extraOpen?.(), 0)
    assert.equal(header.mobileOpen(), true)
    header.onDocClick({ target: inside } as any)
    assert.equal(header.extraOpen?.(), 0)
    header.onDocClick({ target: {} } as any)
    assert.equal(header.extraOpen?.(), null)
    assert.equal(header.mobileOpen(), false)
    const event = {
      currentTarget: { getBoundingClientRect: () => ({ left: 580 }) },
    }
    header.toggleExtra?.(0, event as any)
    assert.equal(header.extraLeft?.(), 244)
    header.closePanels()
    assert.equal(header.extraOpen?.(), null)
    header.toggleExtra?.(99)
    assert.equal(header.extraOpen?.(), null)
  } finally {
    injector.destroy()
  }
})

test('实际布局分配模块，关闭唯一公告移除空栏，目录仅在文章中占位，视口监听会清理', () => {
  const settings = signal(
    normalize({
      busuanzi: false,
      sidebarPositions: {
        profile: 'right',
        announcement: 'left',
        toc: 'right',
      },
      announcementEnable: true,
      announcementText: '侧栏公告',
      announcementLink: '',
      announcementClosable: true,
      sidebarStats: false,
      latestPosts: false,
      sidebarMoments: false,
      contactEnable: false,
      sidebarCategories: false,
      sidebarTags: false,
      articleToc: true,
    }),
  )
  const dismissed = signal(''),
    toc = signal<any[]>([]),
    events = new Subject<any>()
  const injector = createEnvironmentInjector(
    [
      {
        provide: BlogService,
        useValue: {
          config: { baseHref: '/blog/' },
          settings,
          categories: signal([]),
          tags: signal([]),
          toc,
          findPost: () => ({ hideSidebar: true }),
        },
      },
      { provide: ThemeService, useValue: {} },
      { provide: Router, useValue: { events } },
      {
        provide: AnnouncementStateService,
        useValue: {
          dismissed,
          dismiss: (version: string) => dismissed.set(version),
        },
      },
    ],
    null as any,
  )
  try {
    const app = injector.runInContext(() => new AppComponent()) as any
    assert.deepEqual(app.leftModules?.(), ['announcement'])
    assert.deepEqual(app.rightModules?.(), ['profile'])
    assert.equal(app.wideLayout?.(), true)
    media.matches = false
    mediaListeners.forEach((listener) => listener())
    assert.equal(app.desktop?.(), false)
    assert.equal(app.wideLayout?.(), false)
    assert.deepEqual(app.sidebarModules?.(), ['profile', 'announcement'])
    const announcement = injector.runInContext(
      () => new AnnouncementComponent(),
    )
    announcement.close()
    assert.deepEqual(app.leftModules?.(), [])
    assert.deepEqual(app.sidebarModules?.(), ['profile'])
    media.matches = true
    mediaListeners.forEach((listener) => listener())
    assert.equal(app.wideLayout?.(), false)
    toc.set([{ id: 'one', text: '第一节', level: 2 }])
    assert.deepEqual(app.rightModules?.(), ['profile', 'toc'])
    settings.set(
      normalize({
        ...settings(),
        sidebarPositions: { ...settings().sidebarPositions, toc: 'left' },
      }),
    )
    assert.equal(app.wideLayout?.(), true)
    events.next(new NavigationEnd(1, '/posts/full', '/posts/full'))
    assert.equal(app.hideSidebar(), true)
    assert.equal(app.wideLayout?.(), false)
  } finally {
    events.complete()
    injector.destroy()
  }
  assert.equal(mediaListeners.size, 0)
})

test('设置保存保留无父链接的分组、隐藏菜单和独立侧栏位置', async () => {
  let saved: any
  const errors: string[] = []
  const injector = createEnvironmentInjector(
    [
      {
        provide: AdminStore,
        useValue: {
          loadSettings: async () =>
            JSON.parse(
              JSON.stringify(
                normalize({
                  menus: extraFixture,
                  sidebarPositions: { stats: 'right', profile: 'hidden' },
                }),
              ),
            ),
          saveSettings: async (value: any) => {
            saved = JSON.parse(JSON.stringify(value))
          },
        },
      },
      {
        provide: BlogService,
        useValue: { config: { baseHref: '/blog/' }, setTitle() {} },
      },
      { provide: LocalDemoService, useValue: { active: () => true } },
      { provide: GitService, useValue: {} },
      { provide: ChangeDetectorRef, useValue: { markForCheck() {} } },
      {
        provide: ToastService,
        useValue: {
          success() {},
          error: (message: string) => errors.push(message),
        },
      },
    ],
    null as any,
  )
  try {
    const page = injector.runInContext(() => new SettingsPage())
    await new Promise((resolve) => setTimeout(resolve, 0))
    await page.save()
    assert.deepEqual(errors, [])
    assert.deepEqual(
      saved?.menus.map((item: any) => item.name),
      ['更多', '隐藏父项', '外部链接'],
    )
    assert.equal(saved.menus[0].children.length, 2)
    assert.equal(saved.menus[0].children[1].visible, false)
    assert.equal(saved.sidebarPositions.stats, 'right')
    assert.equal(saved.sidebarPositions.profile, 'hidden')
  } finally {
    injector.destroy()
  }
})

test('最新仓库旧格式方向不继承已部署的模块位置，保存后保留正确迁移', async () => {
  const published = signal(normalize({ sidebarReverse: false }))
  const latest = { ...fixture, sidebarReverse: true }
  delete latest.sidebarPositions
  let content = JSON.stringify(latest)
  const injector = createEnvironmentInjector(
    [
      AdminStore,
      {
        provide: BlogService,
        useValue: { settings: published, allPosts: signal([]) },
      },
      {
        provide: GitService,
        useValue: {
          getFile: async () => ({ content, sha: 'sha-' + content }),
          commit: async (changes: any[]) => {
            content = changes[0].content
          },
        },
      },
    ],
    null as any,
  )
  try {
    const store = injector.get(AdminStore)
    const loaded = normalizeThemeSettings(await store.loadSettings())
    assert.equal(loaded.sidebarPositions?.profile, 'right')
    assert.equal(loaded.sidebarPositions?.stats, 'right')
    await store.saveSettings(loaded)
    assert.equal(JSON.parse(content).sidebarPositions.profile, 'right')
    assert.equal(published().sidebarPositions.profile, 'right')
    content = JSON.stringify({
      ...latest,
      sidebarPositions: { profile: 'left' },
    })
    const overridden = normalizeThemeSettings(await store.loadSettings())
    assert.equal(overridden.sidebarPositions?.profile, 'left')
    assert.equal(overridden.sidebarPositions?.stats, 'right')
  } finally {
    injector.destroy()
  }
})

test('旧演示配置独立迁移侧栏方向，未启用覆盖时保留已部署设置', () => {
  let local: any = { sidebarReverse: true }
  const injector = createEnvironmentInjector(
    [
      BlogService,
      {
        provide: LocalDemoService,
        useValue: {
          readJson: (file: string, fallback: unknown) =>
            file === 'data/settings.json' ? (local ?? fallback) : fallback,
          read: () => undefined,
        },
      },
    ],
    null as any,
  )
  try {
    const blog = injector.get(BlogService)
    assert.equal(blog.settings().sidebarPositions?.profile, 'right')
    local = { sidebarReverse: false }
    blog.refreshDemo()
    assert.equal(blog.settings().sidebarPositions?.profile, 'left')
    local = null
    blog.refreshDemo()
    assert.equal(blog.settings().sidebarPositions?.profile, 'left')
  } finally {
    injector.destroy()
  }
})

test('Escape返回仍可见的桌面展开或手机菜单按钮，外部关闭不抢焦点', () => {
  const { injector, header } = makeHeader(normalize({ menus: extraFixture }))
  const focused: string[] = []
  const desktopButton = {
    isConnected: true,
    focus: () => focused.push('desktop'),
    getBoundingClientRect: () => ({ left: 160 }),
  }
  const mobileButton = {
    isConnected: true,
    focus: () => focused.push('mobile'),
  }
  try {
    header.toggleExtra(0, { currentTarget: desktopButton })
    header.onEscape?.()
    assert.equal(header.extraOpen(), null)
    assert.deepEqual(focused, ['desktop'])
    header.toggleMobile({ currentTarget: mobileButton })
    header.toggleExtra(0)
    header.onEscape?.()
    assert.equal(header.mobileOpen(), false)
    assert.equal(header.extraOpen(), null)
    assert.deepEqual(focused, ['desktop', 'mobile'])
    header.toggleExtra(0, { currentTarget: desktopButton })
    header.onDocClick({ target: {} })
    assert.deepEqual(focused, ['desktop', 'mobile'])
  } finally {
    injector.destroy()
  }
})
