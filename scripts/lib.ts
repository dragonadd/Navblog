// 构建脚本公共方法
import fs from 'node:fs'
import path from 'node:path'
import yaml from 'js-yaml'
import type { BlogConfig, BlogSettings, PostMeta } from '../src/shared/types'
import { parseFrontMatter, normalizeMeta, sortPosts } from '../src/shared/frontmatter'

export const ROOT = path.resolve(import.meta.dirname, '..')
export const PATHS = {
  config: path.join(ROOT, 'blog.config.yaml'),
  settings: path.join(ROOT, 'data', 'settings.json'),
  postsDir: path.join(ROOT, 'data', 'posts'),
  postsIndex: path.join(ROOT, 'data', 'posts.json'),
  about: path.join(ROOT, 'data', 'about.md'),
  generated: path.join(ROOT, 'src', 'generated'),
  indexTemplate: path.join(ROOT, 'src', 'index.template.html'),
  indexHtml: path.join(ROOT, 'src', 'index.html'),
  dist: path.join(ROOT, 'dist', 'browser'),
}

export function readConfig(): BlogConfig {
  const raw = (yaml.load(fs.readFileSync(PATHS.config, 'utf8')) || {}) as Partial<BlogConfig>
  // 环境变量优先（GitHub Actions 会自动注入，见 .github/workflows/deploy-gh-pages.yml）
  const env = process.env
  if (env['BLOG_BASE_HREF']) raw.baseHref = env['BLOG_BASE_HREF']
  // 站点地址：blog.config.yaml 未填写时，依次尝试各托管平台自动注入的环境变量
  if (!env['BLOG_SITE_URL']) {
    const vercel = env['VERCEL_PROJECT_PRODUCTION_URL']
    env['BLOG_SITE_URL'] = env['URL'] /* Netlify */ || (vercel ? `https://${vercel}` : '') || env['CF_PAGES_URL'] || ''
  }
  if (env['BLOG_SITE_URL'] && (!raw.siteUrl || /example\.com/.test(String(raw.siteUrl)))) {
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
    siteUrl: String(raw.siteUrl || '').trim().replace(/\/+$/, ''),
    baseHref,
  }
}

export function readSettings(): BlogSettings {
  return JSON.parse(fs.readFileSync(PATHS.settings, 'utf8'))
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
