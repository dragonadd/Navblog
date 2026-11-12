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
import { GitService } from '../src/app/services/git.service'
import { AdminStore } from '../src/app/admin/admin-store.service'
import { HeaderComponent } from '../src/app/components/header.component'
import { SearchPage } from '../src/app/pages/search.page'
import {
  normalizeMeta,
  parseFrontMatter,
  stringifyPost,
} from '../src/shared/frontmatter'

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

test('隐藏标记校验并在保存、读取和取消隐藏时保留正确状态', () => {
  const meta = normalizeMeta(
    { title: '隐藏内容', hidden: true },
    'hidden-post',
    '正文',
  )
  assert.equal((meta as any).hidden, true)
  const parsed = parseFrontMatter(stringifyPost(meta, '正文'))
  assert.equal(parsed.data.hidden, true)
  assert.equal(
    (normalizeMeta(parsed.data, 'hidden-post', parsed.body) as any).hidden,
    true,
  )
  for (const value of [false, 'false', undefined])
    assert.equal(
      (normalizeMeta({ hidden: value }, 'visible', '正文') as any).hidden,
      undefined,
    )
  assert.equal(
    (normalizeMeta({ hidden: 'true' }, 'hidden', '正文') as any).hidden,
    true,
  )
  for (const value of [1, 'yes', [], null])
    assert.throws(
      () => normalizeMeta({ hidden: value }, 'bad', '正文'),
      /hidden|隐藏/,
    )
  assert.equal(
    parseFrontMatter(stringifyPost({ ...meta, hidden: false } as any, '正文'))
      .data.hidden,
    undefined,
  )
})

test('隐藏文章不进入列表或分类标签，但标题可搜索、直链可访问；草稿继续排除', () => {
  const posts = [
    normalizeMeta(
      { title: '普通文章', category: '公开分类', tags: ['公开标签'] },
      'visible',
      '普通摘要',
    ),
    normalizeMeta(
      {
        title: '隐藏文章',
        hidden: true,
        category: '隐藏分类',
        tags: ['隐藏标签'],
      },
      'hidden',
      '隐藏摘要',
    ),
    normalizeMeta(
      { title: '隐藏草稿', hidden: true, draft: true },
      'draft',
      '草稿内容',
    ),
  ]
  const injector = createEnvironmentInjector(
    [
      BlogService,
      {
        provide: ɵEffectScheduler,
        useFactory: () => (ɵEffectScheduler as any).ɵprov.factory(),
      },
      { provide: ɵChangeDetectionScheduler, useValue: { notify() {} } },
      {
        provide: LocalDemoService,
        useValue: {
          readJson: (file: string, fallback: unknown) =>
            file === 'data/posts.json' ? posts : fallback,
          read: () => undefined,
        },
      },
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
  try {
    const blog = injector.get(BlogService)
    assert.deepEqual(
      blog.posts().map((p) => p.slug),
      ['visible'],
    )
    assert.deepEqual(
      blog.categories().map((c) => c.name),
      ['公开分类'],
    )
    assert.deepEqual(
      blog.tags().map((t) => t.name),
      ['公开标签'],
    )
    assert.deepEqual(blog.postsByCategory('隐藏分类'), [])
    assert.deepEqual(blog.postsByTag('隐藏标签'), [])
    assert.equal(blog.findPost('hidden')?.title, '隐藏文章')
    assert.equal(blog.findPost('draft'), undefined)
    const search = injector.runInContext(() => new SearchPage())
    search.kw.set('隐藏文章')
    assert.deepEqual(
      search.results().map((p) => p.slug),
      ['hidden'],
    )
    search.kw.set('隐藏草稿')
    assert.deepEqual(search.results(), [])
    const header = injector.runInContext(() => new HeaderComponent())
    header.kw.set('隐藏文章')
    assert.deepEqual(
      header.quickResults().map((p) => p.slug),
      ['hidden'],
    )
  } finally {
    injector.destroy()
  }
})

test('后台隐藏文章仍可编辑，取消隐藏后正文和其他文章保留', async () => {
  const files = new Map<string, string>([['data/posts.json', '[]']])
  const injector = createEnvironmentInjector(
    [
      AdminStore,
      { provide: BlogService, useValue: { allPosts: signal([]) } },
      {
        provide: GitService,
        useValue: {
          getFile: async (path: string) =>
            files.has(path)
              ? { content: files.get(path), sha: 'sha-' + path }
              : null,
          commit: async (
            changes: { path: string; content: string | null }[],
          ) => {
            for (const c of changes) {
              if (c.content === null) files.delete(c.path)
              else files.set(c.path, c.content)
            }
          },
        },
      },
    ],
    null as any,
  )
  try {
    const store = injector.get(AdminStore)
    const meta = {
      slug: 'hidden-edit',
      title: '可编辑隐藏文章',
      date: '2026-01-01',
      tags: [],
      hidden: true,
    }
    await store.savePost(meta, '保留正文')
    assert.equal((await store.loadPost(meta.slug))?.meta.hidden, true)
    assert.equal(JSON.parse(files.get('data/posts.json')!)[0].hidden, true)
    await store.savePost({ ...meta, hidden: false }, '保留正文', meta.slug)
    const loaded = await store.loadPost(meta.slug)
    assert.equal(loaded?.meta.hidden, undefined)
    assert.equal(loaded?.body.trim(), '保留正文')
  } finally {
    injector.destroy()
  }
})
