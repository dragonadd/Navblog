import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as moments from '../src/shared/moments'
import { momentsHtml } from './lib'
import '@angular/compiler'
import { createEnvironmentInjector, signal } from '@angular/core'
import { AdminStore } from '../src/app/admin/admin-store.service'
import { BlogService } from '../src/app/services/blog.service'
import { GitService } from '../src/app/services/git.service'

const one = {
  id: 'first',
  date: '2026-11-10T08:00:00+08:00',
  text: '第一行\n第二行 😀',
}
test('动态保留换行并按真实时间倒序，不修改输入', () => {
  assert.equal(typeof moments.parseMoments, 'function')
  const two = {
    ...one,
    id: 'second',
    date: '2026-11-10T01:00:00Z',
    text: '<script>alert(1)</script>',
  }
  const result = moments.parseMoments(JSON.stringify([one, two]))
  assert.deepEqual(
    result.map((m) => m.id),
    ['second', 'first'],
  )
  assert.equal(result[1].text, one.text)
  assert.equal(result[0].text, two.text)
  assert.equal(one.text, '第一行\n第二行 😀')
  assert.deepEqual(moments.parseMoments('[]'), [])
})
test('损坏数据、重复ID、空或过长文本、非法日期不能保存', () => {
  assert.equal(typeof moments.parseMoments, 'function')
  for (const raw of [
    '{',
    '{}',
    'null',
    JSON.stringify([one, one]),
    JSON.stringify([{ ...one, text: ' ' }]),
    JSON.stringify([{ ...one, text: 'x'.repeat(5001) }]),
    JSON.stringify([{ ...one, date: '2026-02-30T00:00:00Z' }]),
    JSON.stringify([{ ...one, date: '2026-11-10T08:00' }]),
    JSON.stringify([{ ...one, id: '../path' }]),
  ])
    assert.throws(() => moments.parseMoments(raw))
})

test('静态页面转义标签、保留换行和稳定锚点', () => {
  const html = momentsHtml(
    JSON.stringify([
      { ...one, text: '<img src=x onerror=alert(1)>\n第二行 & 内容' },
    ]),
  )
  assert.ok(html.includes('&lt;img'))
  assert.ok(!html.includes('<img'))
  assert.ok(html.includes('\n第二行 &amp; 内容'))
  assert.ok(html.includes('id="moment-first"'))
  assert.ok(html.includes('datetime="2026-11-10T00:00:00.000Z"'))
})

test('旧窗口不能覆盖另一窗口已编辑的同一条动态', async () => {
  let source = JSON.stringify([{ ...one, text: '另一个窗口已修改' }]),
    writes = 0
  const injector = createEnvironmentInjector(
    [
      AdminStore,
      { provide: BlogService, useValue: { allPosts: signal([]) } },
      {
        provide: GitService,
        useValue: {
          getFile: async () => ({ content: source, sha: 'new-version' }),
          commit: async () => {
            writes++
          },
        },
      },
    ],
    null as any,
  )
  try {
    const store = injector.get(AdminStore)
    await assert.rejects(
      store.saveMoment({ ...one, text: '旧窗口保存' }, true, one),
      /已被修改/,
    )
    assert.equal(writes, 0)
    assert.equal(JSON.parse(source)[0].text, '另一个窗口已修改')
  } finally {
    injector.destroy()
  }
})

test('Git 保存读取最新列表，编辑和删除保留其他动态；失败不覆盖', async () => {
  let source = JSON.stringify([one]),
    writes = 0,
    fail = false
  const injector = createEnvironmentInjector(
    [
      AdminStore,
      { provide: BlogService, useValue: { allPosts: signal([]) } },
      {
        provide: GitService,
        useValue: {
          getFile: async () => ({ content: source }),
          commit: async (changes: { path: string; content: string }[]) => {
            if (fail) throw new Error('网络失败')
            assert.equal(changes[0].path, 'data/moments.json')
            writes++
            source = changes[0].content
          },
        },
      },
    ],
    null as any,
  )
  try {
    const store = injector.get(AdminStore)
    await store.saveMoment({ ...one, id: 'second', text: '第二条' }, false)
    assert.equal(moments.parseMoments(source).length, 2)
    await store.saveMoment({ ...one, text: '修改第一条' }, true)
    assert.equal(
      moments.parseMoments(source).find((m) => m.id === 'second')?.text,
      '第二条',
    )
    await assert.rejects(store.saveMoment(one, false), /已存在/)
    await assert.rejects(
      store.saveMoment({ ...one, id: 'gone' }, true),
      /已被删除/,
    )
    await store.deleteMoment('first')
    assert.deepEqual(
      moments.parseMoments(source).map((m) => m.id),
      ['second'],
    )
    const previous = source
    fail = true
    await assert.rejects(
      store.saveMoment({ ...one, id: 'third' }, false),
      /网络失败/,
    )
    assert.equal(source, previous)
    assert.deepEqual(
      store.moments().map((m) => m.id),
      ['second'],
    )
    source = '{'
    const count = writes
    await assert.rejects(
      store.saveMoment({ ...one, id: 'third' }, false),
      /JSON/,
    )
    await assert.rejects(store.deleteMoment('second'), /JSON/)
    assert.equal(source, '{')
    assert.equal(writes, count)
  } finally {
    injector.destroy()
  }
})
