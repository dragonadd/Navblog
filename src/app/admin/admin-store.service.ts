import { Injectable, inject, signal } from '@angular/core'
import { BlogService } from '../services/blog.service'
import { GitService, type FileChange } from '../services/git.service'
import type { BlogSettings, PostMeta, Moment } from '../../shared/types'
import { normalizeMoment, parseMoments } from '../../shared/moments'
import {
  normalizeMeta,
  parseFrontMatter,
  sortPosts,
  stringifyPost,
} from '../../shared/frontmatter'
import { encryptPostBody } from '../../shared/post-crypto'
import { mergeThemeSettings } from '../../shared/theme-settings'

export const PATH_INDEX = 'data/posts.json'
export const PATH_SETTINGS = 'data/settings.json'
export const PATH_ABOUT = 'data/about.md'
export const PATH_MOMENTS = 'data/moments.json'
export const postPath = (slug: string) => `data/posts/${slug}.md`

/** 后台数据：从仓库读取最新内容（部署后的静态数据可能有延迟） */
@Injectable({ providedIn: 'root' })
export class AdminStore {
  private git = inject(GitService)
  private blog = inject(BlogService)
  readonly posts = signal<PostMeta[]>(this.blog.allPosts())
  readonly loaded = signal(false)
  readonly moments = signal<Moment[]>([])
  private snapshots = new Map<string, string | null>()

  private async loadFile(path: string) {
    const file = await this.git.getFile(path)
    this.snapshots.set(path, file?.content ?? null)
    return file
  }

  private expected(path: string): string | null {
    if (!this.snapshots.has(path))
      throw new Error('请先读取文件再保存，避免覆盖未确认的修改')
    return this.snapshots.get(path)!
  }

  private async change(
    path: string,
    content: string | null,
    expected: string | null,
  ): Promise<FileChange> {
    const file = await this.git.getFile(path)
    if ((file?.content ?? null) !== expected)
      throw new Error('文件已被其他窗口修改，请重新读取后保存；当前输入已保留')
    return {
      path,
      content,
      expectedSha: file?.sha ?? null,
      expectedLastCommit: file?.lastCommit,
      expectedContent: expected,
    }
  }

  async loadMoments(): Promise<Moment[]> {
    return (await this.readMoments()).items
  }

  private async readMoments() {
    const file = await this.git.getFile(PATH_MOMENTS)
    const items = file ? parseMoments(file.content) : []
    this.moments.set(items)
    return { file, items }
  }

  async saveMoment(value: Moment, editing: boolean, original?: Moment) {
    const moment = normalizeMoment(value)
    const { file, items: current } = await this.readMoments()
    if (current.some((m) => m.id === moment.id) !== editing)
      throw new Error(
        editing ? '这条动态已被删除，请刷新后重试' : '动态 ID 已存在',
      )
    if (
      original &&
      JSON.stringify(current.find((m) => m.id === moment.id)) !==
        JSON.stringify(normalizeMoment(original))
    )
      throw new Error('这条动态已被修改，请刷新后重新编辑；当前草稿已保留')
    const items = parseMoments(
      JSON.stringify([...current.filter((m) => m.id !== moment.id), moment]),
    )
    await this.git.commit(
      [
        {
          path: PATH_MOMENTS,
          content: JSON.stringify(items, null, 2) + '\n',
          expectedSha: file?.sha ?? null,
          expectedLastCommit: file?.lastCommit,
          expectedContent: file?.content ?? null,
        },
      ],
      `${editing ? 'update' : 'create'} moment`,
    )
    this.moments.set(items)
  }

  async deleteMoment(id: string) {
    const { file, items: current } = await this.readMoments()
    if (!current.some((m) => m.id === id))
      throw new Error('这条动态已被删除，请刷新后重试')
    const items = current.filter((m) => m.id !== id)
    await this.git.commit(
      [
        {
          path: PATH_MOMENTS,
          content: JSON.stringify(items, null, 2) + '\n',
          expectedSha: file?.sha ?? null,
          expectedLastCommit: file?.lastCommit,
          expectedContent: file?.content ?? null,
        },
      ],
      'delete moment',
    )
    this.moments.set(items)
  }

  async loadIndex() {
    await this.readIndex()
    this.loaded.set(true)
  }

  private async readIndex() {
    const f = await this.git.getFile(PATH_INDEX)
    let items: PostMeta[] = []
    try {
      if (f) {
        const data = JSON.parse(f.content)
        if (
          !Array.isArray(data) ||
          data.some(
            (p) =>
              !p ||
              typeof p !== 'object' ||
              typeof p.slug !== 'string' ||
              !p.slug ||
              p.slug === '.' ||
              p.slug === '..' ||
              /[/\\\u0000-\u001f\u007f]/.test(p.slug) ||
              typeof p.title !== 'string' ||
              typeof p.date !== 'string' ||
              (p.hidden !== undefined && typeof p.hidden !== 'boolean') ||
              !Array.isArray(p.tags) ||
              p.tags.some((tag: unknown) => typeof tag !== 'string'),
          ) ||
          new Set(data.map((p) => p.slug)).size !== data.length
        )
          throw new Error()
        items = sortPosts(data)
      }
    } catch {
      throw new Error('文章索引 JSON 损坏，已停止操作，请修复或重新构建索引')
    }
    this.posts.set(items)
    return { file: f, items }
  }

  async loadPost(slug: string): Promise<{
    meta: PostMeta
    body: string
    data: Record<string, unknown>
  } | null> {
    const f = await this.loadFile(postPath(slug))
    if (!f) return null
    const { data, body } = parseFrontMatter(f.content)
    return { meta: normalizeMeta(data, slug, body), body, data }
  }

  async savePost(
    meta: PostMeta,
    body: string,
    oldSlug?: string,
    password?: string,
  ) {
    if (meta.encrypted && !password) throw new Error('保存加密文章需要密码')
    const storedBody = meta.encrypted
      ? await encryptPostBody(body, password!)
      : body
    const md = stringifyPost(meta, storedBody)
    const { data } = parseFrontMatter(md)
    const full = normalizeMeta(data, meta.slug, storedBody)
    const { file: indexFile, items: latest } = await this.readIndex()
    const list = latest.filter(
      (p) => p.slug !== meta.slug && p.slug !== oldSlug,
    )
    list.push(full)
    const index = sortPosts(list)
    const changes: FileChange[] = [
      await this.change(
        postPath(meta.slug),
        md,
        oldSlug === meta.slug ? this.expected(postPath(oldSlug)) : null,
      ),
      {
        path: PATH_INDEX,
        content: JSON.stringify(index, null, 2) + '\n',
        expectedSha: indexFile?.sha ?? null,
        expectedLastCommit: indexFile?.lastCommit,
        expectedContent: indexFile?.content ?? null,
      },
    ]
    if (oldSlug && oldSlug !== meta.slug)
      changes.push(
        await this.change(
          postPath(oldSlug),
          null,
          this.expected(postPath(oldSlug)),
        ),
      )
    await this.git.commit(
      changes,
      `${oldSlug ? 'update' : 'create'} post: ${meta.title}`,
    )
    this.snapshots.set(postPath(meta.slug), md)
    if (oldSlug && oldSlug !== meta.slug)
      this.snapshots.set(postPath(oldSlug), null)
    this.posts.set(index)
  }

  async deletePost(slug: string) {
    const { file: indexFile, items } = await this.readIndex()
    const post = await this.git.getFile(postPath(slug))
    if (!post) throw new Error('文章已被删除，请刷新后重试')
    const index = items.filter((p) => p.slug !== slug)
    await this.git.commit(
      [
        {
          path: postPath(slug),
          content: null,
          expectedSha: post.sha,
          expectedLastCommit: post.lastCommit,
          expectedContent: post.content,
        },
        {
          path: PATH_INDEX,
          content: JSON.stringify(index, null, 2) + '\n',
          expectedSha: indexFile?.sha ?? null,
          expectedLastCommit: indexFile?.lastCommit,
          expectedContent: indexFile?.content ?? null,
        },
      ],
      `delete post: ${slug}`,
    )
    this.snapshots.set(postPath(slug), null)
    this.posts.set(index)
  }

  async loadSettings(): Promise<BlogSettings> {
    const f = await this.loadFile(PATH_SETTINGS)
    const current = this.blog.settings()
    if (!f) return structuredClone(current)
    return mergeThemeSettings(structuredClone(current), JSON.parse(f.content))
  }

  async saveSettings(s: BlogSettings) {
    const content = JSON.stringify(s, null, 2) + '\n'
    await this.git.commit(
      [await this.change(PATH_SETTINGS, content, this.expected(PATH_SETTINGS))],
      'update settings',
    )
    this.snapshots.set(PATH_SETTINGS, content)
    this.blog.settings.set(s)
  }

  async loadAbout(): Promise<string> {
    const f = await this.loadFile(PATH_ABOUT)
    return f?.content ?? ''
  }

  async saveAbout(md: string) {
    await this.git.commit(
      [await this.change(PATH_ABOUT, md, this.expected(PATH_ABOUT))],
      'update about',
    )
    this.snapshots.set(PATH_ABOUT, md)
  }
}
