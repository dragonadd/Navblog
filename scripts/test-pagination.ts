import '@angular/compiler'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  createEnvironmentInjector,
  signal,
  ɵChangeDetectionScheduler,
  ɵEffectScheduler,
} from '@angular/core'
import { HomePage } from '../src/app/pages/home.page'
import { BlogService } from '../src/app/services/blog.service'
import { normalizeThemeSettings } from '../src/shared/theme-settings'

function fixture(size?: number, total = 5) {
  const settings = signal({ postsPerPage: size, listMode: 'page' })
  const route = signal('1')
  const posts = signal(
    Array.from({ length: total }, (_, index) => {
      const slug =
        ['one', 'two', 'three', 'four', 'five'][index] || `post-${index + 1}`
      return { slug, title: slug, date: '2026-11-16', tags: [] }
    }),
  )
  const titles: (string | undefined)[] = []
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
          settings,
          posts,
          setTitle(title?: string) {
            titles.push(title)
          },
        },
      },
    ],
    null as any,
  )
  const page = injector.runInContext(() => new HomePage())
  ;(page as any).page = route
  injector.get(ɵEffectScheduler).flush()
  return { settings, route, posts, injector, page, titles }
}

test('分页默认每页5篇，8篇文章分为5篇和3篇', () => {
  assert.equal(normalizeThemeSettings({}).postsPerPage, 5)
  assert.equal(normalizeThemeSettings({ postsPerPage: 3 }).postsPerPage, 3)
  const f = fixture(undefined, 8)
  try {
    assert.equal(f.page.size(), 5)
    assert.equal(f.page.totalPages(), 2)
    assert.equal(f.page.list().length, 5)
    f.route.set('2')
    assert.deepEqual(
      f.page.list().map((post) => post.slug),
      ['post-6', 'post-7', 'post-8'],
    )
  } finally {
    f.injector.destroy()
  }
})

test('切换为无分页自动加载后，旧分页地址不再设置分页标题', () => {
  const f = fixture(1)
  try {
    f.route.set('2')
    f.injector.get(ɵEffectScheduler).flush()
    assert.equal(f.titles.at(-1), '第 2 页')
    f.settings.set({ postsPerPage: 1, listMode: 'scroll' })
    f.injector.get(ɵEffectScheduler).flush()
    assert.equal(f.titles.at(-1), undefined)
  } finally {
    f.injector.destroy()
  }
})

test('5篇文章每页3篇时，第一页3篇，第二页仅显示余下2篇', () => {
  const f = fixture(3)
  try {
    assert.equal(f.page.totalPages(), 2)
    assert.deepEqual(
      f.page.list().map((post) => post.slug),
      ['one', 'two', 'three'],
    )
    f.route.set('2')
    assert.deepEqual(
      f.page.list().map((post) => post.slug),
      ['four', 'five'],
    )
    f.route.set('99')
    assert.equal(f.page.current(), 2)
    assert.deepEqual(
      f.page.list().map((post) => post.slug),
      ['four', 'five'],
    )
  } finally {
    f.injector.destroy()
  }
})

test('后台数量变化立即重新分页，每页1篇不会累计显示其他页文章', () => {
  const f = fixture(1)
  try {
    assert.equal(f.page.totalPages(), 5)
    assert.deepEqual(
      f.page.list().map((post) => post.slug),
      ['one'],
    )
    f.route.set('2')
    assert.deepEqual(
      f.page.list().map((post) => post.slug),
      ['two'],
    )
    f.settings.set({ postsPerPage: 3, listMode: 'page' })
    assert.equal(f.page.totalPages(), 2)
    assert.deepEqual(
      f.page.list().map((post) => post.slug),
      ['four', 'five'],
    )
    f.route.set('1')
    assert.deepEqual(
      f.page.list().map((post) => post.slug),
      ['one', 'two', 'three'],
    )
    f.settings.set({ postsPerPage: 2, listMode: 'page' })
    assert.equal(f.page.totalPages(), 3)
    assert.deepEqual(
      f.page.list().map((post) => post.slug),
      ['one', 'two'],
    )
    f.posts.set([])
    assert.equal(f.page.totalPages(), 1)
    assert.deepEqual(f.page.list(), [])
  } finally {
    f.injector.destroy()
  }
})
