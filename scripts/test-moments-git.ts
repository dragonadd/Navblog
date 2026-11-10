import '@angular/compiler'
import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { createEnvironmentInjector, signal } from '@angular/core'
import { GitService } from '../src/app/services/git.service'
import { BlogService } from '../src/app/services/blog.service'
import { LocalDemoService } from '../src/app/services/local-demo.service'

const storage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
afterEach(() => {
  if (storage) Object.defineProperty(globalThis, 'localStorage', storage)
  else Reflect.deleteProperty(globalThis, 'localStorage')
})
function git(repo: string) {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: () => 'test-token' },
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
    assert.equal(fetch.mock.callCount(), 1)
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
