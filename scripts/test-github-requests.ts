import '@angular/compiler'
import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { createEnvironmentInjector, signal } from '@angular/core'
import { GitService } from '../src/app/services/git.service'
import { BlogService } from '../src/app/services/blog.service'
import { LocalDemoService } from '../src/app/services/local-demo.service'
import { AuthService } from '../src/app/services/auth.service'
import { authIdentity, decryptAuth } from '../src/shared/auth'

const originals = new Map(
  ['document', 'localStorage', 'sessionStorage'].map((key) => [
    key,
    Object.getOwnPropertyDescriptor(globalThis, key),
  ]),
)
afterEach(() => {
  for (const [key, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else Reflect.deleteProperty(globalThis, key)
  }
})
const response = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status })
function setup(repo = 'https://github.com/dragonadd/Navblog') {
  const local = new Map([['token', 'legacy-test-token']]),
    session = new Map<string, string>()
  const storage = (map: Map<string, string>) => ({
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => map.set(key, value),
    removeItem: (key: string) => map.delete(key),
  })
  for (const [key, value] of [
    ['document', { baseURI: 'https://site.example/' }],
    ['localStorage', storage(local)],
    ['sessionStorage', storage(session)],
  ] as const)
    Object.defineProperty(globalThis, key, { configurable: true, value })
  const injector = createEnvironmentInjector(
    [
      GitService,
      AuthService,
      {
        provide: BlogService,
        useValue: {
          config: { gitRepoUrl: repo, branch: 'main', imageRepoUrl: '' },
          settings: signal({ actionUrl: '' }),
        },
      },
      { provide: LocalDemoService, useValue: { active: () => false } },
    ],
    null as any,
  )
  const git = injector.get(GitService)
  git.token.set('old-test-token')
  session.set(git.sessionKey, 'old-test-token')
  return { injector, git, local, session }
}

test('配置中的仓库名用于实际请求，Bearer/Accept齐全，新登录不会使用旧缓存Token', async (t) => {
  for (const [repo, expectedPath] of [
    ['https://github.com/dragonadd/Navblog', '/repos/dragonadd/Navblog'],
    [
      'https://github.com/other-owner/another-blog?branch=develop',
      '/repos/other-owner/another-blog',
    ],
  ]) {
    const s = setup(repo),
      paths: string[] = []
    t.mock.method(globalThis, 'fetch', async (url, options) => {
      const path = new URL(String(url)).pathname,
        headers = new Headers(options?.headers)
      paths.push(path)
      assert.equal(headers.get('Authorization'), 'Bearer new-test-token')
      assert.equal(headers.get('Accept'), 'application/vnd.github.v3+json')
      assert.equal(options?.cache, 'no-store')
      if (path === '/user') return response({ login: 'dragonadd' })
      if (path === expectedPath)
        return response({ permissions: { push: true } })
      assert.equal(path, expectedPath + '/contents/data/moments.json')
      return response({ content: 'W10=', sha: 'file-sha' })
    })
    try {
      await s.git.login('new-test-token')
      assert.deepEqual(await s.git.getFile('data/moments.json'), {
        content: '[]',
        sha: 'file-sha',
      })
      assert.equal(s.session.get(s.git.sessionKey), 'new-test-token')
      assert.equal(s.local.size, 0)
      assert.equal(paths.length, 3)
    } finally {
      s.injector.destroy()
    }
  }
})

test('单文件更新、新建、删除先GET，SHA绑定当前文件，Base64保真且不重复编码', async (t) => {
  const s = setup(),
    methods: string[] = []
  let file: { content: string; sha: string } | null = {
    content: '旧正文',
    sha: 'original-sha',
  }
  let expectedContent = '中文正文 🌹\n$& $$'
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(
      new URL(String(url)).pathname,
      '/repos/dragonadd/Navblog/contents/data/moments.json',
    )
    methods.push(options!.method!)
    if (options?.method === 'GET')
      return file
        ? response({
            content: Buffer.from(file.content).toString('base64'),
            sha: file.sha,
          })
        : response({ message: 'Not Found' }, 404)
    const body = JSON.parse(String(options?.body))
    assert.equal(body.sha, file?.sha)
    assert.equal(body.branch, 'main')
    if (options?.method === 'DELETE') {
      assert.equal(body.content, undefined)
      file = null
    } else {
      assert.equal(
        body.content,
        Buffer.from(expectedContent).toString('base64'),
      )
      file = { content: expectedContent, sha: 'written-sha' }
    }
    return response({})
  })
  try {
    await s.git.commit(
      [
        {
          path: 'data/moments.json',
          content: expectedContent,
          expectedSha: 'original-sha',
        },
      ],
      'update',
    )
    assert.deepEqual(methods.splice(0), ['GET', 'PUT'])
    await s.git.commit(
      [
        {
          path: 'data/moments.json',
          content: null,
          expectedSha: 'written-sha',
        },
      ],
      'delete',
    )
    assert.deepEqual(methods.splice(0), ['GET', 'DELETE'])
    expectedContent = '新文件'
    await s.git.commit(
      [
        {
          path: 'data/moments.json',
          content: expectedContent,
          expectedSha: null,
        },
      ],
      'create',
    )
    assert.deepEqual(methods.splice(0), ['GET', 'PUT'])
    expectedContent = '预编码内容 🌹'
    await s.git.commit(
      [
        {
          path: 'data/moments.json',
          content: Buffer.from(expectedContent).toString('base64'),
          base64: true,
          expectedSha: 'written-sha',
        },
      ],
      'encoded',
    )
    assert.deepEqual(methods.splice(0), ['GET', 'PUT'])
  } finally {
    s.injector.destroy()
  }
})

test('单文件版本冲突在写入前拒绝，不用最新SHA覆盖旧编辑内容', async (t) => {
  const s = setup()
  let writes = 0
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    if (options?.method === 'GET')
      return response({ content: 'W10=', sha: 'other-window-sha' })
    writes++
    return response({})
  })
  try {
    await assert.rejects(
      s.git.commit(
        [
          {
            path: 'data/moments.json',
            content: '旧编辑',
            expectedSha: 'old-sha',
          },
        ],
        'update',
      ),
      /修改|冲突/,
    )
    assert.equal(writes, 0)
    assert.equal(s.git.busy(), false)
  } finally {
    s.injector.destroy()
  }
})

test('Git错误标明请求位置，不包含Token或提交正文', async (t) => {
  const s = setup()
  t.mock.method(globalThis, 'fetch', async () =>
    response(
      { message: 'Resource not accessible by personal access token' },
      403,
    ),
  )
  try {
    await assert.rejects(s.git.getFile('data/moments.json'), (error: any) => {
      assert.equal(error.status, 403)
      assert.match(
        error.message,
        /GET \/repos\/dragonadd\/Navblog\/contents\/data\/moments\.json/,
      )
      assert.ok(!error.message.includes('old-test-token'))
      return true
    })
  } finally {
    s.injector.destroy()
  }
})

test('密码管理通过实际Git请求提交密文，移除携带SHA且不泄漏凭证', async (t) => {
  const s = setup(),
    auth = s.injector.get(AuthService),
    password = 'Test1234'
  let file: { content: string; sha: string } | null = null
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    const target = new URL(String(url)),
      headers = new Headers(options?.headers)
    assert.equal(headers.get('Authorization'), 'Bearer old-test-token')
    assert.equal(headers.get('Accept'), 'application/vnd.github.v3+json')
    if (target.pathname === '/user') return response({ login: 'dragonadd' })
    if (target.pathname === '/repos/dragonadd/Navblog')
      return response({ permissions: { push: true } })
    assert.equal(
      target.pathname,
      '/repos/dragonadd/Navblog/contents/data/auth.json',
    )
    if (options?.method === 'GET')
      return file
        ? response({
            content: Buffer.from(file.content).toString('base64'),
            sha: file.sha,
          })
        : response({ message: 'Not Found' }, 404)
    const body = JSON.parse(String(options?.body))
    assert.equal(body.sha, file?.sha)
    if (options?.method === 'DELETE') file = null
    else {
      assert.equal(options?.method, 'PUT')
      const raw = Buffer.from(body.content, 'base64').toString('utf8')
      assert.ok(!raw.includes('old-test-token') && !raw.includes(password))
      assert.equal(
        await decryptAuth(raw, password, authIdentity(s.git.repo)),
        'old-test-token',
      )
      file = { content: raw, sha: 'auth-saved-sha' }
    }
    return response({})
  })
  try {
    assert.equal(await auth.loadManagement(), 'unset')
    await auth.setPassword(password, password)
    assert.equal(await auth.loadManagement(), 'set')
    await auth.removePassword()
    assert.equal(file, null)
  } finally {
    s.injector.destroy()
  }
})
