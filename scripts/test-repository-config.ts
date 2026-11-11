import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs'
import { spawnSync } from 'node:child_process'
import yaml from 'js-yaml'
import { PATHS, ROOT } from './lib'
import { resolveRepository } from './repository'

test('auto读取GitHub、Netlify、Vercel和Git来源，且不携带远程凭据', () => {
  for (const [env, origin, expected] of [
    [
      { GITHUB_REPOSITORY: 'alice/ForkBlog' },
      '',
      'https://github.com/alice/ForkBlog',
    ],
    [
      {
        REPOSITORY_URL:
          'https://oauth:TEST_ONLY_SECRET@github.com/bob/blog.git',
      },
      '',
      'https://github.com/bob/blog',
    ],
    [
      {
        VERCEL_GIT_PROVIDER: 'github',
        VERCEL_GIT_REPO_OWNER: 'carol',
        VERCEL_GIT_REPO_SLUG: 'blog',
      },
      '',
      'https://github.com/carol/blog',
    ],
    [{}, 'git@github.com:dave/blog.git', 'https://github.com/dave/blog'],
    [{}, 'ssh://git@github.com/eve/blog.git', 'https://github.com/eve/blog'],
    [
      { CI_PROJECT_URL: 'https://gitlab.com/frank/blog' },
      '',
      'https://gitlab.com/frank/blog',
    ],
    [{}, 'https://gitee.com/owner/blog.git', 'https://gitee.com/owner/blog'],
  ] as const) {
    const repo = resolveRepository('auto', env, origin)
    assert.equal(repo, expected)
    assert.ok(!repo.includes('TEST_ONLY_SECRET') && !repo.includes('oauth'))
  }
})

test('显式仓库地址不被托管环境覆盖，auto缺少来源不沿用作者仓库', () => {
  const explicit = 'https://gitlab.example/group/blog?projectId=123&branch=main'
  assert.equal(
    resolveRepository(explicit, { GITHUB_REPOSITORY: 'alice/fork' }, ''),
    explicit,
  )
  assert.equal(resolveRepository('auto', {}, ''), '')
  assert.equal(
    resolveRepository(
      'auto',
      { GITHUB_REPOSITORY: '../bad' },
      'not-a-repository',
    ),
    '',
  )
  assert.equal(
    resolveRepository('auto', {}, 'https://github.com/only-owner'),
    '',
  )
  assert.equal(
    resolveRepository('auto', {}, 'https://bitbucket.org/owner/blog'),
    '',
  )
  assert.equal(
    resolveRepository('auto', {}, 'file://github.com/owner/blog'),
    '',
  )
  assert.throws(
    () =>
      resolveRepository(
        'https://user:TEST_ONLY_SECRET@github.com/alice/blog',
        {},
        '',
      ),
    /登录凭据|仓库地址/,
  )
})

const forkEnv = {
  ...process.env,
  GITHUB_REPOSITORY: 'fork-owner/NewBlog',
  GITHUB_SERVER_URL: 'https://github.com',
}
function command(
  script: string,
  env: NodeJS.ProcessEnv,
  input?: string,
  timeout = 10_000,
) {
  return spawnSync(process.execPath, ['--import', 'tsx', script], {
    cwd: ROOT,
    env,
    input,
    encoding: 'utf8',
    windowsHide: true,
    timeout,
  })
}

test('真实prepare使用Fork地址，显式地址优先，无来源停止构建', () => {
  const original = fs.readFileSync(PATHS.config, 'utf8'),
    index = fs.readFileSync(PATHS.postsIndex)
  const raw = yaml.load(original) as Record<string, unknown>
  try {
    fs.writeFileSync(
      PATHS.config,
      yaml.dump({ ...raw, gitRepoUrl: 'auto', imageRepoUrl: 'auto' }),
    )
    let run = command('scripts/prepare.ts', forkEnv)
    assert.equal(run.status, 0, run.stderr)
    let generated = JSON.parse(
      fs.readFileSync(`${PATHS.generated}/config.json`, 'utf8'),
    )
    assert.equal(generated.gitRepoUrl, 'https://github.com/fork-owner/NewBlog')
    assert.equal(
      generated.imageRepoUrl,
      'https://github.com/fork-owner/NewBlog?branch=images',
    )
    fs.writeFileSync(
      PATHS.config,
      yaml.dump({
        ...raw,
        gitRepoUrl: 'https://github.com/chosen-owner/content',
        imageRepoUrl: 'https://github.com/image-owner/photos?branch=media',
      }),
    )
    run = command('scripts/prepare.ts', forkEnv)
    assert.equal(run.status, 0, run.stderr)
    generated = JSON.parse(
      fs.readFileSync(`${PATHS.generated}/config.json`, 'utf8'),
    )
    assert.equal(
      generated.gitRepoUrl,
      'https://github.com/chosen-owner/content',
    )
    assert.equal(
      generated.imageRepoUrl,
      'https://github.com/image-owner/photos?branch=media',
    )
    fs.writeFileSync(
      PATHS.config,
      yaml.dump({ ...raw, gitRepoUrl: 'auto', imageRepoUrl: 'auto' }),
    )
    const noSource = {
      ...process.env,
      PATH: '',
      GITHUB_REPOSITORY: '',
      REPOSITORY_URL: '',
      VERCEL_GIT_PROVIDER: '',
      CI_PROJECT_URL: '',
    }
    const before = fs.readFileSync(`${PATHS.generated}/config.json`, 'utf8')
    run = command('scripts/prepare.ts', noSource)
    assert.notEqual(run.status, 0)
    assert.match(run.stderr, /无法识别博客仓库|pnpm run setup/)
    assert.equal(
      fs.readFileSync(`${PATHS.generated}/config.json`, 'utf8'),
      before,
    )
  } finally {
    fs.writeFileSync(PATHS.config, original)
    const restore = command('scripts/prepare.ts', process.env)
    fs.writeFileSync(PATHS.postsIndex, index)
    assert.equal(restore.status, 0, restore.stderr)
  }
})

test('初始化保留auto供后续Fork使用，无Git来源时可填写完整地址', () => {
  const config = fs.readFileSync(PATHS.config, 'utf8'),
    settings = fs.readFileSync(PATHS.settings),
    index = fs.readFileSync(PATHS.postsIndex)
  const raw = yaml.load(config) as Record<string, unknown>
  const input =
    ['', '', '', '2', '', '', '', '', '', '', '', 'n'].join('\n') + '\n'
  try {
    fs.writeFileSync(
      PATHS.config,
      yaml.dump({ ...raw, gitRepoUrl: 'auto', imageRepoUrl: 'auto' }),
    )
    let run = command('scripts/init.ts', forkEnv, input)
    assert.equal(run.status, 0, run.stderr)
    let saved = yaml.load(fs.readFileSync(PATHS.config, 'utf8')) as Record<
      string,
      unknown
    >
    assert.equal(saved.gitRepoUrl, 'auto')
    assert.equal(saved.imageRepoUrl, 'auto')
    const noSource = {
      ...process.env,
      PATH: '',
      GITHUB_REPOSITORY: '',
      REPOSITORY_URL: '',
      VERCEL_GIT_PROVIDER: '',
      CI_PROJECT_URL: '',
    }
    run = command(
      'scripts/init.ts',
      noSource,
      'https://github.com/manual-owner/blog\n' + input.slice(1),
    )
    assert.equal(run.status, 0, run.stderr)
    saved = yaml.load(fs.readFileSync(PATHS.config, 'utf8')) as Record<
      string,
      unknown
    >
    assert.equal(saved.gitRepoUrl, 'https://github.com/manual-owner/blog')
    assert.equal(
      saved.imageRepoUrl,
      'https://github.com/manual-owner/blog?branch=images',
    )
  } finally {
    fs.writeFileSync(PATHS.config, config)
    fs.writeFileSync(PATHS.settings, settings)
    fs.writeFileSync(PATHS.postsIndex, index)
  }
})

test('自动模式优先使用本次GitHub构建仓库，并保留仓库大小写', () => {
  assert.equal(
    resolveRepository(
      'auto',
      { GITHUB_REPOSITORY: 'fork-owner/NewBlog' },
      'https://github.com/dragonadd/Navblog.git',
    ),
    'https://github.com/fork-owner/NewBlog',
  )
})

test('初始化校验主仓库和图片地址，含凭据或SSH输入不会写入YAML', () => {
  const config = fs.readFileSync(PATHS.config, 'utf8'),
    settings = fs.readFileSync(PATHS.settings)
  const raw = yaml.load(config) as Record<string, unknown>
  const rest = ['', '', '2', '', '', '', '', '', '', '', 'n']
  try {
    for (const bad of [
      'https://user:TEST_ONLY_SECRET@github.com/owner/blog',
      'ssh://git@github.com/owner/blog',
      'https://github.com/owner/blog?access_token=TEST_ONLY_SECRET',
      'https://github.com/owner/blog#access_token=TEST_ONLY_SECRET',
    ]) {
      fs.writeFileSync(
        PATHS.config,
        yaml.dump({ ...raw, gitRepoUrl: 'auto', imageRepoUrl: 'auto' }),
      )
      let run = command(
        'scripts/init.ts',
        forkEnv,
        [bad, 'https://github.com/safe-owner/blog', ...rest].join('\n') + '\n',
      )
      assert.equal(run.status, 0, run.stderr)
      let saved = yaml.load(fs.readFileSync(PATHS.config, 'utf8')) as Record<
        string,
        unknown
      >
      assert.equal(saved.gitRepoUrl, 'https://github.com/safe-owner/blog')
      assert.ok(
        !fs.readFileSync(PATHS.config, 'utf8').includes('TEST_ONLY_SECRET'),
      )
      fs.writeFileSync(
        PATHS.config,
        yaml.dump({ ...raw, gitRepoUrl: 'auto', imageRepoUrl: 'auto' }),
      )
      run = command(
        'scripts/init.ts',
        forkEnv,
        ['', '', bad, 'auto', '2', '', '', '', '', '', '', '', 'n'].join('\n') +
          '\n',
      )
      assert.equal(run.status, 0, run.stderr)
      saved = yaml.load(fs.readFileSync(PATHS.config, 'utf8')) as Record<
        string,
        unknown
      >
      assert.equal(saved.imageRepoUrl, 'auto')
      assert.ok(
        !fs.readFileSync(PATHS.config, 'utf8').includes('TEST_ONLY_SECRET'),
      )
    }
  } finally {
    fs.writeFileSync(PATHS.config, config)
    fs.writeFileSync(PATHS.settings, settings)
  }
})

test('初始化EOF立即退出且不写配置，不会在无来源时循环', () => {
  const config = fs.readFileSync(PATHS.config, 'utf8'),
    settings = fs.readFileSync(PATHS.settings)
  const noSource = {
    ...process.env,
    PATH: '',
    GITHUB_REPOSITORY: '',
    REPOSITORY_URL: '',
    VERCEL_GIT_PROVIDER: '',
    CI_PROJECT_URL: '',
  }
  const run = command('scripts/init.ts', noSource, '', 3000)
  assert.equal(run.status, 1)
  assert.match(run.stderr, /输入.*结束|未保存|取消/)
  assert.equal(fs.readFileSync(PATHS.config, 'utf8'), config)
  assert.deepEqual(fs.readFileSync(PATHS.settings), settings)
})

test('初始化图片默认分支保留显式源码URL已有的项目参数', () => {
  const config = fs.readFileSync(PATHS.config, 'utf8'),
    settings = fs.readFileSync(PATHS.settings)
  const input =
    [
      'https://gitlab.example/group/blog?projectId=123&branch=develop',
      '',
      '',
      '2',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      'n',
    ].join('\n') + '\n'
  try {
    const run = command('scripts/init.ts', forkEnv, input)
    assert.equal(run.status, 0, run.stderr)
    const saved = yaml.load(fs.readFileSync(PATHS.config, 'utf8')) as Record<
      string,
      unknown
    >
    assert.equal(
      saved.imageRepoUrl,
      'https://gitlab.example/group/blog?projectId=123&branch=images',
    )
  } finally {
    fs.writeFileSync(PATHS.config, config)
    fs.writeFileSync(PATHS.settings, settings)
  }
})
