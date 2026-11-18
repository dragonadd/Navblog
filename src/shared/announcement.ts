import { Marked } from 'marked'
import type { BlogSettings } from './types'

export interface Announcement {
  enabled: boolean
  title: string
  text: string
  link: string
  closable: boolean
}

/** 允许 HTTP(S) 链接及站内路径，拒绝执行协议、凭据和模糊的反斜线地址。 */
export function normalizeAnnouncementLink(value = ''): string {
  const link = value.trim()
  if (!link) return ''
  if (/[\u0000-\u0020\u007f\\]/.test(link) || link.startsWith('//')) {
    throw new Error('公告链接请使用完整 HTTP(S) 地址或站内路径，不能包含空白或反斜线')
  }
  let url: URL
  try { url = new URL(link, 'https://navblog.invalid/') } catch {
    throw new Error('公告链接格式无效')
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('公告链接只允许 HTTP(S) 或站内路径，且不能包含登录凭据')
  }
  return /^[a-z][a-z\d+.-]*:/i.test(link) ? url.href : link
}

/** 公告使用独立的轻量解析器，保留换行，不生成文章目录或代码操作按钮。 */
export function renderAnnouncementMarkdown(text: string, baseUrl: string): string {
  const base = new URL(baseUrl)
  const escape = (value: string) => value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
  const resolve = (href: string) => {
    try {
      const link = normalizeAnnouncementLink(href)
      return link ? new URL(link.replace(/^\//, ''), base) : null
    } catch { return null }
  }
  const marked = new Marked({
    gfm: true,
    breaks: true,
    renderer: {
      html({ text }) { return escape(text) },
      link({ href, title, tokens }) {
        const text = this.parser.parseInline(tokens)
        const url = resolve(href)
        if (!url) return text
        const titleAttr = title ? ` title="${escape(title)}"` : ''
        const external = url.origin !== base.origin
        return `<a href="${escape(url.href)}"${titleAttr}${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${text}</a>`
      },
      image({ href, title, text }) {
        const url = resolve(href)
        if (!url) return escape(text)
        const titleAttr = title ? ` title="${escape(title)}"` : ''
        return `<img src="${escape(url.href)}" alt="${escape(text)}"${titleAttr} loading="lazy" />`
      },
    },
  })
  return marked.parse(text, { async: false }) as string
}

export function readAnnouncement(settings: BlogSettings): Announcement {
  let link = ''
  // 手工编辑配置中的无效链接不应让整个主页加载失败。
  try { link = normalizeAnnouncementLink(settings.announcementLink) } catch {}
  return {
    enabled: settings.announcementEnable === true,
    title: settings.announcementTitle?.trim() || '',
    text: settings.announcementText?.trim() || '',
    link,
    closable: settings.announcementClosable !== false,
  }
}

/** 显示内容改变才算新公告；启用/关闭按钮开关不影响版本。 */
export function announcementVersion(announcement: Announcement): string {
  return JSON.stringify([announcement.title, announcement.text, announcement.link])
}
