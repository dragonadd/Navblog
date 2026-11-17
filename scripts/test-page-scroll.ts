import '@angular/compiler'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DOCUMENT, ViewportScroller } from '@angular/common'
import { createEnvironmentInjector, signal } from '@angular/core'
import { PageViewportScroller } from '../src/app/services/page-scroll.service'
import { TocComponent } from '../src/app/components/toc.component'
import { BlogService } from '../src/app/services/blog.service'

function fixture() {
  const calls: { target: string; options: ScrollToOptions }[] = []
  const browser = {
    scrollX: 3,
    scrollY: 120,
    history: { scrollRestoration: 'auto' },
    scrollTo(options: ScrollToOptions) {
      calls.push({ target: 'window', options })
    },
  }
  const content = {
    scrollLeft: 5,
    scrollTop: 300,
    getBoundingClientRect: () => ({ top: 76 }),
    scrollTo(options: ScrollToOptions) {
      calls.push({ target: 'content', options })
    },
  }
  let root: typeof content | null = content
  let focused = false
  const anchor = {
    getBoundingClientRect: () => ({ top: 176 }),
    focus(options: FocusOptions) {
      focused = options.preventScroll === true
    },
  }
  const document = {
    defaultView: browser,
    querySelector: () => root,
    querySelectorAll: () =>
      ['left', 'right'].map((target) => ({
        scrollTo(options: ScrollToOptions) {
          calls.push({ target, options })
        },
      })),
    getElementById: (id: string) => (id === 'heading' ? anchor : null),
    getElementsByName: () => [],
  }
  const injector = createEnvironmentInjector(
    [{ provide: DOCUMENT, useValue: document }],
    null as any,
  )
  const scroller = injector.runInContext(() => new PageViewportScroller())
  return {
    injector,
    scroller,
    calls,
    useWindow: () => {
      root = null
    },
    focused: () => focused,
    browser,
  }
}

test('固定布局读取并滚动正文区域，切换页面时重置正文与两侧栏', () => {
  const f = fixture()
  try {
    assert.deepEqual(f.scroller.getScrollPosition(), [5, 300])
    f.scroller.scrollToPosition([0, 400])
    assert.deepEqual(f.calls, [
      {
        target: 'content',
        options: { left: 0, top: 400, behavior: 'instant' },
      },
    ])
    f.calls.length = 0
    f.scroller.scrollToPosition([0, 0])
    assert.deepEqual(
      f.calls.map((call) => call.target),
      ['content', 'left', 'right'],
    )
    assert.equal(f.calls[1].options.top, 0)
    assert.equal(f.calls[2].options.top, 0)
  } finally {
    f.injector.destroy()
  }
})

test('目录锚点按正文区域计算位置并保留上方间距', () => {
  const f = fixture()
  try {
    f.scroller.scrollToAnchor('heading', { behavior: 'smooth' })
    assert.deepEqual(f.calls, [
      { target: 'content', options: { top: 384, behavior: 'smooth' } },
    ])
    assert.equal(f.focused(), true)
    f.scroller.setOffset(() => [0, 10])
    f.scroller.scrollToAnchor('heading')
    assert.equal(f.calls.at(-1)?.options.top, 374)
    const count = f.calls.length
    f.scroller.scrollToAnchor('missing')
    assert.equal(f.calls.length, count)
  } finally {
    f.injector.destroy()
  }
})

test('普通页面仍滚动窗口并避开导航，浏览器历史恢复由路由管理', () => {
  const f = fixture()
  try {
    f.useWindow()
    assert.deepEqual(f.scroller.getScrollPosition(), [3, 120])
    f.scroller.scrollToPosition([0, 50])
    assert.equal(f.calls[0].target, 'window')
    assert.equal(f.calls[0].options.top, 50)
    f.scroller.setOffset([0, 20])
    f.scroller.scrollToAnchor('heading')
    assert.deepEqual(f.calls[1], {
      target: 'window',
      options: { top: 196, behavior: 'instant' },
    })
    f.scroller.setHistoryScrollRestoration('manual')
    assert.equal(f.browser.history.scrollRestoration, 'manual')
  } finally {
    f.injector.destroy()
  }
})

function tocFixture() {
  const page = fixture()
  const originals = new Map(
    ['location', 'history'].map((key) => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    ]),
  )
  const state = { navigationId: 42, reader: 'current' }
  const replacements: { state: unknown; url: string }[] = []
  Object.defineProperty(globalThis, 'location', {
    configurable: true,
    value: { pathname: '/blog/posts/example', search: '?view=reader' },
  })
  Object.defineProperty(globalThis, 'history', {
    configurable: true,
    value: {
      state,
      replaceState(value: unknown, _title: string, url: string) {
        replacements.push({ state: value, url })
      },
    },
  })
  const injector = createEnvironmentInjector(
    [
      { provide: ViewportScroller, useValue: page.scroller },
      { provide: BlogService, useValue: { toc: signal([]) } },
    ],
    page.injector,
  )
  const toc = injector.runInContext(() => new TocComponent())
  return {
    page,
    toc,
    state,
    replacements,
    destroy() {
      injector.destroy()
      page.injector.destroy()
      for (const [key, descriptor] of originals) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor)
        else Reflect.deleteProperty(globalThis, key)
      }
    },
  }
}

test('目录点击滚动正文，链接保留文章、子路径和查询参数，不清除路由历史状态', () => {
  const f = tocFixture()
  try {
    let prevented = false
    let navigated = 0
    f.toc.navigate.subscribe(() => navigated++)
    f.toc.go(
      { preventDefault: () => (prevented = true) } as unknown as Event,
      'heading',
    )
    assert.equal(prevented, true)
    assert.equal(navigated, 1)
    assert.deepEqual(f.page.calls, [
      { target: 'content', options: { top: 384, behavior: 'smooth' } },
    ])
    assert.deepEqual(f.replacements, [
      { state: f.state, url: '/blog/posts/example?view=reader#heading' },
    ])
    assert.equal(
      f.toc.anchorHref('章节 / #一'),
      '/blog/posts/example?view=reader#' + encodeURIComponent('章节 / #一'),
    )
  } finally {
    f.destroy()
  }
})

test('手机目录通过窗口滚动定位，只扣除一次导航间距', () => {
  const f = tocFixture()
  try {
    f.page.useWindow()
    f.toc.go({ preventDefault() {} } as Event, 'heading')
    assert.deepEqual(f.page.calls, [
      { target: 'window', options: { top: 216, behavior: 'smooth' } },
    ])
    assert.equal(f.page.focused(), true)
  } finally {
    f.destroy()
  }
})
