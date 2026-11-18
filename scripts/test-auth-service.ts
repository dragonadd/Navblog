import '@angular/compiler'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createEnvironmentInjector, signal } from '@angular/core'
import { AuthService } from '../src/app/services/auth.service'
import { BlogService } from '../src/app/services/blog.service'
import { GitService } from '../src/app/services/git.service'
import { LocalDemoService } from '../src/app/services/local-demo.service'
import { authIdentity, decryptAuth, encryptAuth } from '../src/shared/auth'

const repo = {
  provider: 'github',
  host: 'github.com',
  owner: 'alice',
  repo: 'blog',
  branch: 'main',
  projectId: '',
} as const
const token = 'test-credential-only',
  password = 'Abc12345'
function setup(demo = false) {
  let file: { content: string; sha: string } | null = null,
    commits: any[] = []
  const git = {
    repo,
    token: signal(token),
    validateToken: async () => ({ name: 'alice' }),
    getFile: async () => file,
    commit: async (changes: any[]) => {
      commits.push(changes)
      file =
        changes[0].content === null
          ? null
          : { content: changes[0].content, sha: 'new-version' }
    },
  }
  const injector = createEnvironmentInjector(
    [
      AuthService,
      {
        provide: BlogService,
        useValue: { url: (p: string) => 'https://site.example/blog/' + p },
      },
      { provide: GitService, useValue: git },
      { provide: LocalDemoService, useValue: { active: () => demo } },
    ],
    null as any,
  )
  return {
    injector,
    service: injector.get(AuthService),
    git,
    commits,
    setFile: (value: typeof file) => {
      file = value
    },
  }
}
test('公开auth请求始终有时间戳且无缓存/凭据；404和空白无密码，有密文返回有效数据', async (t) => {
  const s = setup()
  const raw = await encryptAuth(token, password, authIdentity(repo))
  let status = 404,
    body = ''
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.match(
      String(url),
      /^https:\/\/site.example\/blog\/data\/auth.json\?t=\d+$/,
    )
    assert.equal(options?.cache, 'no-store')
    assert.equal(options?.credentials, 'omit')
    return new Response(body, { status })
  })
  try {
    assert.equal(await s.service.loadPublic(), null)
    status = 200
    body = ' \n '
    assert.equal(await s.service.loadPublic(), null)
    body = raw
    assert.equal(await s.service.loadPublic(), raw)
  } finally {
    s.injector.destroy()
  }
})
test('网络、HTML回退、无效JSON不被当成未设密码', async (t) => {
  const s = setup()
  let body = '<html>fallback</html>',
    failed = false
  t.mock.method(globalThis, 'fetch', async () => {
    if (failed) throw Error('offline')
    return new Response(body)
  })
  try {
    await assert.rejects(s.service.loadPublic())
    body = '{}'
    await assert.rejects(s.service.loadPublic())
    failed = true
    await assert.rejects(s.service.loadPublic())
  } finally {
    s.injector.destroy()
  }
})
test('设置和移除密码独立提交auth文件，仅密文且携带版本，演示禁止真实Token', async () => {
  const s = setup()
  try {
    assert.equal(await s.service.loadManagement(), 'unset')
    await s.service.setPassword(password, password)
    const change = s.commits[0][0]
    assert.equal(change.path, 'data/auth.json')
    assert.equal(change.expectedSha, null)
    assert.ok(!change.content.includes(token))
    assert.ok(!change.content.includes(password))
    assert.equal(
      await decryptAuth(change.content, password, authIdentity(repo)),
      token,
    )
    assert.equal(await s.service.loadManagement(), 'set')
    await assert.rejects(s.service.setPassword(password, 'wrong'))
    await s.service.removePassword()
    assert.equal(s.commits[1][0].content, null)
    assert.equal(s.commits[1][0].expectedSha, 'new-version')
  } finally {
    s.injector.destroy()
  }
  const demo = setup(true)
  try {
    await assert.rejects(demo.service.setPassword(password, password), /演示/)
    assert.equal(demo.commits.length, 0)
  } finally {
    demo.injector.destroy()
  }
})
