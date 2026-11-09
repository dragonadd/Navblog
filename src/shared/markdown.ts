// Markdown 渲染（浏览器端与构建脚本共用）
import { Marked, type Tokens } from 'marked'
import { markedHighlight } from 'marked-highlight'
import hljs from 'highlight.js/lib/common'
import type { TocItem } from './types'

export interface RenderResult {
  html: string
  toc: TocItem[]
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function headingId(text: string, used: Map<string, number>): string {
  let base = text
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z]+;/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}-]/gu, '')
  if (!base) base = 'section'
  const n = used.get(base) || 0
  used.set(base, n + 1)
  return n ? `${base}-${n}` : base
}

export interface RenderOptions {
  /** 把相对图片地址补全的前缀 */
  baseUrl?: string
}

export function renderMarkdown(md: string, _opts: RenderOptions = {}): RenderResult {
  const toc: TocItem[] = []
  const used = new Map<string, number>()

  const marked = new Marked(
    markedHighlight({
      emptyLangClass: 'hljs',
      langPrefix: 'hljs language-',
      highlight(code, lang) {
        const language = lang && hljs.getLanguage(lang) ? lang : ''
        if (language) {
          return hljs.highlight(code, { language }).value
        }
        return escapeHtml(code)
      },
    }),
  )

  marked.use({
    gfm: true,
    breaks: false,
    renderer: {
      heading(this: any, token: Tokens.Heading) {
        const inner = this.parser.parseInline(token.tokens)
        const plain = inner.replace(/<[^>]+>/g, '')
        const id = headingId(plain, used)
        if (token.depth >= 2 && token.depth <= 4) {
          toc.push({ id, text: plain, level: token.depth })
        }
        return `<h${token.depth} id="${id}" class="md-heading"><a class="md-anchor" href="#${id}" aria-hidden="true">#</a>${inner}</h${token.depth}>\n`
      },
      code(token: Tokens.Code) {
        const lang = (token.lang || '').split(/\s/)[0]
        const cls = lang ? `hljs language-${escapeHtml(lang)}` : 'hljs'
        // token.text 已经被 markedHighlight 高亮处理
        const body = token.escaped ? token.text : escapeHtml(token.text)
        return `<div class="code-block"><div class="code-head"><span class="code-lang">${escapeHtml(lang || 'text')}</span><button type="button" class="code-copy" title="复制代码"><i class="far fa-copy"></i></button></div><pre><code class="${cls}">${body}</code></pre></div>\n`
      },
      table(this: any, token: Tokens.Table) {
        let header = ''
        for (const cell of token.header) {
          header += this.tablecell(cell)
        }
        let body = ''
        for (const row of token.rows) {
          let r = ''
          for (const cell of row) r += this.tablecell(cell)
          body += `<tr>${r}</tr>`
        }
        return `<div class="table-wrap"><table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table></div>\n`
      },
      link(this: any, token: Tokens.Link) {
        const text = this.parser.parseInline(token.tokens)
        const href = token.href || ''
        const external = /^https?:\/\//i.test(href)
        const title = token.title ? ` title="${escapeHtml(token.title)}"` : ''
        return `<a href="${escapeHtml(href)}"${title}${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${text}</a>`
      },
      image(token: Tokens.Image) {
        const title = token.title ? ` title="${escapeHtml(token.title)}"` : ''
        return `<img src="${escapeHtml(token.href)}" alt="${escapeHtml(token.text)}"${title} loading="lazy" />`
      },
    },
  })

  const html = marked.parse(md, { async: false }) as string
  return { html, toc }
}
