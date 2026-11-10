import '@angular/compiler'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createEnvironmentInjector, signal } from '@angular/core'
import * as auth from '../src/shared/auth'
import { GitService, parseRepo } from '../src/app/services/git.service'
import { BlogService } from '../src/app/services/blog.service'
import { LocalDemoService } from '../src/app/services/local-demo.service'

test('登录密码最少8位且包含字母数字，Unicode不改变判定', () => {
  assert.equal(auth.validLoginPassword('Abc12345'), true)
  for (const value of ['abc1234', 'abcdefgh', '12345678', '中文中文12345678'])
    assert.equal(auth.validLoginPassword(value), false)
})

test('旧会话迟到的401不能清除已重新登录的新会话', async (t) => {
  const descriptors = new Map(
    ['document', 'localStorage', 'sessionStorage'].map((k) => [
      k,
      Object.getOwnPropertyDescriptor(globalThis, k),
    ]),
  )
  const session = new Map<string, string>()
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { baseURI: 'https://site.example/' },
  })
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { removeItem() {} },
  })
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => session.get(k) || null,
      setItem: (k: string, v: string) => session.set(k, v),
      removeItem: (k: string) => session.delete(k),
    },
  })
  let release: () => void = () => {}
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (
      (options?.headers as Record<string, string>).Authorization ===
      'token old-test-token'
    )
      return new Promise<Response>((resolve) => {
        release = () =>
          resolve(new Response('{"message":"expired"}', { status: 401 }))
      })
    return new Response(
      JSON.stringify(
        String(url).endsWith('/user')
          ? { login: 'alice' }
          : { permissions: { push: true } },
      ),
    )
  })
  const injector = createEnvironmentInjector(
    [
      GitService,
      {
        provide: BlogService,
        useValue: {
          config: {
            gitRepoUrl: 'https://github.com/alice/blog',
            branch: 'main',
          },
          settings: signal({}),
        },
      },
      { provide: LocalDemoService, useValue: { active: () => false } },
    ],
    null as any,
  )
  try {
    const git = injector.get(GitService)
    git.token.set('old-test-token')
    const pending = git.fetchUser()
    git.logout()
    await git.login('new-test-token')
    release()
    await pending
    assert.equal(git.token(), 'new-test-token')
    assert.equal([...session.values()][0], 'new-test-token')
  } finally {
    injector.destroy()
    for (const [k, value] of descriptors) {
      if (value) Object.defineProperty(globalThis, k, value)
      else Reflect.deleteProperty(globalThis, k)
    }
  }
})
test('GitLab项目ID不同使用不同的凭证上下文', () => {
  assert.notEqual(
    auth.authIdentity(parseRepo('https://gitlab.com/alice/blog?projectId=1')),
    auth.authIdentity(parseRepo('https://gitlab.com/alice/blog?projectId=2')),
  )
})

test('三平台写权限与归档限制均按实际返回字段检查', async (t) => {
  const descriptors = new Map(
    ['document', 'localStorage', 'sessionStorage'].map((k) => [
      k,
      Object.getOwnPropertyDescriptor(globalThis, k),
    ]),
  )
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { baseURI: 'https://site.example/' },
  })
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { removeItem() {} },
  })
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: { getItem: () => null },
  })
  let response: object = {}
  t.mock.method(
    globalThis,
    'fetch',
    async (url) =>
      new Response(
        JSON.stringify(
          String(url).endsWith('/user')
            ? { login: 'alice', username: 'alice' }
            : response,
        ),
      ),
  )
  const cases = [
    {
      host: 'github.com',
      repo: { permissions: { push: true } },
      allowed: true,
    },
    {
      host: 'github.com',
      repo: { permissions: { push: false } },
      allowed: false,
    },
    { host: 'gitee.com', repo: { permissions: { push: true } }, allowed: true },
    { host: 'gitee.com', repo: { permissions: {} }, allowed: false },
    {
      host: 'gitlab.com',
      repo: { permissions: { project_access: { access_level: 20 } } },
      allowed: false,
    },
    {
      host: 'gitlab.com',
      repo: { permissions: { project_access: { access_level: 30 } } },
      allowed: true,
    },
    {
      host: 'gitlab.com',
      repo: { permissions: { group_access: { access_level: 40 } } },
      allowed: true,
    },
    ...['github.com', 'gitee.com', 'gitlab.com'].map((host) => ({
      host,
      repo: {
        archived: true,
        permissions: { push: true, project_access: { access_level: 40 } },
      },
      allowed: false,
    })),
  ]
  try {
    for (const item of cases) {
      response = item.repo
      const injector = createEnvironmentInjector(
        [
          GitService,
          {
            provide: BlogService,
            useValue: {
              config: {
                gitRepoUrl: `https://${item.host}/alice/blog`,
                branch: 'main',
              },
              settings: signal({}),
            },
          },
          { provide: LocalDemoService, useValue: { active: () => false } },
        ],
        null as any,
      )
      try {
        const git = injector.get(GitService)
        if (item.allowed)
          assert.equal(
            (await git.validateToken('test-only-token')).name,
            'alice',
          )
        else
          await assert.rejects(
            git.validateToken('test-only-token'),
            /写权限|归档/,
          )
        assert.equal(git.isLogin(), false)
      } finally {
        injector.destroy()
      }
    }
  } finally {
    for (const [k, value] of descriptors) {
      if (value) Object.defineProperty(globalThis, k, value)
      else Reflect.deleteProperty(globalThis, k)
    }
  }
})
test('Token 用8位密码加密，可解密且格式不包含明文，域与仓库绑定', async () => {
  const password = 'Abc12345',
    token = 'TEST_TOKEN_not_a_credential_1234',
    identity = 'github:github.com:alice/blog:main'
  const a = await auth.encryptAuth(token, password, identity),
    b = await auth.encryptAuth(token, password, identity)
  assert.equal(await auth.decryptAuth(a, password, identity), token)
  assert.notEqual(a, b)
  assert.ok(!a.includes(token))
  assert.ok(!a.includes(password))
  await assert.rejects(auth.decryptAuth(a, 'Bad12345', identity))
  await assert.rejects(auth.decryptAuth(a, password, identity + '-other'))
  const parsed = auth.parseAuth(a)
  for (const changes of [
    { version: 2 },
    { iterations: 1 },
    { token },
    { salt: 'AA==' },
    { iv: 'bad' },
    { format: 'navblog-encrypted' },
  ])
    assert.throws(() =>
      auth.parseAuth(JSON.stringify({ ...parsed, ...changes })),
    )
  await assert.rejects(auth.encryptAuth(token, 'short', identity))
})

test('旧持久Token清除但不迁移，登录校验后仅session，失败不保存，退出清除', async (t) => {
  const descriptors = new Map(
    ['localStorage', 'sessionStorage', 'document'].map((k) => [
      k,
      Object.getOwnPropertyDescriptor(globalThis, k),
    ]),
  )
  const local = new Map([['token', 'legacy-token']]),
    session = new Map<string, string>()
  const storage = (map: Map<string, string>) => ({
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => map.set(k, v),
    removeItem: (k: string) => map.delete(k),
  })
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: storage(local),
  })
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: storage(session),
  })
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { baseURI: 'https://site.example/blog/' },
  })
  let writable = true
  t.mock.method(
    globalThis,
    'fetch',
    async (url) =>
      new Response(
        JSON.stringify(
          String(url).endsWith('/user')
            ? { login: 'alice' }
            : { permissions: { push: writable } },
        ),
      ),
  )
  const injector = createEnvironmentInjector(
    [
      GitService,
      {
        provide: BlogService,
        useValue: {
          config: {
            gitRepoUrl: 'https://github.com/alice/blog',
            branch: 'main',
          },
          settings: signal({}),
        },
      },
      { provide: LocalDemoService, useValue: { active: () => false } },
    ],
    null as any,
  )
  try {
    const git = injector.get(GitService)
    assert.equal(local.has('token'), false)
    assert.equal(git.isLogin(), false)
    await git.login('test-session-token')
    assert.equal(git.isLogin(), true)
    assert.equal(local.size, 0)
    assert.equal([...session.values()][0], 'test-session-token')
    assert.equal(injector.runInContext(() => new GitService()).isLogin(), true)
    git.logout()
    assert.equal(session.size, 0)
    writable = false
    await assert.rejects(git.login('no-write-token'), /写权限/)
    assert.equal(session.size, 0)
    assert.equal(git.isLogin(), false)
  } finally {
    injector.destroy()
    for (const [k, v] of descriptors) {
      if (v) Object.defineProperty(globalThis, k, v)
      else Reflect.deleteProperty(globalThis, k)
    }
  }
})

test('登录中退出可取消，sessionStorage受限不留下Token，仓库/子路径会话隔离', async (t) => {
  const descriptors = new Map(
    ['localStorage', 'sessionStorage', 'document'].map((k) => [
      k,
      Object.getOwnPropertyDescriptor(globalThis, k),
    ]),
  )
  const entries = new Map<string, string>()
  let denied = false,
    finish: () => void = () => {}
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { removeItem() {} },
  })
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => entries.get(k) ?? null,
      setItem: (k: string, v: string) => {
        if (denied) throw Error('blocked')
        entries.set(k, v)
      },
      removeItem: (k: string) => entries.delete(k),
    },
  })
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { baseURI: 'https://site.example/blog/' },
  })
  let pending = false
  t.mock.method(globalThis, 'fetch', async (url) => {
    if (pending)
      await new Promise<void>((resolve) => {
        finish = resolve
      })
    return new Response(
      JSON.stringify(
        String(url).endsWith('/user')
          ? { login: 'alice' }
          : { permissions: { push: true } },
      ),
    )
  })
  const blog = {
    config: { gitRepoUrl: 'https://github.com/alice/blog', branch: 'main' },
    settings: signal({}),
  }
  const injector = createEnvironmentInjector(
    [
      GitService,
      { provide: BlogService, useValue: blog },
      { provide: LocalDemoService, useValue: { active: () => false } },
    ],
    null as any,
  )
  try {
    const git = injector.get(GitService)
    denied = true
    await assert.rejects(git.login('test-token'), /sessionStorage/)
    assert.equal(git.isLogin(), false)
    denied = false
    await git.login('test-token')
    blog.config.branch = 'other'
    assert.equal(injector.runInContext(() => new GitService()).isLogin(), false)
    blog.config.branch = 'main'
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: { baseURI: 'https://site.example/other/' },
    })
    assert.equal(injector.runInContext(() => new GitService()).isLogin(), false)
    git.logout()
    pending = true
    const request = git.login('later-token')
    await new Promise((r) => setTimeout(r, 0))
    git.cancelPendingLogin()
    pending = false
    finish()
    await assert.rejects(request, /已取消/)
    assert.equal(entries.size, 0)
  } finally {
    injector.destroy()
    for (const [k, v] of descriptors) {
      if (v) Object.defineProperty(globalThis, k, v)
      else Reflect.deleteProperty(globalThis, k)
    }
  }
})
