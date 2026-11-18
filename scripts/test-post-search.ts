import '@angular/compiler'
import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import {
  createEnvironmentInjector,
  ElementRef,
  signal,
  ɵEffectScheduler,
  ɵChangeDetectionScheduler,
} from '@angular/core'
import { Router } from '@angular/router'
import { BlogService } from '../src/app/services/blog.service'
import { LocalDemoService } from '../src/app/services/local-demo.service'
import { ThemeService } from '../src/app/services/theme.service'
import { ToastService } from '../src/app/services/toast.service'
import { HeaderComponent } from '../src/app/components/header.component'
import { SearchPage } from '../src/app/pages/search.page'

const original = Object.getOwnPropertyDescriptor(globalThis, 'document')
beforeEach(() =>
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { baseURI: 'https://example.com/blog/', title: '' },
  }),
)
afterEach(() => {
  if (original) Object.defineProperty(globalThis, 'document', original)
  else Reflect.deleteProperty(globalThis, 'document')
})
function searchFixture() {
  const posts = [
    {
      slug: 'encrypted',
      title: 'Locked TITLE',
      date: '2026-01-01',
      tags: ['LOCKED_TAG'],
      category: 'LOCKED_CATEGORY',
      summary: 'LOCKED_SUMMARY',
      encrypted: true,
    },
    {
      slug: 'hidden-encrypted',
      title: 'Another Private Title',
      date: '2026-01-01',
      tags: [],
      hidden: true,
      encrypted: true,
    },
    {
      slug: 'normal',
      title: 'Normal Title',
      date: '2026-01-01',
      tags: ['NORMAL_TAG'],
      category: 'NORMAL_CATEGORY',
      summary: 'Normal summary content',
    },
    {
      slug: 'draft',
      title: 'Draft Title',
      date: '2026-01-01',
      tags: [],
      draft: true,
    },
  ]
  const injector = createEnvironmentInjector(
    [
      BlogService,
      {
        provide: LocalDemoService,
        useValue: {
          readJson: (file: string, fallback: unknown) =>
            file === 'data/posts.json' ? posts : fallback,
          read: () => undefined,
        },
      },
      {
        provide: ɵEffectScheduler,
        useFactory: () => (ɵEffectScheduler as any).ɵprov.factory(),
      },
      { provide: ɵChangeDetectionScheduler, useValue: { notify() {} } },
      { provide: Router, useValue: { navigate() {} } },
      {
        provide: ThemeService,
        useValue: { dark: signal(false), hue: signal(52) },
      },
      { provide: ToastService, useValue: {} },
      { provide: ElementRef, useValue: { nativeElement: {} } },
    ],
    null as any,
  )
  return {
    injector,
    blog: injector.get(BlogService),
    header: injector.runInContext(() => new HeaderComponent()),
    page: injector.runInContext(() => new SearchPage()),
  }
}

test('顶栏和搜索页的加密文章只匹配标题，摘要分类标签和正文密文均不能命中', () => {
  const f = searchFixture()
  try {
    for (const query of [
      'LOCKED_SUMMARY',
      'LOCKED_CATEGORY',
      'LOCKED_TAG',
      'PRIVATE_BODY',
      'ciphertext',
    ]) {
      f.header.kw.set(query)
      f.page.kw.set(query)
      assert.deepEqual(f.header.quickResults(), [], query)
      assert.deepEqual(f.page.results(), [], query)
    }
    f.header.kw.set('locked')
    f.page.kw.set('locked')
    assert.deepEqual(
      f.header.quickResults().map((p) => p.slug),
      ['encrypted'],
    )
    assert.deepEqual(
      f.page.results().map((p) => p.slug),
      ['encrypted'],
    )
    f.blog.toc.set([{ id: 'private-heading', text: 'PRIVATE_BODY', level: 2 }])
    f.header.kw.set('PRIVATE_BODY')
    f.page.kw.set('PRIVATE_BODY')
    assert.deepEqual(f.header.quickResults(), [])
    assert.deepEqual(f.page.results(), [])
  } finally {
    f.injector.destroy()
  }
})

test('普通文章仍匹配摘要分类标签，标题忽略大小写并支持多关键词，草稿排除且隐藏加密标题可搜索', () => {
  const f = searchFixture()
  try {
    for (const query of ['NORMAL_TAG', 'NORMAL_CATEGORY', 'summary content']) {
      f.header.kw.set(query)
      f.page.kw.set(query)
      assert.deepEqual(
        f.page.results().map((p) => p.slug),
        ['normal'],
      )
      assert.deepEqual(
        f.header.quickResults().map((p) => p.slug),
        ['normal'],
      )
    }
    f.header.kw.set(' TITLE   LOCKED ')
    f.page.kw.set(' TITLE   LOCKED ')
    assert.deepEqual(
      f.page.results().map((p) => p.slug),
      ['encrypted'],
    )
    assert.deepEqual(
      f.header.quickResults().map((p) => p.slug),
      ['encrypted'],
    )
    f.header.kw.set('another private')
    f.page.kw.set('another private')
    assert.deepEqual(
      f.header.quickResults().map((p) => p.slug),
      ['hidden-encrypted'],
    )
    assert.deepEqual(
      f.page.results().map((p) => p.slug),
      ['hidden-encrypted'],
    )
    for (const query of ['', '   ', 'Draft']) {
      f.page.kw.set(query)
      assert.deepEqual(f.page.results(), [])
    }
  } finally {
    f.injector.destroy()
  }
})
