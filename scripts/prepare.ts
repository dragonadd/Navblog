// 构建前准备：
// 1. 从 data/posts/*.md 的 front matter 重新生成文章索引 data/posts.json
// 2. 把配置/设置/索引写入 src/generated/ 供前端打包
// 3. 根据 src/index.template.html 生成 src/index.html（标题、favicon、base href、自定义 head）
import fs from 'node:fs'
import {
  PATHS,
  readConfig,
  readSettings,
  readPostFiles,
  escapeHtml,
  ensureDir,
  createManifest,
  readMoments,
  readAuth,
} from './lib'
import { renderCustomResources } from '../src/shared/custom-resources'
import { resolveDark } from '../src/shared/theme-settings'

const config = readConfig()
if (!config.branch)
  throw new Error(
    '无法识别部署分支，请在 blog.config.yaml 指定 branch，或运行 pnpm run setup',
  )
if (!config.gitRepoUrl)
  throw new Error(
    '无法识别博客仓库，请设置 Git origin、运行 pnpm run setup，或在 blog.config.yaml 填写完整的 gitRepoUrl',
  )
const settings = readSettings()
const posts = readPostFiles().map((p) => p.meta)
const published = posts.filter((p) => !p.draft)
const moments = readMoments()
const auth = readAuth()
if (settings.pwaEnable) createManifest(settings, config.baseHref)

fs.writeFileSync(PATHS.postsIndex, JSON.stringify(posts, null, 2) + '\n')
ensureDir(PATHS.generated)
const publicPosts = `${PATHS.generated}/published-posts`
ensureDir(publicPosts)
const publishedFiles = new Set(published.map((p) => p.slug + '.md'))
for (const file of fs.readdirSync(publicPosts)) {
  if (file.endsWith('.md') && !publishedFiles.has(file))
    fs.rmSync(`${publicPosts}/${file}`)
}
for (const p of published)
  fs.copyFileSync(
    `${PATHS.postsDir}/${p.slug}.md`,
    `${publicPosts}/${p.slug}.md`,
  )
ensureDir(`${PATHS.generated}/auth`)
if (auth) fs.writeFileSync(`${PATHS.generated}/auth/auth.json`, auth)
else fs.rmSync(`${PATHS.generated}/auth/auth.json`, { force: true })
fs.writeFileSync(
  `${PATHS.generated}/moments.json`,
  JSON.stringify(moments, null, 2),
)
fs.writeFileSync(
  `${PATHS.generated}/config.json`,
  JSON.stringify(config, null, 2),
)
fs.writeFileSync(
  `${PATHS.generated}/settings.json`,
  JSON.stringify(settings, null, 2),
)
fs.writeFileSync(
  `${PATHS.generated}/posts.json`,
  JSON.stringify(published, null, 2),
)

let html = fs.readFileSync(PATHS.indexTemplate, 'utf8')
const title = settings.subtitle
  ? `${settings.title} - ${settings.subtitle}`
  : settings.title
html = html
  .replace(
    '<!-- blog:base -->',
    () => `<base href="${escapeHtml(config.baseHref)}" />`,
  )
  .replace('<!-- blog:title -->', () => `<title>${escapeHtml(title)}</title>`)
  .replace('<!-- blog:pwa -->', () =>
    settings.pwaEnable
      ? `<link rel="manifest" href="manifest.webmanifest" /><meta name="theme-color" content="${escapeHtml(settings.pwaThemeColor || '#b8a320')}" />` +
        (settings.pwaIcon
          ? `<link rel="apple-touch-icon" href="${escapeHtml(settings.pwaIcon)}" />`
          : '')
      : '',
  )
  .replace('<!-- blog:meta -->', () =>
    [
      `<meta name="description" content="${escapeHtml(settings.description)}" />`,
      `<meta name="keywords" content="${escapeHtml(settings.keywords)}" />`,
      `<meta name="author" content="${escapeHtml(settings.author)}" />`,
      `<meta property="og:type" content="website" />`,
      `<meta property="og:site_name" content="${escapeHtml(settings.title)}" />`,
      `<meta property="og:title" content="${escapeHtml(title)}" />`,
      `<meta property="og:description" content="${escapeHtml(settings.description)}" />`,
      settings.favicon
        ? `<link rel="icon" href="${escapeHtml(settings.favicon)}" />`
        : '',
      settings.rssEnable !== false
        ? `<link rel="alternate" type="application/rss+xml" title="${escapeHtml(settings.title)}" href="rss.xml" />`
        : '',
    ]
      .filter(Boolean)
      .join('\n    '),
  )
  .replace(
    '<!-- blog:theme -->',
    () =>
      `<script>window.__BLOG_HUE__=${Number.isFinite(Number(settings.themeHue)) ? Math.min(360, Math.max(0, Number(settings.themeHue))) : 52};window.__BLOG_THEME_FIXED__=${!!settings.themeFixed};window.__BLOG_APPEARANCE__=${JSON.stringify({ appearance: settings.appearance, darkStart: settings.darkStart, darkEnd: settings.darkEnd }).replace(/</g, '\\u003c')};window.__BLOG_RESOLVE_DARK__=${resolveDark.toString()};</script>`,
  )
  .replace('<!-- blog:head -->', () => settings.headHtml || '')
fs.writeFileSync(
  PATHS.indexHtml,
  renderCustomResources(html, settings, config.baseHref),
)

console.log(`[prepare] ${posts.length} 篇文章，baseHref=${config.baseHref}`)
