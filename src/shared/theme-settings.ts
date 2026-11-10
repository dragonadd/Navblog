import type { BlogSettings } from './types'
import { normalizeResourceUrl } from './custom-resources'

export const THEME_DEFAULTS: Partial<BlogSettings> = {
  appearance: 'system',
  darkStart: 22,
  darkEnd: 7,
  sidebarReverse: false,
  beiAn: '',
  beiAnLink: 'https://beian.miit.gov.cn/',
  beiAnGongan: '',
  rssEnable: true,
  rssFullContent: true,
  pwaEnable: true,
  pwaName: '',
  pwaShortName: '',
  pwaIcon: '',
  pwaIcon192: 'icons/icon-192x192.png',
  pwaIcon512: 'icons/icon-512x512.png',
  pwaIcon192Maskable: '',
  pwaIcon512Maskable: '',
  pwaThemeColor: '#b8a320',
  pwaBackgroundColor: '#ffffff',
  coverWidth: 280,
  coverDefault: false,
  coverHover: true,
  showSummary: true,
  showListTags: true,
  listMode: 'page',
  latestPosts: true,
  contactEnable: false,
  contactFlip: true,
  contactTitle: '联系卡片',
  contactDescription: '欢迎交流与反馈',
  contactBadge: 'Message',
  contactUrl: '',
  contactText: '联系我',
  contactBackTitle: '欢迎交流',
  contactBackDescription: '可提交问题、建议与合作意向',
  contactBackText: '开始交流',
  profilePath: '/about',
  sidebarCategories: true,
  sidebarTags: true,
  sidebarStats: true,
  articleToc: true,
  floatComment: true,
  floatDark: true,
  articleCover: true,
  articleCoverTop: false,
  articleMeta: true,
  articleShare: true,
  articleCopyright: true,
  articleAdjacent: true,
  articleComment: true,
  mobileMenu: true,
  menuHome: true,
  menuArchive: true,
  menuCategories: true,
  menuTags: true,
  menuSearch: true,
}

export function normalizeThemeSettings<T extends Partial<BlogSettings>>(
  settings: T,
) {
  const s = { ...THEME_DEFAULTS, ...settings }
  if (!['system', 'light', 'dark', 'auto'].includes(s.appearance!))
    throw new Error('默认外观必须是 system、light、dark 或 auto')
  for (const key of ['darkStart', 'darkEnd'] as const) {
    const hour = Number(s[key])
    if (
      s[key] === null ||
      String(s[key]).trim() === '' ||
      !Number.isInteger(hour) ||
      hour < 0 ||
      hour > 23
    )
      throw new Error('深色时段必须是 0–23 的整数小时')
    s[key] = hour
  }
  for (const key of [
    'sidebarReverse',
    'rssEnable',
    'rssFullContent',
    'pwaEnable',
  ] as const) {
    const value = s[key] as unknown
    if (value === 'false') s[key] = false
    else if (value === 'true') s[key] = true
    else if (typeof value !== 'boolean') throw new Error(`${key} 必须是布尔值`)
  }
  for (const key of [
    'beiAn',
    'beiAnLink',
    'beiAnGongan',
    'pwaName',
    'pwaShortName',
    'pwaIcon',
    'pwaIcon192',
    'pwaIcon512',
    'pwaIcon192Maskable',
    'pwaIcon512Maskable',
    'pwaThemeColor',
    'pwaBackgroundColor',
  ] as const) {
    if (typeof s[key] !== 'string') throw new Error(`${key} 必须是文本`)
    s[key] = s[key]!.trim()
  }
  if (s.beiAnLink) {
    const url = new URL(s.beiAnLink)
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password
    )
      throw new Error('备案链接必须使用 HTTP(S) 且不能含登录凭据')
  }
  for (const key of ['pwaThemeColor', 'pwaBackgroundColor'] as const) {
    s[key] ||= THEME_DEFAULTS[key]
    if (!/^#[\da-f]{6}$/i.test(s[key]!))
      throw new Error('PWA 颜色请填写六位 HEX，例如 #ffffff')
  }
  if (s.pwaIcon) s.pwaIcon = normalizeResourceUrl(s.pwaIcon)
  s.pwaIcon192 ||= THEME_DEFAULTS.pwaIcon192
  s.pwaIcon512 ||= THEME_DEFAULTS.pwaIcon512
  for (const key of [
    'pwaIcon192',
    'pwaIcon512',
    'pwaIcon192Maskable',
    'pwaIcon512Maskable',
  ] as const) {
    if (
      s[key] &&
      (!/^[\w\-/]+\.png$/i.test(s[key]!) ||
        s[key]!.startsWith('/') ||
        s[key]!.split('/').includes('..'))
    )
      throw new Error('安装图标请填写 public/ 内的相对 PNG 路径')
  }
  return {
    ...s,
    coverWidth: Math.min(
      360,
      Math.max(200, Number(settings.coverWidth) || 280),
    ),
    listMode: (settings.listMode === 'scroll' ? 'scroll' : 'page') as
      'page' | 'scroll',
  }
}

/** 与 HTML 初始脚本共用；本函数不能依赖外部变量。 */
export function resolveDark(
  settings: Partial<BlogSettings>,
  stored: string | null,
  systemDark: boolean,
  now = new Date(),
): boolean {
  if (stored === '1' || stored === '0') return stored === '1'
  if (settings.appearance === 'light') return false
  if (settings.appearance === 'dark') return true
  if (settings.appearance !== 'auto') return systemDark
  const start = Number(settings.darkStart ?? 22),
    end = Number(settings.darkEnd ?? 7),
    hour = now.getHours()
  return start < end
    ? hour >= start && hour < end
    : start > end && (hour >= start || hour < end)
}
