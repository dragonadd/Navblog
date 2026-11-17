import '@angular/compiler'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  createEnvironmentInjector,
  ElementRef,
  signal,
  ɵChangeDetectionScheduler,
  ɵEffectScheduler,
} from '@angular/core'
import { ScrollPostListComponent } from '../src/app/components/scroll-post-list.component'
import { BlogService } from '../src/app/services/blog.service'

function fixture(withIntersection = true) {
  const keys = [
    'window',
    'document',
    'requestAnimationFrame',
    'cancelAnimationFrame',
    'IntersectionObserver',
    'ResizeObserver',
    'getComputedStyle',
  ]
  const originals = new Map(
    keys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
  )
  const frames = new Map<number, FrameRequestCallback>()
  const listeners = new Map<string, () => void>()
  const viewport = {
    innerHeight: 720,
    addEventListener(name: string, callback: () => void) {
      listeners.set(name, callback)
    },
    removeEventListener(name: string) {
      listeners.delete(name)
    },
  }
  const card = {
    height: 200,
    getBoundingClientRect() {
      return { height: this.height }
    },
  }
  const host = {
    closest() {
      return scrollRoot
    },
    querySelector(selector: string) {
      return selector === 'article' ? card : {}
    },
  }
  let scrollRoot: {
    clientHeight: number
    getBoundingClientRect(): { bottom: number }
  } | null = null
  const target = {
    top: 5000,
    getBoundingClientRect() {
      return { top: this.top }
    },
  }
  const observers: Intersection[] = []
  let resizeCallback = () => {}
  let resizeDisconnected = false
  let frameId = 0
  class Intersection {
    constructor(
      readonly callback: (entries: IntersectionObserverEntry[]) => void,
    ) {
      observers.push(this)
    }
    observe() {}
    disconnect() {}
    intersect() {
      this.callback([{ isIntersecting: true } as IntersectionObserverEntry])
    }
  }
  const globals: Record<string, unknown> = {
    window: viewport,
    document: viewport,
    requestAnimationFrame(callback: FrameRequestCallback) {
      const id = ++frameId
      frames.set(id, callback)
      return id
    },
    cancelAnimationFrame(id: number) {
      frames.delete(id)
    },
    IntersectionObserver: withIntersection ? Intersection : undefined,
    ResizeObserver: class {
      constructor(callback: () => void) {
        resizeCallback = callback
      }
      observe() {}
      disconnect() {
        resizeDisconnected = true
      }
    },
    getComputedStyle() {
      return { rowGap: '16px' }
    },
  }
  for (const [key, value] of Object.entries(globals))
    Object.defineProperty(globalThis, key, { configurable: true, value })
  const settings = signal({ postsPerPage: 1 })
  const posts = signal(
    Array.from({ length: 20 }, (_, index) => ({
      slug: `post-${index + 1}`,
      title: `文章 ${index + 1}`,
      date: '2026-11-16',
      tags: [],
    })),
  )
  const query = signal('')
  const injector = createEnvironmentInjector(
    [
      {
        provide: ɵEffectScheduler,
        useFactory: () => (ɵEffectScheduler as any).ɵprov.factory(),
      },
      { provide: ɵChangeDetectionScheduler, useValue: { notify() {} } },
      { provide: BlogService, useValue: { settings } },
      { provide: ElementRef, useValue: new ElementRef(host) },
    ],
    null as any,
  )
  const list = injector.runInContext(() => new ScrollPostListComponent())
  ;(list as any).posts = posts
  ;(list as any).query = query
  ;(list as any).sentinel = () => ({ nativeElement: target })
  function flush() {
    injector.get(ɵEffectScheduler).flush()
    let turns = 0
    while (frames.size) {
      assert(++turns < 20, '自动加载不应无限重复安排帧')
      const callbacks = [...frames.values()]
      frames.clear()
      for (const callback of callbacks) callback(0)
      injector.get(ɵEffectScheduler).flush()
    }
  }
  list.ngAfterViewInit()
  flush()
  function destroy() {
    list.ngOnDestroy()
    injector.destroy()
    assert.equal(frames.size, 0)
    assert.equal(listeners.size, 0)
    assert.equal(resizeDisconnected, true)
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else Reflect.deleteProperty(globalThis, key)
    }
  }
  return {
    list,
    settings,
    posts,
    query,
    viewport,
    card,
    observers,
    flush,
    destroy,
    scrollPastSentinel() {
      target.top = -100
      listeners.get('scroll')?.()
      flush()
    },
    resize(height: number, cardHeight = card.height) {
      viewport.innerHeight = height
      card.height = cardHeight
      listeners.get('resize')?.()
      resizeCallback()
      flush()
    },
    useScrollRoot(height: number) {
      scrollRoot = {
        clientHeight: height,
        getBoundingClientRect: () => ({ bottom: 400 }),
      }
      listeners.get('resize')?.()
      flush()
      posts.set([...posts()])
      flush()
    },
  }
}

test('自动加载按屏幕可见范围显示，不受分页篇数影响', () => {
  const f = fixture()
  try {
    assert.equal(f.list.visible().length, 4)
    f.settings.set({ postsPerPage: 99 })
    f.flush()
    assert.equal(f.list.visible().length, 4)
    f.resize(1440)
    assert.equal(f.list.visible().length, 7)
    f.resize(360, 400)
    assert.equal(f.list.visible().length, 7)
  } finally {
    f.destroy()
  }
})

test('独立滚动区域按自身可见高度分批加载', () => {
  const f = fixture()
  try {
    f.useScrollRoot(300)
    assert.equal(f.list.batchSize(), 2)
    assert.equal(f.list.visible().length, 2)
    f.list.more()
    f.flush()
    assert.equal(f.list.visible().length, 4)
  } finally {
    f.destroy()
  }
})

test('滚动到列表末端按屏幕追加，保留顺序并在全部加载后停止', () => {
  const f = fixture()
  try {
    const staleObserver = f.observers.at(-1)!
    staleObserver.intersect()
    f.flush()
    assert.equal(f.list.visible().length, 8)
    staleObserver.intersect()
    f.flush()
    assert.equal(f.list.visible().length, 8)
    while (f.list.hasMore()) {
      f.observers.at(-1)!.intersect()
      f.flush()
    }
    assert.deepEqual(
      f.list.visible().map((post) => post.slug),
      f.posts().map((post) => post.slug),
    )
    const count = f.list.count()
    f.list.more()
    assert.equal(f.list.count(), count)
    f.list.ngOnDestroy()
    f.observers.at(-1)!.intersect()
    assert.equal(f.list.count(), count)
  } finally {
    f.destroy()
  }
})

test('搜索条件或文章集合变化后从首批开始，空列表不触发追加', () => {
  const f = fixture()
  try {
    f.list.more()
    f.flush()
    assert.equal(f.list.visible().length, 8)
    f.query.set('新条件')
    f.flush()
    assert.equal(f.list.visible().length, 4)
    f.posts.set(f.posts().slice(0, 2))
    f.flush()
    assert.equal(f.list.visible().length, 2)
    assert.equal(f.list.hasMore(), false)
    f.posts.set([])
    f.flush()
    assert.deepEqual(f.list.visible(), [])
    assert.equal(f.list.hasMore(), false)
  } finally {
    f.destroy()
  }
})

test('浏览器不支持自动观察时仍可点击加载更多', () => {
  const f = fixture(false)
  try {
    assert.equal(f.list.visible().length, 4)
    f.list.more()
    f.flush()
    assert.equal(f.list.visible().length, 8)
  } finally {
    f.destroy()
  }
})

test('快速滑过整个加载按钮后仍能追加，不停在未加载的文章之前', () => {
  const f = fixture()
  try {
    assert.equal(f.list.visible().length, 4)
    f.scrollPastSentinel()
    assert.equal(f.list.visible().length, 20)
    assert.equal(f.list.hasMore(), false)
  } finally {
    f.destroy()
  }
})
