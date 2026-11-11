import '@angular/compiler'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createEnvironmentInjector, signal } from '@angular/core'
import {
  decryptPostBody,
  encryptPostBody,
  ENCRYPTED_SUMMARY,
  parseEncryptedPayload,
} from '../src/shared/post-crypto'
import {
  normalizeMeta,
  parseFrontMatter,
  stringifyPost,
} from '../src/shared/frontmatter'
import { AdminStore } from '../src/app/admin/admin-store.service'
import { BlogService } from '../src/app/services/blog.service'
import { GitService } from '../src/app/services/git.service'

const password = '测试口令-for-crypto-1234'

test('Web Crypto 正确解密 UTF-8、换行和 emoji，同文同密码产生不同随机密文', async () => {
  const body = '\n# 机密测试 😀\n\n正文\n第二行\n'
  const a = await encryptPostBody(body, password),
    b = await encryptPostBody(body, password)
  assert.notEqual(a, b)
  assert.notEqual(parseEncryptedPayload(a).salt, parseEncryptedPayload(b).salt)
  assert.notEqual(parseEncryptedPayload(a).iv, parseEncryptedPayload(b).iv)
  assert.equal(await decryptPostBody(a, password), body)
  assert.ok(!a.includes('机密测试'))
  assert.ok(!a.includes(password))
  assert.equal(
    await decryptPostBody(await encryptPostBody('', password), password),
    '',
  )
})

test('错误密码、密文篡改、算法/版本/参数错误和短密码均拒绝', async () => {
  const body = await encryptPostBody('秘密', password)
  await assert.rejects(decryptPostBody(body, '错误密码'), /密码错误/)
  const payload = parseEncryptedPayload(body)
  const ciphertext =
    (payload.ciphertext[0] === 'A' ? 'B' : 'A') + payload.ciphertext.slice(1)
  await assert.rejects(
    decryptPostBody(JSON.stringify({ ...payload, ciphertext }), password),
    /密码错误/,
  )
  for (const change of [
    { version: 2 },
    { cipher: 'AES-CBC' },
    { iterations: 1 },
    { iterations: 9e20 },
    { salt: 'AA==' },
    { iv: 'not base64' },
    { password: 'forbidden' },
  ])
    assert.throws(
      () => parseEncryptedPayload(JSON.stringify({ ...payload, ...change })),
      /数据损坏/,
    )
  assert.throws(() => parseEncryptedPayload('普通正文'), /数据损坏/)
  await assert.rejects(encryptPostBody('秘密', '短密码'), /4/)
})

test('文章密码允许4位且保持原密文格式，3位拒绝，旧长密码仍可解密', async () => {
  const source = await encryptPostBody('四位密码正文', '1234')
  assert.equal(await decryptPostBody(source, '1234'), '四位密码正文')
  assert.equal(parseEncryptedPayload(source).version, 1)
  await assert.rejects(encryptPostBody('正文', '123'), /4/)
  const old = await encryptPostBody('旧长密码正文', password)
  assert.equal(await decryptPostBody(old, password), '旧长密码正文')
})

test('加密元数据只生成公开摘要，无字数/正文泄漏，缺标记和明文密码阻止发布', async () => {
  const body = await encryptPostBody('不可以生成摘要的正文', password)
  const meta = normalizeMeta(
    { title: '公开标题', encrypted: true },
    'secret',
    body,
  )
  assert.equal(meta.summary, ENCRYPTED_SUMMARY)
  assert.equal(meta.words, 0)
  assert.equal(meta.encrypted, true)
  const source = stringifyPost(
    { ...meta, summary: '公开简介', hideSidebar: true },
    body,
  )
  const parsed = parseFrontMatter(source)
  assert.equal(
    normalizeMeta(parsed.data, 'secret', parsed.body).summary,
    '公开简介',
  )
  assert.equal(
    await decryptPostBody(parsed.body, password),
    '不可以生成摘要的正文',
  )
  assert.throws(
    () => normalizeMeta({ encrypted: true }, 'bad', '明文'),
    /数据损坏/,
  )
  assert.throws(() => normalizeMeta({}, 'bad', body), /缺少/)
  assert.throws(() => stringifyPost(meta, '明文'), /数据损坏/)
  assert.throws(
    () => normalizeMeta({ Password: '不允许' }, 'bad', '明文'),
    /禁止/,
  )
  assert.throws(
    () => parseFrontMatter('---\nencrypted: [\n---\n秘密'),
    /元数据格式错误/,
  )
  assert.equal(
    normalizeMeta({ title: '普通' }, 'plain', '普通正文').summary,
    '普通正文',
  )
})

test('后台提交前加密；编辑、换密码、改 slug 后仍密文，关闭加密恢复普通文章', async () => {
  const files = new Map<string, string>()
  let commits: { path: string; content: string | null }[][] = []
  const injector = createEnvironmentInjector(
    [
      AdminStore,
      { provide: BlogService, useValue: { allPosts: signal([]) } },
      {
        provide: GitService,
        useValue: {
          getFile: async (path: string) =>
            files.has(path) ? { content: files.get(path) } : null,
          commit: async (
            changes: { path: string; content: string | null }[],
          ) => {
            commits.push(changes)
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
      slug: 'secret',
      title: '公开标题',
      date: '2026-11-10',
      tags: ['公开标签'],
      encrypted: true,
    }
    await assert.rejects(store.savePost(meta, '机密正文'), /需要密码/)
    assert.equal(commits.length, 0)
    await store.savePost(meta, '机密正文', undefined, password)
    assert.ok(!JSON.stringify(commits).includes('机密正文'))
    assert.ok(!JSON.stringify(commits).includes(password))
    const loaded = (await store.loadPost('secret'))!
    assert.equal(loaded.meta.summary, ENCRYPTED_SUMMARY)
    assert.equal(await decryptPostBody(loaded.body, password), '机密正文')
    const newPassword = password + '-new'
    await store.savePost(
      { ...meta, slug: 'renamed', summary: '新的公开摘要' },
      '编辑后的机密正文',
      'secret',
      newPassword,
    )
    assert.equal(await store.loadPost('secret'), null)
    const updated = (await store.loadPost('renamed'))!
    assert.equal(
      await decryptPostBody(updated.body, newPassword),
      '编辑后的机密正文',
    )
    await assert.rejects(decryptPostBody(updated.body, password), /密码错误/)
    assert.ok(!JSON.stringify(commits).includes('编辑后的机密正文'))
    assert.equal(updated.meta.summary, '新的公开摘要')
    await store.savePost(
      { ...meta, slug: 'renamed', encrypted: undefined },
      '改为公开正文',
      'renamed',
    )
    assert.equal((await store.loadPost('renamed'))!.body.trim(), '改为公开正文')
    assert.equal((await store.loadPost('renamed'))!.meta.encrypted, undefined)
  } finally {
    injector.destroy()
    commits = []
  }
})
