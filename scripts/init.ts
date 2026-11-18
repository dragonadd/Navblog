// 交互式初始化：pnpm run setup
// 填写仓库地址、站点信息，写入 blog.config.yaml 与 data/settings.json，可选清空示例文章。
import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import yaml from 'js-yaml'
import { PATHS, ROOT, readSettings } from './lib'
import {
  readRepositoryOrigin,
  resolveRepository,
  readRepositoryBranch,
  resolveBranch,
} from './repository'
import type { BlogConfig } from '../src/shared/types'

const rl = readline.createInterface({
  input: stdin,
  output: stdout,
  terminal: !!stdin.isTTY,
})
// 使用异步迭代器读取行：管道输入时也不会丢行
const lines = rl[Symbol.asyncIterator]()

async function prompt(text: string): Promise<string> {
  stdout.write(text)
  const { value, done } = await lines.next()
  if (done) throw new Error('初始化输入已结束，已取消，未保存配置')
  if (!stdin.isTTY) stdout.write('\n')
  return String(value)
}

async function ask(question: string, def = ''): Promise<string> {
  const hint = def ? ` (${def})` : ''
  const answer = (await prompt(`? ${question}${hint}: `)).trim()
  return answer || def
}

async function confirm(question: string, def = false): Promise<boolean> {
  const answer = (await prompt(`? ${question} (${def ? 'Y/n' : 'y/N'}): `))
    .trim()
    .toLowerCase()
  if (!answer) return def
  return answer === 'y' || answer === 'yes'
}

function parseRepo(
  url: string,
): { host: string; owner: string; repo: string } | null {
  try {
    const u = new URL(url)
    const [owner, repo] = u.pathname.replace(/^\/+|\.git$|\/+$/g, '').split('/')
    if (!owner || !repo) return null
    return { host: u.hostname, owner, repo }
  } catch {
    return null
  }
}

function yamlStr(v: string): string {
  return /^[\w:/.?=&@-]*$/.test(v) ? v : JSON.stringify(v)
}

async function main() {
  console.log('\n🌸 NavBlog 初始化向导（直接回车使用括号中的默认值）\n')
  const config = (yaml.load(fs.readFileSync(PATHS.config, 'utf8')) ||
    {}) as Partial<BlogConfig>
  const detected = resolveRepository(
    'auto',
    process.env,
    readRepositoryOrigin(ROOT),
  )
  const settings = readSettings()

  // 1. 仓库
  let repoUrl = ''
  let repoSetting = ''
  let repoDefault =
    config.gitRepoUrl === 'auto'
      ? detected
        ? 'auto'
        : ''
      : String(config.gitRepoUrl || '')
  if (repoDefault !== 'auto') {
    try {
      repoDefault = resolveRepository(repoDefault, process.env, '')
    } catch {
      repoDefault = ''
    } // 不把配置中的登录凭据显示到提示。
  }
  while (true) {
    repoSetting = await ask(
      '博客仓库地址（auto 自动识别，或完整 GitHub / Gitee / GitLab URL）',
      repoDefault,
    )
    try {
      repoUrl =
        repoSetting === 'auto'
          ? detected
          : resolveRepository(repoSetting, process.env, '')
      if (parseRepo(repoUrl)) break
    } catch {}
    console.log(
      '  ✗ 请填写不含登录凭据的完整 HTTP(S) 仓库地址；auto 需要托管环境信息或 Git origin',
    )
  }
  const repo = parseRepo(repoUrl)!
  const detectedBranch = resolveBranch(
    'auto',
    process.env,
    readRepositoryBranch(ROOT),
  )
  const branchDefault =
    config.branch === 'auto'
      ? detectedBranch
        ? 'auto'
        : 'main'
      : config.branch || 'main'
  let branch = ''
  while (true) {
    branch = await ask('文章/凭证所在分支（auto 跟随部署分支）', branchDefault)
    try {
      if (branch === 'auto' || resolveBranch(branch, {}, '')) break
    } catch {}
    console.log('  ✗ 请填写有效的 Git 分支名称或 auto')
  }
  const imageDefault = new URL(repoUrl)
  imageDefault.searchParams.set('branch', 'images')
  let imageRepoUrl = ''
  while (true) {
    imageRepoUrl = await ask(
      '图片存放位置（auto 跟随博客仓库，或仓库地址?branch=分支）',
      repoSetting === 'auto' ? 'auto' : imageDefault.href,
    )
    try {
      if (
        imageRepoUrl === 'auto' ||
        parseRepo(resolveRepository(imageRepoUrl, process.env, ''))
      )
        break
    } catch {}
    console.log('  ✗ 图片仓库请填写 auto 或不含登录凭据的完整 HTTP(S) 仓库地址')
  }

  // 2. 部署方式 → baseHref / siteUrl
  console.log('\n部署方式：')
  console.log('  1) GitHub Pages 项目页  https://<用户名>.github.io/<仓库名>/')
  console.log(
    '  2) GitHub Pages 用户页 / 自定义域名 / Netlify / Vercel / Cloudflare Pages（根路径）',
  )
  const mode = await ask('请选择', repo.repo.endsWith('.github.io') ? '2' : '1')
  let baseHref = '/'
  let siteUrl =
    config.siteUrl && !/example\.com/.test(config.siteUrl) ? config.siteUrl : ''
  if (mode === '1') {
    baseHref = `/${repo.repo}/`
    siteUrl = siteUrl || `https://${repo.owner.toLowerCase()}.github.io`
  }
  siteUrl = await ask(
    '站点域名（只填协议+域名，不含子路径；不知道可留空）',
    siteUrl,
  )

  // 3. 站点信息
  console.log('')
  settings.title = await ask('博客标题', settings.title)
  settings.subtitle = await ask('副标题', settings.subtitle)
  settings.description = await ask('站点描述（SEO）', settings.description)
  settings.author = await ask(
    '作者昵称',
    settings.author === '你的昵称' ? repo.owner : settings.author,
  )
  const avatarDef = repo.host.includes('github')
    ? `https://github.com/${repo.owner}.png`
    : settings.avatar
  settings.avatar = await ask(
    '头像地址',
    settings.avatar === 'avatar.svg' ? avatarDef : settings.avatar,
  )
  settings.since =
    Number(await ask('建站年份', String(new Date().getFullYear()))) ||
    new Date().getFullYear()

  const profile = `https://${repo.host}/${repo.owner}`
  const icon = repo.host.includes('gitee')
    ? 'fas fa-code-branch'
    : repo.host.includes('gitlab')
      ? 'fab fa-gitlab'
      : 'fab fa-github'
  const label = repo.host.includes('gitee')
    ? 'Gitee'
    : repo.host.includes('gitlab')
      ? 'GitLab'
      : 'GitHub'
  if (!settings.social.some((s) => s.url === profile)) {
    settings.social = [{ icon, label, url: profile }, ...settings.social]
  }

  // 4. 示例内容
  const clean = await confirm(
    '\n是否删除示例文章（hello-world、markdown-guide）？',
    false,
  )

  rl.close()

  // 写入 blog.config.yaml（保留注释，只替换值）
  let yamlText = fs.readFileSync(PATHS.config, 'utf8')
  const setKey = (key: string, value: string) => {
    const re = new RegExp(`^${key}:.*$`, 'm')
    const line = `${key}: ${yamlStr(value)}`
    yamlText = re.test(yamlText)
      ? yamlText.replace(re, line)
      : `${yamlText.trimEnd()}\n${line}\n`
  }
  setKey('gitRepoUrl', repoSetting)
  setKey('branch', branch)
  setKey('imageRepoUrl', imageRepoUrl)
  setKey('siteUrl', siteUrl.replace(/\/+$/, ''))
  setKey('baseHref', baseHref)
  fs.writeFileSync(PATHS.config, yamlText)
  fs.writeFileSync(PATHS.settings, JSON.stringify(settings, null, 2) + '\n')

  if (clean) {
    for (const f of ['hello-world.md', 'markdown-guide.md']) {
      const p = path.join(PATHS.postsDir, f)
      if (fs.existsSync(p)) fs.unlinkSync(p)
    }
  }

  console.log('\n✅ 已写入 blog.config.yaml 与 data/settings.json')
  console.log('\n下一步：')
  console.log('  pnpm start          本地预览 http://localhost:7002')
  console.log('  git add . && git commit -m "init blog" && git push')
  console.log('  然后按 README「部署」一节在托管平台开启自动部署\n')
}

main().catch((e) => {
  rl.close()
  console.error(e)
  process.exit(1)
})
