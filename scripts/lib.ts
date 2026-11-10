// 构建脚本公共方法
import fs from 'node:fs'
import { normalizeThemeSettings } from '../src/shared/theme-settings'
import { renderMarkdown } from '../src/shared/markdown'
import { parseMoments, formatMomentDate } from '../src/shared/moments'
import { parseAuth } from '../src/shared/auth'
import path from 'node:path'
import yaml from 'js-yaml'
import type { BlogConfig, BlogSettings, PostMeta } from '../src/shared/types'
import {
  parseFrontMatter,
  normalizeMeta,
  sortPosts,
} from '../src/shared/frontmatter'

export const ROOT = path.resolve(import.meta.dirname, '..')
export const PATHS = {
  config: path.join(ROOT, 'blog.config.yaml'),
  settings: path.join(ROOT, 'data', 'settings.json'),
  postsDir: path.join(ROOT, 'data', 'posts'),
  postsIndex: path.join(ROOT, 'data', 'posts.json'),
  about: path.join(ROOT, 'data', 'about.md'),
  moments: path.join(ROOT, 'data', 'moments.json'),
  auth: path.join(ROOT, 'data', 'auth.json'),
  generated: path.join(ROOT, 'src', 'generated'),
  indexTemplate: path.join(ROOT, 'src', 'index.template.html'),
  indexHtml: path.join(ROOT, 'src', 'index.html'),
  dist: path.join(ROOT, 'dist', 'browser'),
}

export function readConfig(): BlogConfig {
  const raw = (yaml.load(fs.readFileSync(PATHS.config, 'utf8')) ||
    {}) as Partial<BlogConfig>
  // 环境变量优先（GitHub Actions 会自动注入，见 .github/workflows/deploy-gh-pages.yml）
  const env = process.env
  if (env['BLOG_BASE_HREF']) raw.baseHref = env['BLOG_BASE_HREF']
  // 站点地址：blog.config.yaml 未填写时，依次尝试各托管平台自动注入的环境变量
  if (!env['BLOG_SITE_URL']) {
    const vercel = env['VERCEL_PROJECT_PRODUCTION_URL']
    env['BLOG_SITE_URL'] =
      env['URL'] /* Netlify */ ||
      (vercel ? `https://${vercel}` : '') ||
      env['CF_PAGES_URL'] ||
      ''
  }
  if (
    env['BLOG_SITE_URL'] &&
    (!raw.siteUrl || /example\.com/.test(String(raw.siteUrl)))
  ) {
    // siteUrl 只保留 origin（子路径由 baseHref 表示）
    try {
      raw.siteUrl = new URL(env['BLOG_SITE_URL']).origin
    } catch {
      /* ignore */
    }
  }
  let baseHref = String(raw.baseHref || '/').trim()
  if (!baseHref.startsWith('/')) baseHref = '/' + baseHref
  if (!baseHref.endsWith('/')) baseHref += '/'
  return {
    gitRepoUrl: String(raw.gitRepoUrl || '').trim(),
    branch: String(raw.branch || 'main').trim(),
    imageRepoUrl: String(raw.imageRepoUrl || '').trim(),
    siteUrl: String(raw.siteUrl || '')
      .trim()
      .replace(/\/+$/, ''),
    baseHref,
  }
}

export function readSettings(): BlogSettings {
  return normalizeThemeSettings(
    JSON.parse(fs.readFileSync(PATHS.settings, 'utf8')),
  )
}

export function readMoments() {
  return fs.existsSync(PATHS.moments)
    ? parseMoments(fs.readFileSync(PATHS.moments, 'utf8'))
    : []
}

export function readAuth(): string | null {
  if (!fs.existsSync(PATHS.auth)) return null
  const source = fs.readFileSync(PATHS.auth, 'utf8')
  return source.trim()
    ? JSON.stringify(parseAuth(source), null, 2) + '\n'
    : null
}

export function momentsHtml(source: string): string {
  const items = parseMoments(source)
  return items.length
    ? '<ol>' +
        items
          .map(
            (m) =>
              `<li id="moment-${m.id}"><time datetime="${m.date}">${escapeHtml(formatMomentDate(m.date))}</time><p class="whitespace-pre-line break-words">${escapeHtml(m.text)}</p></li>`,
          )
          .join('') +
        '</ol>'
    : '<p>还没有碎碎念。</p>'
}

export interface PostFile {
  meta: PostMeta
  body: string
}

/** 读取 data/posts 下所有 Markdown 文章（以 front matter 为准） */
export function readPostFiles(): PostFile[] {
  if (!fs.existsSync(PATHS.postsDir)) return []
  const files = fs.readdirSync(PATHS.postsDir).filter((f) => f.endsWith('.md'))
  const list = files.map((file) => {
    const slug = file.replace(/\.md$/, '')
    const source = fs.readFileSync(path.join(PATHS.postsDir, file), 'utf8')
    const { data, body } = parseFrontMatter(source)
    return { meta: normalizeMeta(data, slug, body), body }
  })
  const sorted = sortPosts(list.map((p) => p.meta))
  return sorted.map((m) => list.find((p) => p.meta.slug === m.slug)!)
}

export function escapeHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true })
}

export function createManifest(settings: BlogSettings, baseHref: string) {
  const s = normalizeThemeSettings(settings)
  const icons: { src: string; sizes: string; type: string; purpose: string }[] =
    []
  const publicRoot = fs.realpathSync(path.join(ROOT, 'public'))
  for (const [value, size, purpose] of [
    [s.pwaIcon192, 192, 'any'],
    [s.pwaIcon512, 512, 'any'],
    [s.pwaIcon192Maskable, 192, 'maskable'],
    [s.pwaIcon512Maskable, 512, 'maskable'],
  ] as const) {
    if (!value) continue
    if (!/^[\w\-/]+\.png$/i.test(value) || value.startsWith('/'))
      throw new Error('安装图标请填写 public/ 内的相对 PNG 路径')
    const file = fs.realpathSync(path.join(publicRoot, value))
    if (!file.startsWith(publicRoot + path.sep))
      throw new Error('安装图标不能超出 public/ 目录')
    const bytes = fs.readFileSync(file)
    if (
      bytes.length < 24 ||
      !bytes
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
      bytes.toString('ascii', 12, 16) !== 'IHDR' ||
      bytes.readUInt32BE(16) !== size ||
      bytes.readUInt32BE(20) !== size
    )
      throw new Error(`安装图标 ${value} 必须是 ${size}×${size} PNG`)
    icons.push({
      src: baseHref + value,
      sizes: `${size}x${size}`,
      type: 'image/png',
      purpose,
    })
  }
  return {
    name: s.pwaName || s.title,
    short_name: s.pwaShortName || s.pwaName || s.title,
    description: s.description,
    theme_color: s.pwaThemeColor,
    background_color: s.pwaBackgroundColor,
    display: 'standalone',
    scope: baseHref,
    start_url: baseHref,
    icons,
  }
}

export function rssContent(
  meta: PostMeta,
  body: string,
  fullContent: boolean,
): string {
  if (meta.encrypted)
    return `<p>${escapeHtml(meta.summary || '')}</p><p>请访问文章页面输入密码阅读。</p>`
  return fullContent
    ? renderMarkdown(body).html
    : `<p>${escapeHtml(meta.summary || '')}</p>`
}
