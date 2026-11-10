// Markdown front matter 解析 / 生成（浏览器端与构建脚本共用）
import yaml from 'js-yaml'
import type { PostMeta } from './types'
import {
  ENCRYPTED_SUMMARY,
  isEncryptedBody,
  parseEncryptedPayload,
} from './post-crypto'

const FM_RE = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---\r?\n?/

export interface ParsedMarkdown {
  data: Record<string, unknown>
  body: string
}

export function parseFrontMatter(source: string): ParsedMarkdown {
  const match = FM_RE.exec(source)
  if (!match) {
    return { data: {}, body: source }
  }
  let data: Record<string, unknown> = {}
  try {
    // CORE_SCHEMA：不把日期解析为 Date 对象
    const loaded = yaml.load(match[1], { schema: yaml.CORE_SCHEMA })
    if (loaded && typeof loaded === 'object' && !Array.isArray(loaded)) {
      data = loaded as Record<string, unknown>
    } else if (loaded != null) throw new Error()
  } catch {
    throw new Error('文章元数据格式错误，已停止读取以避免发布未验证内容')
  }
  return { data, body: source.slice(match[0].length) }
}

function toStr(v: unknown): string {
  if (v == null) return ''
  return String(v).trim()
}

function toTags(v: unknown): string[] {
  if (Array.isArray(v)) {
    return v.map((t) => toStr(t)).filter(Boolean)
  }
  const s = toStr(v)
  if (!s) return []
  return s
    .split(/[,，]/)
    .map((t) => t.trim())
    .filter(Boolean)
}

/** 统计字数：中日韩字符按字计，其它按单词计 */
export function countWords(md: string): number {
  const text = md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~\-|]/g, ' ')
  const cjk =
    text.match(/[\u3400-\u9fff\uf900-\ufaff\u3040-\u30ff\uac00-\ud7af]/g)
      ?.length || 0
  const words = text
    .replace(/[\u3400-\u9fff\uf900-\ufaff\u3040-\u30ff\uac00-\ud7af]/g, ' ')
    .split(/\s+/)
    .filter((w) => /\w/.test(w)).length
  return cjk + words
}

/** 从正文自动生成摘要 */
export function autoSummary(md: string, max = 120): string {
  const text = md
    .replace(/```[\s\S]*?```/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^#+\s.*$/gm, '')
    .replace(/[*_`>~|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > max ? text.slice(0, max) + '…' : text
}

export function normalizeMeta(
  data: Record<string, unknown>,
  slug: string,
  body = '',
): PostMeta {
  if (
    Object.keys(data).some((key) =>
      /^(password|passphrase|encryptionpassword)$/i.test(key),
    )
  )
    throw new Error('禁止在文章元数据中保存密码，请通过后台加密后发布')
  if (
    data['encrypted'] !== undefined &&
    ![true, false, 'true', 'false'].includes(data['encrypted'] as any)
  )
    throw new Error('文章 encrypted 标记无效')
  const encrypted = data['encrypted'] === true || data['encrypted'] === 'true'
  if (encrypted) parseEncryptedPayload(body)
  else if (isEncryptedBody(body))
    throw new Error('密文正文缺少 encrypted: true 标记')
  const meta: PostMeta = {
    slug,
    title: toStr(data['title']) || slug,
    date: toStr(data['date']),
    tags: toTags(data['tags']),
  }
  const updated = toStr(data['updated'])
  if (updated) meta.updated = updated
  const category = toStr(data['category'] ?? data['categories'])
  if (category) meta.category = category
  const summary = toStr(data['summary'] ?? data['description'])
  if (encrypted) meta.encrypted = true
  meta.summary = summary || (encrypted ? ENCRYPTED_SUMMARY : autoSummary(body))
  const cover = toStr(data['cover'] ?? data['image'])
  if (cover) meta.cover = cover
  if (data['draft'] === true || data['draft'] === 'true') meta.draft = true
  if (data['pinned'] === true || data['pinned'] === 'true') meta.pinned = true
  if (data['comments'] === false || data['comments'] === 'false') {
    meta.comments = false
  }
  if (
    data['hideSidebar'] === true ||
    data['hideSidebar'] === 'true' ||
    data['HIDE_SIDEBAR'] === true ||
    data['fullWidth'] === true ||
    data['sidebar'] === false
  )
    meta.hideSidebar = true
  meta.words = encrypted ? 0 : countWords(body)
  return meta
}

/** 由元信息和正文生成完整的 Markdown 文件内容 */
export function stringifyPost(meta: PostMeta, body: string): string {
  if (meta.encrypted) parseEncryptedPayload(body)
  else if (isEncryptedBody(body)) throw new Error('不能将密文作为普通文章保存')
  const data: Record<string, unknown> = {
    title: meta.title,
    date: meta.date,
  }
  if (meta.updated) data['updated'] = meta.updated
  if (meta.category) data['category'] = meta.category
  data['tags'] = meta.tags || []
  if (meta.summary) data['summary'] = meta.summary
  if (meta.cover) data['cover'] = meta.cover
  if (meta.pinned) data['pinned'] = true
  if (meta.draft) data['draft'] = true
  if (meta.comments === false) data['comments'] = false
  if (meta.hideSidebar) data['hideSidebar'] = true
  if (meta.encrypted) data['encrypted'] = true
  const fm = yaml.dump(data, {
    schema: yaml.CORE_SCHEMA,
    lineWidth: -1,
    quotingType: '"',
  })
  return `---\n${fm}---\n\n${body.replace(/^\s+/, '')}`
}

/** 文章排序：置顶优先，然后按日期倒序 */
export function sortPosts<T extends PostMeta>(posts: T[]): T[] {
  return [...posts].sort((a, b) => {
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1
    return (b.date || '').localeCompare(a.date || '')
  })
}

/** 生成 URL 友好的 slug（保留中文） */
export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^\p{L}\p{N}-]+/gu, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}
