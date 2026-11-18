import '@angular/compiler'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createEnvironmentInjector, signal } from '@angular/core'
import { AdminStore } from '../src/app/admin/admin-store.service'
import { BlogService } from '../src/app/services/blog.service'
import { GitService } from '../src/app/services/git.service'
import { stringifyPost } from '../src/shared/frontmatter'

const meta = { slug: 'first', title: '原文章', date: '2026-11-11', tags: [] }
function setup() {
  const files = new Map<string, string>([
    ['data/posts/first.md', stringifyPost(meta, '原正文')],
    ['data/posts.json', JSON.stringify([meta])],
    ['data/settings.json', JSON.stringify({ title: '原标题', menus: [] })],
    ['data/about.md', '原关于页'],
  ])
  let commits = 0
  const changes: any[][] = []
  const git = {
    getFile: async (path: string) =>
      files.has(path)
        ? {
            content: files.get(path)!,
            sha: 'version-' + files.get(path)!,
            lastCommit: 'commit-' + files.get(path)!,
          }
        : null,
    commit: async (items: any[]) => {
      for (const c of items)
        if (
          c.expectedContent !== undefined &&
          (files.get(c.path) ?? null) !== c.expectedContent
        )
          throw new Error('版本冲突')
      commits++
      changes.push(items)
      for (const c of items) {
        if (c.content === null) files.delete(c.path)
        else files.set(c.path, c.content)
      }
    },
  }
  const create = () => {
    const injector = createEnvironmentInjector(
      [
        AdminStore,
        { provide: GitService, useValue: git },
        {
          provide: BlogService,
          useValue: {
            allPosts: signal([meta]),
            settings: signal({ title: '原标题', menus: [] }),
          },
        },
      ],
      null as any,
    )
    return { injector, store: injector.get(AdminStore) }
  }
  return { files, create, changes, commits: () => commits }
}
test('文章旧编辑窗口不能覆盖新正文，成功保存后可再次保存', async () => {
  const s = setup(),
    a = s.create(),
    b = s.create()
  try {
    await a.store.loadPost('first')
    await b.store.loadPost('first')
    await a.store.savePost(meta, 'A 的新正文', 'first')
    await assert.rejects(
      b.store.savePost(meta, 'B 的旧草稿', 'first'),
      /修改|冲突/,
    )
    assert.ok(s.files.get('data/posts/first.md')!.includes('A 的新正文'))
    await a.store.savePost(meta, 'A 再次保存', 'first')
    assert.ok(s.files.get('data/posts/first.md')!.includes('A 再次保存'))
    assert.equal(s.commits(), 2)
  } finally {
    a.injector.destroy()
    b.injector.destroy()
  }
})
test('设置和关于页的旧版本拒绝覆盖，输入数据不被修改', async () => {
  const s = setup(),
    a = s.create(),
    b = s.create()
  try {
    const one = await a.store.loadSettings(),
      two = await b.store.loadSettings()
    await a.store.loadAbout()
    await b.store.loadAbout()
    await a.store.saveSettings({ ...one, title: 'A 的新标题' })
    await assert.rejects(
      b.store.saveSettings({ ...two, title: '旧版本新标题' }),
      /修改|冲突/,
    )
    assert.equal(two.title, '原标题')
    assert.equal(
      JSON.parse(s.files.get('data/settings.json')!).title,
      'A 的新标题',
    )
    await a.store.saveAbout('A 的关于页')
    await assert.rejects(b.store.saveAbout('旧窗口关于页'), /修改|冲突/)
    assert.equal(s.files.get('data/about.md'), 'A 的关于页')
  } finally {
    a.injector.destroy()
    b.injector.destroy()
  }
})
test('改 slug 与文章索引一起条件更新，不丢其他文章', async () => {
  const s = setup(),
    a = s.create()
  try {
    await a.store.loadPost('first')
    const second = { ...meta, slug: 'second', title: '另一篇' }
    s.files.set('data/posts.json', JSON.stringify([meta, second]))
    await a.store.savePost({ ...meta, slug: 'renamed' }, '重命名正文', 'first')
    assert.equal(s.files.has('data/posts/first.md'), false)
    assert.deepEqual(
      JSON.parse(s.files.get('data/posts.json')!)
        .map((p: any) => p.slug)
        .sort(),
      ['renamed', 'second'],
    )
    assert.ok(
      s.changes[0].every(
        (c) => c.expectedSha !== undefined && c.expectedContent !== undefined,
      ),
    )
  } finally {
    a.injector.destroy()
  }
})
test('损坏索引停止保存且不改正文', async () => {
  const s = setup(),
    a = s.create()
  try {
    await a.store.loadPost('first')
    const original = s.files.get('data/posts/first.md')
    s.files.set('data/posts.json', '{')
    await assert.rejects(
      a.store.savePost(meta, '不应保存', 'first'),
      /索引|JSON/,
    )
    assert.equal(s.files.get('data/posts/first.md'), original)
    assert.equal(s.commits(), 0)
  } finally {
    a.injector.destroy()
  }
})

test('已有顶层文件名中的点号和空格不阻断后台保存', async () => {
  const s = setup(),
    a = s.create()
  try {
    const imported = { ...meta, slug: 'old post.v2', title: '导入文章' }
    s.files.set('data/posts.json', JSON.stringify([meta, imported]))
    await a.store.loadIndex()
    await a.store.loadPost('first')
    await a.store.savePost(meta, '正常文章仍可修改', 'first')
    assert.ok(
      JSON.parse(s.files.get('data/posts.json')!).some(
        (p: any) => p.slug === imported.slug,
      ),
    )
  } finally {
    a.injector.destroy()
  }
})

test('索引不能指定目录越界文件名', async () => {
  const s = setup(),
    a = s.create()
  try {
    for (const slug of [
      '../private',
      '..\\private',
      '.',
      '..',
      '',
      'bad\u0000name',
      'bad\nname',
    ]) {
      s.files.set('data/posts.json', JSON.stringify([{ ...meta, slug }]))
      await assert.rejects(a.store.loadIndex(), /索引/)
    }
  } finally {
    a.injector.destroy()
  }
})
