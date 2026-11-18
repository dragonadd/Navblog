import '@angular/compiler'
import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { createEnvironmentInjector, signal } from '@angular/core'
import { GitService } from '../src/app/services/git.service'
import { BlogService } from '../src/app/services/blog.service'
import { LocalDemoService } from '../src/app/services/local-demo.service'

const descriptors = new Map(
  ['localStorage', 'sessionStorage', 'document'].map((k) => [
    k,
    Object.getOwnPropertyDescriptor(globalThis, k),
  ]),
)
afterEach(() => {
  for (const [key, value] of descriptors) {
    if (value) Object.defineProperty(globalThis, key, value)
    else Reflect.deleteProperty(globalThis, key)
  }
})
function git(repo: string) {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: () => 'test-token' },
  })
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: { getItem: () => 'test-token' },
  })
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { baseURI: 'https://site.example/' },
  })
  const injector = createEnvironmentInjector(
    [
      GitService,
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
  return { injector, service: injector.get(GitService) }
}
test('GitHub 动态单文件提交绑定读取时 SHA，不使用最新 head 覆盖旧数据', async (t) => {
  const { injector, service } = git('https://github.com/alice/blog')
  const fetch = t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (options?.method === 'GET')
      return new Response(
        JSON.stringify({ content: 'W10=', sha: 'read-version' }),
      )
    assert.equal(options?.method, 'PUT')
    assert.match(String(url), /contents\/data\/moments.json/)
    const payload = JSON.parse(options?.body as string)
    assert.equal(payload.sha, 'read-version')
    return new Response(JSON.stringify({ message: 'conflict' }), {
      status: 409,
    })
  })
  try {
    await assert.rejects(
      service.commit(
        [
          {
            path: 'data/moments.json',
            content: '[]',
            expectedSha: 'read-version',
          },
        ] as any,
        'update moment',
      ),
      /conflict/,
    )
    assert.equal(fetch.mock.callCount(), 2)
  } finally {
    injector.destroy()
  }
})
test('GitLab 动态更新携带读取时 last_commit_id', async (t) => {
  const { injector, service } = git('https://gitlab.com/alice/blog')
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    if (options?.method === 'GET')
      return new Response(
        JSON.stringify({
          content: 'W10=',
          blob_id: 'read-version',
          last_commit_id: 'read-commit',
        }),
      )
    const payload = JSON.parse(options?.body as string)
    assert.equal(payload.actions[0].last_commit_id, 'read-commit')
    return new Response('{}')
  })
  try {
    await service.commit(
      [
        {
          path: 'data/moments.json',
          content: '[]',
          expectedSha: 'read-version',
          expectedLastCommit: 'read-commit',
        },
      ] as any,
      'update moment',
    )
  } finally {
    injector.destroy()
  }
})
test('Gitee 发现读取后文件版本变化时拒绝写入', async (t) => {
  const { injector, service } = git('https://gitee.com/alice/blog')
  let writes = 0
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    if (options?.method === 'GET')
      return new Response(
        JSON.stringify({ content: 'W10=', sha: 'new-version' }),
      )
    writes++
    return new Response('{}')
  })
  try {
    await assert.rejects(
      service.commit(
        [
          {
            path: 'data/moments.json',
            content: '[]',
            expectedSha: 'old-version',
          },
        ] as any,
        'update moment',
      ),
      /已被修改/,
    )
    assert.equal(writes, 0)
  } finally {
    injector.destroy()
  }
})

test('Gitee 移除认证只在授权头传Token，不放入请求URL', async (t) => {
  const { injector, service } = git('https://gitee.com/alice/blog')
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (options?.method === 'GET')
      return new Response(
        JSON.stringify({ content: 'e30=', sha: 'auth-version' }),
      )
    assert.equal(options?.method, 'DELETE')
    assert.ok(!String(url).includes('access_token'))
    assert.equal(
      (options?.headers as Record<string, string>).Authorization,
      'Bearer test-token',
    )
    return new Response('{}')
  })
  try {
    await service.commit(
      [{ path: 'data/auth.json', content: null, expectedSha: 'auth-version' }],
      'remove password',
    )
  } finally {
    injector.destroy()
  }
})

test('GitHub 多文件提交先在固定head核验版本，冲突不创建提交', async (t) => {
  const { injector, service } = git('https://github.com/alice/blog')
  let writes = 0
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    const target = String(url)
    if (options?.method !== 'GET') {
      writes++
      return new Response(
        JSON.stringify({ sha: 'write', object: { sha: 'write' } }),
      )
    }
    if (target.includes('/git/ref/'))
      return new Response('{"object":{"sha":"head-2"}}')
    if (target.includes('/git/commits/'))
      return new Response('{"tree":{"sha":"tree-2"}}')
    assert.ok(target.includes('ref=head-2'))
    return new Response(
      JSON.stringify({
        content: Buffer.from('其他窗口修改').toString('base64'),
        sha: 'new-sha',
      }),
    )
  })
  try {
    await assert.rejects(
      service.commit(
        [
          {
            path: 'data/posts/first.md',
            content: '旧草稿',
            expectedSha: 'old-sha',
            expectedContent: '原正文',
          },
          {
            path: 'data/posts.json',
            content: '[]',
            expectedSha: 'old-index',
            expectedContent: '[]',
          },
        ],
        'update post',
      ),
      /修改|冲突/,
    )
    assert.equal(writes, 0)
  } finally {
    injector.destroy()
  }
})

test('GitHub 版本匹配的正文和索引基于同一head原子提交', async (t) => {
  const { injector, service } = git('https://github.com/alice/blog')
  const verified: string[] = []
  let updated = false
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    const target = String(url),
      body = options?.body ? JSON.parse(String(options.body)) : {}
    if (options?.method === 'GET') {
      if (target.includes('/git/ref/'))
        return new Response('{"object":{"sha":"head-1"}}')
      if (target.includes('/git/commits/'))
        return new Response('{"tree":{"sha":"tree-1"}}')
      assert.ok(target.includes('ref=head-1'))
      verified.push(target)
      return new Response(
        JSON.stringify({ content: btoa('original'), sha: 'old-sha' }),
      )
    }
    if (target.includes('/git/trees')) {
      assert.equal(verified.length, 2)
      assert.equal(body.base_tree, 'tree-1')
      return new Response('{"sha":"new-tree"}')
    }
    if (options?.method === 'POST') {
      assert.deepEqual(body.parents, ['head-1'])
      return new Response('{"sha":"new-commit"}')
    }
    assert.equal(body.sha, 'new-commit')
    assert.equal(body.force, false)
    updated = true
    return new Response('{}')
  })
  try {
    await service.commit(
      [
        {
          path: 'data/posts/first.md',
          content: 'new',
          expectedSha: 'old-sha',
          expectedContent: 'original',
        },
        {
          path: 'data/posts.json',
          content: 'new-index',
          expectedSha: 'old-sha',
          expectedContent: 'original',
        },
      ],
      'update post',
    )
    assert.equal(updated, true)
  } finally {
    injector.destroy()
  }
})

test('Gitee 多文件先全部预检，索引版本冲突不先改正文', async (t) => {
  const { injector, service } = git('https://gitee.com/alice/blog')
  let writes = 0
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (options?.method === 'GET')
      return new Response(
        JSON.stringify({
          content: btoa('original'),
          sha: String(url).includes('posts.json') ? 'new-sha' : 'old-sha',
        }),
      )
    writes++
    return new Response('{}')
  })
  try {
    await assert.rejects(
      service.commit(
        [
          {
            path: 'data/posts/first.md',
            content: 'new',
            expectedSha: 'old-sha',
          },
          {
            path: 'data/posts.json',
            content: 'new-index',
            expectedSha: 'old-sha',
          },
        ],
        'update post',
      ),
      /修改|冲突/,
    )
    assert.equal(writes, 0)
  } finally {
    injector.destroy()
  }
})
