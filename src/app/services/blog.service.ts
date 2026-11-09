import { Injectable, computed, signal } from '@angular/core'
import configJson from '../../generated/config.json'
import settingsJson from '../../generated/settings.json'
import postsJson from '../../generated/posts.json'
import type {
  BlogConfig,
  BlogSettings,
  PostMeta,
  TaxonomyItem,
  TocItem,
} from '../../shared/types'

function taxonomy(list: string[]): TaxonomyItem[] {
  const map = new Map<string, number>()
  for (const name of list) map.set(name, (map.get(name) || 0) + 1)
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}

/** 博客公共数据（构建时打包进来的设置与文章索引） */
@Injectable({ providedIn: 'root' })
export class BlogService {
  readonly config = configJson as BlogConfig
  readonly settings = signal<BlogSettings>(settingsJson as BlogSettings)
  readonly allPosts = signal<PostMeta[]>(postsJson as PostMeta[])
  readonly posts = computed(() => this.allPosts().filter((p) => !p.draft))
  readonly categories = computed(() =>
    taxonomy(this.posts().map((p) => p.category || '').filter(Boolean)),
  )
  readonly tags = computed(() => taxonomy(this.posts().flatMap((p) => p.tags || [])))
  /** 当前文章页的目录 */
  readonly toc = signal<TocItem[]>([])

  private cache = new Map<string, string>()

  /** 将相对路径解析为基于 <base href> 的绝对地址 */
  url(path: string): string {
    if (!path) return ''
    if (/^(https?:)?\/\//i.test(path) || path.startsWith('data:')) return path
    return new URL(path.replace(/^\//, ''), document.baseURI).href
  }

  findPost(slug: string): PostMeta | undefined {
    return this.posts().find((p) => p.slug === slug)
  }

  async fetchText(path: string): Promise<string> {
    if (this.cache.has(path)) return this.cache.get(path)!
    const res = await fetch(this.url(path), { cache: 'no-cache' })
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
    const text = await res.text()
    // 开发服务器对不存在的文件会回退到 index.html
    if (/^\s*<!doctype html/i.test(text)) throw new Error('404')
    this.cache.set(path, text)
    return text
  }

  getPostSource(slug: string): Promise<string> {
    return this.fetchText(`content/posts/${encodeURIComponent(slug)}.md`)
  }

  getAboutSource(): Promise<string> {
    return this.fetchText('content/about.md')
  }

  postsByCategory(name: string) {
    return this.posts().filter((p) => p.category === name)
  }

  postsByTag(name: string) {
    return this.posts().filter((p) => (p.tags || []).includes(name))
  }

  setTitle(title?: string) {
    const s = this.settings()
    document.title = title ? `${title} - ${s.title}` : s.subtitle ? `${s.title} - ${s.subtitle}` : s.title
  }
}

export function formatDate(date?: string): string {
  return (date || '').slice(0, 10)
}
