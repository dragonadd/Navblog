import { Injectable, inject, signal } from '@angular/core'
import { BlogService } from '../services/blog.service'
import { GitService } from '../services/git.service'
import type { BlogSettings, PostMeta } from '../../shared/types'
import { normalizeMeta, parseFrontMatter, sortPosts, stringifyPost } from '../../shared/frontmatter'

export const PATH_INDEX = 'data/posts.json'
export const PATH_SETTINGS = 'data/settings.json'
export const PATH_ABOUT = 'data/about.md'
export const postPath = (slug: string) => `data/posts/${slug}.md`

/** 后台数据：从仓库读取最新内容（部署后的静态数据可能有延迟） */
@Injectable({ providedIn: 'root' })
export class AdminStore {
  private git = inject(GitService)
  private blog = inject(BlogService)
  readonly posts = signal<PostMeta[]>(this.blog.allPosts())
  readonly loaded = signal(false)

  async loadIndex() {
    const f = await this.git.getFile(PATH_INDEX)
    if (f) {
      try {
        this.posts.set(sortPosts(JSON.parse(f.content)))
      } catch {}
    }
    this.loaded.set(true)
  }

  async loadPost(slug: string): Promise<{ meta: PostMeta; body: string; data: Record<string, unknown> } | null> {
    const f = await this.git.getFile(postPath(slug))
    if (!f) return null
    const { data, body } = parseFrontMatter(f.content)
    return { meta: normalizeMeta(data, slug, body), body, data }
  }

  async savePost(meta: PostMeta, body: string, oldSlug?: string) {
    const md = stringifyPost(meta, body)
    const { data } = parseFrontMatter(md)
    const full = normalizeMeta(data, meta.slug, body)
    await this.loadIndex()
    const list = this.posts().filter((p) => p.slug !== meta.slug && p.slug !== oldSlug)
    list.push(full)
    const index = sortPosts(list)
    const changes = [
      { path: postPath(meta.slug), content: md },
      { path: PATH_INDEX, content: JSON.stringify(index, null, 2) + '\n' },
    ]
    if (oldSlug && oldSlug !== meta.slug) changes.push({ path: postPath(oldSlug), content: null as any })
    await this.git.commit(changes, `${oldSlug ? 'update' : 'create'} post: ${meta.title}`)
    this.posts.set(index)
  }

  async deletePost(slug: string) {
    await this.loadIndex()
    const index = this.posts().filter((p) => p.slug !== slug)
    await this.git.commit(
      [
        { path: postPath(slug), content: null },
        { path: PATH_INDEX, content: JSON.stringify(index, null, 2) + '\n' },
      ],
      `delete post: ${slug}`,
    )
    this.posts.set(index)
  }

  async loadSettings(): Promise<BlogSettings> {
    const f = await this.git.getFile(PATH_SETTINGS)
    const current = this.blog.settings()
    if (!f) return structuredClone(current)
    return { ...structuredClone(current), ...JSON.parse(f.content) }
  }

  async saveSettings(s: BlogSettings) {
    await this.git.commit([{ path: PATH_SETTINGS, content: JSON.stringify(s, null, 2) + '\n' }], 'update settings')
    this.blog.settings.set(s)
  }

  async loadAbout(): Promise<string> {
    const f = await this.git.getFile(PATH_ABOUT)
    return f?.content ?? ''
  }

  async saveAbout(md: string) {
    await this.git.commit([{ path: PATH_ABOUT, content: md }], 'update about')
  }
}
