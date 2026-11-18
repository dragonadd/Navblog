import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs'
import { spawnSync } from 'node:child_process'
import yaml from 'js-yaml'
import { resolveBranch } from './repository'
import { PATHS, ROOT } from './lib'

test('auto分支跟随CF test部署和其他构建环境，显式分支优先', () => {
  assert.equal(
    resolveBranch('auto', { CF_PAGES_BRANCH: 'test' }, 'main'),
    'test',
  )
  assert.equal(
    resolveBranch(
      'auto',
      { GITHUB_REF_NAME: 'test', GITHUB_REF_TYPE: 'branch' },
      'main',
    ),
    'test',
  )
  assert.equal(resolveBranch('auto', { BRANCH: 'preview' }, 'main'), 'preview')
  assert.equal(
    resolveBranch('auto', { VERCEL_GIT_COMMIT_REF: 'feature/test' }, ''),
    'feature/test',
  )
  assert.equal(
    resolveBranch('main', { CF_PAGES_BRANCH: 'test' }, 'test'),
    'main',
  )
  assert.equal(resolveBranch('auto', {}, 'main'), 'main')
})

test('auto无法识别时不猜测main，标签或PR合并引用不作为写入分支', () => {
  assert.equal(resolveBranch('auto', {}, ''), '')
  assert.equal(
    resolveBranch(
      'auto',
      { GITHUB_REF_NAME: 'v1', GITHUB_REF_TYPE: 'tag' },
      '',
    ),
    '',
  )
  assert.equal(
    resolveBranch(
      'auto',
      { GITHUB_REF_NAME: '123/merge', GITHUB_EVENT_NAME: 'pull_request' },
      '',
    ),
    '',
  )
  for (const value of [
    'HEAD',
    '../main',
    'bad branch',
    'bad~ref',
    'branch.lock',
  ])
    assert.throws(() => resolveBranch(value, {}, ''), /分支/)
})

test('真实CF test准备阶段将test写进前端配置，显式main保持可用', () => {
  const original = fs.readFileSync(PATHS.config, 'utf8'),
    index = fs.readFileSync(PATHS.postsIndex)
  const raw = yaml.load(original) as Record<string, unknown>
  const run = () =>
    spawnSync(process.execPath, ['--import', 'tsx', 'scripts/prepare.ts'], {
      cwd: ROOT,
      env: { ...process.env, CF_PAGES_BRANCH: 'test' },
      encoding: 'utf8',
      windowsHide: true,
    })
  try {
    fs.writeFileSync(PATHS.config, yaml.dump({ ...raw, branch: 'auto' }))
    let result = run()
    assert.equal(result.status, 0, result.stderr)
    let config = JSON.parse(
      fs.readFileSync(`${PATHS.generated}/config.json`, 'utf8'),
    )
    assert.equal(config.branch, 'test')
    fs.writeFileSync(PATHS.config, yaml.dump({ ...raw, branch: 'main' }))
    result = run()
    assert.equal(result.status, 0, result.stderr)
    config = JSON.parse(
      fs.readFileSync(`${PATHS.generated}/config.json`, 'utf8'),
    )
    assert.equal(config.branch, 'main')
    fs.writeFileSync(
      PATHS.config,
      yaml.dump({
        ...raw,
        gitRepoUrl: 'https://github.com/owner/branch-guard',
        branch: 'auto',
      }),
    )
    const before = fs.readFileSync(`${PATHS.generated}/config.json`, 'utf8')
    const missing = spawnSync(
      process.execPath,
      ['--import', 'tsx', 'scripts/prepare.ts'],
      {
        cwd: ROOT,
        env: {
          ...process.env,
          PATH: '',
          CF_PAGES_BRANCH: '',
          GITHUB_REF_NAME: '',
          BRANCH: '',
          VERCEL_GIT_COMMIT_REF: '',
          CI_COMMIT_BRANCH: '',
        },
        encoding: 'utf8',
        windowsHide: true,
      },
    )
    assert.notEqual(missing.status, 0)
    assert.match(missing.stderr, /无法识别部署分支/)
    assert.equal(
      fs.readFileSync(`${PATHS.generated}/config.json`, 'utf8'),
      before,
    )
  } finally {
    fs.writeFileSync(PATHS.config, original)
    const result = spawnSync(
      process.execPath,
      ['--import', 'tsx', 'scripts/prepare.ts'],
      { cwd: ROOT, env: process.env, encoding: 'utf8', windowsHide: true },
    )
    fs.writeFileSync(PATHS.postsIndex, index)
    assert.equal(result.status, 0, result.stderr)
  }
})
