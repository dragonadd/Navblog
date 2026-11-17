import '@angular/compiler'
import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import {
  createEnvironmentInjector,
  signal,
  ɵChangeDetectionScheduler,
  ɵEffectScheduler,
} from '@angular/core'
import { NavigationEnd, Router } from '@angular/router'
import { ViewportScroller } from '@angular/common'
import { DomSanitizer } from '@angular/platform-browser'
import { Subject } from 'rxjs'
import { AppComponent } from '../src/app/app.component'
import { PostPage } from '../src/app/pages/post.page'
import { BlogService } from '../src/app/services/blog.service'
import { ThemeService } from '../src/app/services/theme.service'
import { ToastService } from '../src/app/services/toast.service'
import { AnnouncementStateService } from '../src/app/services/announcement-state.service'

const originals = new Map(
  ['document', 'location', 'window'].map((k) => [
    k,
    Object.getOwnPropertyDescriptor(globalThis, k),
  ]),
)
function globals(pathname: string, desktop = true) {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      matchMedia: () => ({
        matches: desktop,
        addEventListener() {},
        removeEventListener() {},
      }),
    },
  })
  Object.defineProperty(globalThis, 'location', {
    configurable: true,
    value: { pathname, hash: '' },
  })
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { getElementById() {}, addEventListener() {} },
  })
}
afterEach(() => {
  for (const [k, value] of originals) {
    if (value) Object.defineProperty(globalThis, k, value)
    else Reflect.deleteProperty(globalThis, k)
  }
})

test('首页和分页整体叠加滚动，桌面文章独立滚动，部署子路径和后台匹配正确', () => {
  for (const [base, path, admin, hero, fixed, desktop] of [
    ['/', '/', false, true, false, true],
    ['/', '/page/2', false, true, false, true],
    ['/', '/posts/admin', false, false, true, true],
    ['/', '/categories/admin', false, false, false, true],
    ['/', '/tags/admin', false, false, false, true],
    ['/', '/admin/settings', true, false, false, true],
    ['/blog/', '/blog/admin/login', true, false, false, true],
    ['/admin/', '/admin/', false, true, false, true],
    ['/blog/', '/blog/page/2', false, true, false, true],
    ['/blog/', '/blog/posts/admin', false, false, true, true],
    ['/', '/', false, true, false, false],
    ['/', '/posts/admin', false, false, false, false],
  ] as const) {
    globals(path, desktop)
    const events = new Subject<any>()
    const injector = createEnvironmentInjector(
      [
        { provide: Router, useValue: { events } },
        { provide: ThemeService, useValue: {} },
        {
          provide: AnnouncementStateService,
          useValue: { dismissed: signal('') },
        },
        {
          provide: BlogService,
          useValue: {
            config: { baseHref: base },
            settings: signal({ heroEnable: true }),
            findPost: () => ({ hideSidebar: false }),
          },
        },
      ],
      null as any,
    )
    try {
      const app = injector.runInContext(() => new AppComponent())
      assert.equal(app.isAdmin(), admin, path)
      assert.equal(app.showHero(), hero, path)
      assert.equal(app.fixedLayout(), fixed, path)
      events.next(new NavigationEnd(1, '/posts/admin?x=1', '/posts/admin?x=1'))
      assert.equal(app.isAdmin(), false)
      events.next(new NavigationEnd(2, '/admin/settings', '/admin/settings'))
      assert.equal(app.isAdmin(), true)
      assert.equal(app.fixedLayout(), false)
      events.next(new NavigationEnd(3, '/', '/'))
      app.settings.set({ ...app.settings(), heroEnable: false })
      assert.equal(app.showHero(), false)
      assert.equal(app.fixedLayout(), false)
    } finally {
      events.complete()
      injector.destroy()
    }
  }
})

test('文章锚点通过页面滚动服务恢复，路由复用至404清除目录并使旧加载失效', async () => {
  globals('/posts/first')
  location.hash = '#' + encodeURIComponent('第一节')
  const anchors: string[] = []
  const slug = signal('first'),
    toc = signal<any[]>([]),
    comments = signal(false)
  let pending = false,
    finish: (body: string) => void = () => {}
  const source =
    '---\ntitle: 文章\ndate: 2026-11-11\ntags: []\n---\n## 第一节\n正文'
  const post = { slug: 'first', title: '文章', date: '2026-11-11', tags: [] }
  const injector = createEnvironmentInjector(
    [
      {
        provide: ɵEffectScheduler,
        useFactory: () => (ɵEffectScheduler as any).ɵprov.factory(),
      },
      { provide: ɵChangeDetectionScheduler, useValue: { notify() {} } },
      {
        provide: BlogService,
        useValue: {
          config: { siteUrl: '', baseHref: '/' },
          settings: signal({}),
          toc,
          commentsVisible: comments,
          posts: signal([post]),
          findPost: (id: string) => (id === 'first' ? post : undefined),
          setTitle() {},
          url: (p: string) => p,
          getPostSource: async () =>
            pending
              ? new Promise<string>((resolve) => {
                  finish = resolve
                })
              : source,
        },
      },
      { provide: ToastService, useValue: {} },
      {
        provide: ViewportScroller,
        useValue: { scrollToAnchor: (id: string) => anchors.push(id) },
      },
      {
        provide: DomSanitizer,
        useValue: { bypassSecurityTrustHtml: (html: string) => html },
      },
    ],
    null as any,
  )
  try {
    const page = injector.runInContext(() => new PostPage())
    ;(page as any).slug = slug
    const scheduler = injector.get(ɵEffectScheduler)
    scheduler.flush()
    await Promise.resolve()
    await Promise.resolve()
    scheduler.flush()
    assert.equal(toc().length, 1)
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
    assert.deepEqual(anchors, ['第一节'])
    location.hash = ''
    slug.set('missing')
    scheduler.flush()
    assert.deepEqual(toc(), [])
    assert.equal(page.html(), '')
    assert.equal(page.loading(), false)
    pending = true
    slug.set('first')
    scheduler.flush()
    slug.set('missing')
    scheduler.flush()
    finish(source)
    await Promise.resolve()
    await Promise.resolve()
    scheduler.flush()
    assert.deepEqual(toc(), [])
    assert.equal(page.html(), '')
    page.ngOnDestroy()
  } finally {
    injector.destroy()
  }
})
