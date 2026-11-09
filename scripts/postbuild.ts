// 构建后处理：为每篇文章及列表页生成静态 HTML（SEO），并生成 sitemap / RSS / 404 等
import fs from 'node:fs'
import path from 'node:path'
import { PATHS, readConfig, readSettings, readPostFiles, escapeHtml, ensureDir } from './lib'
import { renderMarkdown } from '../src/shared/markdown'
import { parseFrontMatter } from '../src/shared/frontmatter'
import type { PostMeta } from '../src/shared/types'

const config = readConfig()
const settings = readSettings()
const all = readPostFiles()
const posts = all.filter((p) => !p.meta.draft)
const dist = PATHS.dist
const template = fs.readFileSync(path.join(dist, 'index.html'), 'utf8')
const siteRoot = config.siteUrl ? config.siteUrl + config.baseHref : ''

const abs = (p: string) => (siteRoot ? siteRoot + p.replace(/^\//, '') : config.baseHref + p.replace(/^\//, ''))
const enc = (s: string) => encodeURIComponent(s)
const fmtDate = (d?: string) => (d || '').slice(0, 10)
const toDate = (d?: string) => {
  const t = new Date((d || '').replace(' ', 'T'))
  return isNaN(t.getTime()) ? new Date() : t
}

interface PageOptions {
  route: string // 相对路径，例如 posts/hello/
  title?: string
  description?: string
  image?: string
  type?: 'website' | 'article'
  body: string
  extraHead?: string
}

function siteTitle(title?: string) {
  return title ? `${title} - ${settings.title}` : settings.subtitle ? `${settings.title} - ${settings.subtitle}` : settings.title
}

function renderPage(o: PageOptions): string {
  const title = siteTitle(o.title)
  const desc = o.description || settings.description
  let html = template
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(title)}</title>`)
  html = html.replace(/<meta name="description" content="[^"]*"\s*\/?>/, `<meta name="description" content="${escapeHtml(desc)}" />`)
  html = html.replace(/<meta property="og:title" content="[^"]*"\s*\/?>/, `<meta property="og:title" content="${escapeHtml(title)}" />`)
  html = html.replace(/<meta property="og:description" content="[^"]*"\s*\/?>/, `<meta property="og:description" content="${escapeHtml(desc)}" />`)
  html = html.replace(/<meta property="og:type" content="[^"]*"\s*\/?>/, `<meta property="og:type" content="${o.type || 'website'}" />`)
  const head = [
    siteRoot ? `<link rel="canonical" href="${escapeHtml(abs(o.route))}" />` : '',
    siteRoot ? `<meta property="og:url" content="${escapeHtml(abs(o.route))}" />` : '',
    o.image ? `<meta property="og:image" content="${escapeHtml(o.image)}" />` : '',
    `<meta name="twitter:card" content="${o.image ? 'summary_large_image' : 'summary'}" />`,
    o.extraHead || '',
  ]
    .filter(Boolean)
    .join('\n    ')
  html = html.replace('</head>', `    ${head}\n  </head>`)
  // 预渲染内容：搜索引擎/禁用 JS 时可见，Angular 启动后移除
  html = html.replace(
    /<app-root>\s*<\/app-root>/,
    `<div id="prerender" class="prerender-shell fuwari-card">${o.body}</div>\n    <app-root></app-root>`,
  )
  return html
}

function write(route: string, html: string) {
  const dir = path.join(dist, ...route.split('/').filter(Boolean))
  ensureDir(dir)
  fs.writeFileSync(path.join(dir, 'index.html'), html)
}

function link(route: string, text: string) {
  return `<a href="${escapeHtml(route)}">${escapeHtml(text)}</a>`
}

function listHtml(list: PostMeta[]) {
  return (
    '<ul>' +
    list
      .map(
        (p) =>
          `<li>${link(`posts/${enc(p.slug)}/`, p.title)} <time datetime="${fmtDate(p.date)}">${fmtDate(p.date)}</time>${
            p.summary ? `<p>${escapeHtml(p.summary)}</p>` : ''
          }</li>`,
      )
      .join('') +
    '</ul>'
  )
}

const nav = `<nav>${link('./', '首页')} · ${link('archive/', '归档')} · ${link('categories/', '分类')} · ${link('tags/', '标签')} · ${link('about/', '关于')}</nav>`

// ---------- 文章页 ----------
for (const { meta, body } of posts) {
  const { html } = renderMarkdown(body)
  const route = `posts/${meta.slug}/`
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: meta.title,
    datePublished: toDate(meta.date).toISOString(),
    dateModified: toDate(meta.updated || meta.date).toISOString(),
    author: { '@type': 'Person', name: settings.author },
    image: meta.cover || undefined,
    description: meta.summary,
    keywords: meta.tags.join(','),
  }
  const content = `${nav}<article><h1>${escapeHtml(meta.title)}</h1><p><time datetime="${fmtDate(meta.date)}">${fmtDate(meta.date)}</time>${
    meta.category ? ` · ${link(`categories/${enc(meta.category)}/`, meta.category)}` : ''
  }${meta.tags.map((t) => ` · ${link(`tags/${enc(t)}/`, '#' + t)}`).join('')}</p><div class="prose-blog">${html}</div></article>`
  write(
    route,
    renderPage({
      route,
      title: meta.title,
      description: meta.summary,
      image: meta.cover,
      type: 'article',
      body: content,
      extraHead: [
        `<meta property="article:published_time" content="${toDate(meta.date).toISOString()}" />`,
        ...meta.tags.map((t) => `<meta property="article:tag" content="${escapeHtml(t)}" />`),
        `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`,
      ].join('\n    '),
    }),
  )
}

// ---------- 列表页 ----------
const metas = posts.map((p) => p.meta)
const size = Math.max(1, Number(settings.postsPerPage) || 8)
const totalPages = Math.max(1, Math.ceil(posts.length / size))
const home = renderPage({ route: '', body: `<h1>${escapeHtml(settings.title)}</h1><p>${escapeHtml(settings.description)}</p>${nav}${listHtml(metas.slice(0, size))}` })
fs.writeFileSync(path.join(dist, 'index.html'), home)
for (let i = 2; i <= totalPages; i++) {
  write(`page/${i}/`, renderPage({ route: `page/${i}/`, title: `第 ${i} 页`, body: `${nav}${listHtml(metas.slice((i - 1) * size, i * size))}` }))
}
write('archive/', renderPage({ route: 'archive/', title: '归档', body: `<h1>归档</h1>${nav}${listHtml(metas)}` }))

const group = (key: (p: PostMeta) => string[]) => {
  const map = new Map<string, PostMeta[]>()
  for (const { meta } of posts) for (const k of key(meta)) map.set(k, [...(map.get(k) || []), meta])
  return map
}
for (const [type, label, map] of [
  ['categories', '分类', group((p) => (p.category ? [p.category] : []))],
  ['tags', '标签', group((p) => p.tags)],
] as const) {
  const items = [...map.entries()]
  write(
    `${type}/`,
    renderPage({
      route: `${type}/`,
      title: label,
      body: `<h1>${label}</h1>${nav}<ul>${items.map(([n, l]) => `<li>${link(`${type}/${enc(n)}/`, n)} (${l.length})</li>`).join('')}</ul>`,
    }),
  )
  for (const [name, list] of items) {
    write(`${type}/${name}/`, renderPage({ route: `${type}/${enc(name)}/`, title: `${label}：${name}`, body: `<h1>${escapeHtml(name)}</h1>${nav}${listHtml(list)}` }))
  }
}

if (fs.existsSync(PATHS.about)) {
  const about = renderMarkdown(parseFrontMatter(fs.readFileSync(PATHS.about, 'utf8')).body).html
  write('about/', renderPage({ route: 'about/', title: '关于', body: `${nav}<div class="prose-blog">${about}</div>` }))
}
write('search/', renderPage({ route: 'search/', title: '搜索', body: nav }))

// 404 / SPA 回退（GitHub Pages 会在找不到页面时返回 404.html，由前端路由接管）
fs.writeFileSync(path.join(dist, '404.html'), template)
// 后台页面
write('admin/', renderPage({ route: 'admin/', title: '管理后台', body: '', extraHead: '<meta name="robots" content="noindex" />' }))

// 草稿不发布到线上
for (const { meta } of all.filter((p) => p.meta.draft)) {
  fs.rmSync(path.join(dist, 'content', 'posts', `${meta.slug}.md`), { force: true })
}

// ---------- sitemap / RSS / robots ----------
if (siteRoot) {
  const urls = [
    { loc: abs(''), lastmod: posts[0]?.meta.date },
    { loc: abs('archive/') },
    { loc: abs('categories/') },
    { loc: abs('tags/') },
    { loc: abs('about/') },
    ...posts.map((p) => ({ loc: abs(`posts/${enc(p.meta.slug)}/`), lastmod: p.meta.updated || p.meta.date })),
  ]
  fs.writeFileSync(
    path.join(dist, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
      .map((u) => `  <url><loc>${escapeHtml(u.loc)}</loc>${u.lastmod ? `<lastmod>${toDate(u.lastmod).toISOString()}</lastmod>` : ''}</url>`)
      .join('\n')}\n</urlset>\n`,
  )
}
const rssItems = posts.slice(0, 20).map(({ meta, body }) => {
  const url = abs(`posts/${enc(meta.slug)}/`)
  return `    <item>
      <title>${escapeHtml(meta.title)}</title>
      <link>${escapeHtml(url)}</link>
      <guid>${escapeHtml(url)}</guid>
      <pubDate>${toDate(meta.date).toUTCString()}</pubDate>
      ${meta.category ? `<category>${escapeHtml(meta.category)}</category>` : ''}
      <description><![CDATA[${renderMarkdown(body).html.replace(/]]>/g, ']]&gt;')}]]></description>
    </item>`
})
fs.writeFileSync(
  path.join(dist, 'rss.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeHtml(settings.title)}</title>
    <link>${escapeHtml(abs(''))}</link>
    <description>${escapeHtml(settings.description)}</description>
    <language>zh-CN</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${rssItems.join('\n')}
  </channel>
</rss>
`,
)
fs.writeFileSync(
  path.join(dist, 'robots.txt'),
  `User-agent: *\nAllow: /\nDisallow: ${config.baseHref}admin\n${siteRoot ? `Sitemap: ${abs('sitemap.xml')}\n` : ''}`,
)
// GitHub Pages：禁用 Jekyll
fs.writeFileSync(path.join(dist, '.nojekyll'), '')
// Cloudflare Pages / Netlify：SPA 回退（已存在的静态文件优先）
fs.writeFileSync(path.join(dist, '_redirects'), `${config.baseHref}* ${config.baseHref}index.html 200\n`)

console.log(`[postbuild] 已生成 ${posts.length} 篇文章静态页、${totalPages} 个分页、sitemap.xml、rss.xml、404.html`)
