import type {
  BlogSettings,
  MenuItem,
  MenuLink,
  SidebarModule,
  SidebarSide,
} from './types'
import { normalizeResourceUrl } from './custom-resources'

export const SIDEBAR_MODULES = [
  { key: 'profile', label: '个人资料' },
  { key: 'announcement', label: '公告' },
  { key: 'stats', label: '站点统计' },
  { key: 'latestPosts', label: '最新文章' },
  { key: 'moments', label: '碎碎念' },
  { key: 'contact', label: '联系卡片' },
  { key: 'categories', label: '分类' },
  { key: 'tags', label: '标签' },
  { key: 'toc', label: '文章目录' },
] as const

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
  sidebarMoments: true,
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
  menuMoments: true,
  menuAbout: true,
  menuSearch: true,
}

export function sidebarModuleSide(
  settings: Partial<BlogSettings>,
  key: SidebarModule,
): SidebarSide {
  return (
    settings.sidebarPositions?.[key] ||
    (settings.sidebarReverse ? 'right' : 'left')
  )
}

export function mergeThemeSettings(
  base: BlogSettings,
  incoming: Partial<BlogSettings> | null,
): BlogSettings {
  if (!incoming) return { ...base }
  // 已部署的默认位置不能盖过旧文件中的整体侧栏方向。
  return { ...base, ...incoming, sidebarPositions: incoming.sidebarPositions }
}

export function availableSidebarModules(
  settings: Partial<BlogSettings>,
  content: {
    announcement: boolean
    categories: boolean
    tags: boolean
    toc: boolean
  },
): SidebarModule[] {
  const visible: Record<SidebarModule, boolean> = {
    profile: true,
    announcement: content.announcement,
    stats: settings.sidebarStats !== false,
    latestPosts: settings.latestPosts !== false,
    moments: settings.sidebarMoments !== false,
    contact: !!settings.contactEnable,
    categories: settings.sidebarCategories !== false && content.categories,
    tags: settings.sidebarTags !== false && content.tags,
    toc: settings.articleToc !== false && content.toc,
  }
  return SIDEBAR_MODULES.filter(({ key }) => visible[key]).map(({ key }) => key)
}

function normalizeMenuItem(value: unknown, label: string): MenuItem {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`${label}必须是菜单对象`)
  const item = value as Record<string, unknown>
  const name = item['name'] ?? '',
    url = item['url'] ?? ''
  if (typeof name !== 'string' || typeof url !== 'string')
    throw new Error(`${label}名称和链接必须是文本`)
  const result: MenuItem = { ...item, name: name.trim(), url: url.trim() }
  for (const key of ['visible', 'blank'] as const) {
    const flag = item[key] ?? key === 'visible'
    if (flag === 'true' || flag === true) result[key] = true
    else if (flag === 'false' || flag === false) result[key] = false
    else throw new Error(`${label}显示与新窗口设置必须是布尔值`)
  }
  if (result.url) {
    if (/[\u0000-\u001f\u007f\\]/.test(result.url))
      throw new Error(`${label}链接不能包含控制字符或反斜线`)
    let parsed: URL
    try {
      parsed = new URL(result.url, 'https://navblog.invalid/')
    } catch {
      throw new Error(`${label}链接格式不正确`)
    }
    if (
      !['http:', 'https:', 'mailto:', 'tel:'].includes(parsed.protocol) ||
      parsed.username ||
      parsed.password
    )
      throw new Error(`${label}链接协议不受支持或包含登录凭据`)
  }
  return result
}

export function normalizeMenus(value: unknown): MenuLink[] {
  if (value === undefined) return []
  if (!Array.isArray(value)) throw new Error('顶部菜单必须是数组')
  return value.flatMap((raw, index) => {
    const label = `顶部菜单 ${index + 1}`
    const item = normalizeMenuItem(raw, label)
    const source = (raw as Record<string, unknown>)['children'] ?? []
    if (!Array.isArray(source)) throw new Error(`${label}的二级菜单必须是数组`)
    const children = source.flatMap((child, childIndex) => {
      const childLabel = `${label}的子菜单 ${childIndex + 1}`
      const leaf = normalizeMenuItem(child, childLabel)
      const nested = (child as Record<string, unknown>)['children']
      if (nested !== undefined && (!Array.isArray(nested) || nested.length))
        throw new Error('顶部菜单只支持两级，请把子项放在二级菜单内')
      if (!leaf.name && !leaf.url) return []
      if (!leaf.name || !leaf.url)
        throw new Error(`${childLabel}请填写名称和链接`)
      return [leaf]
    })
    if (!item.name && !item.url && !children.length) return []
    if (!item.name || (!item.url && !children.length))
      throw new Error(`${label}请填写名称，并提供链接或二级菜单`)
    return [{ ...item, children }]
  })
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
    'sidebarMoments',
    'rssEnable',
    'rssFullContent',
    'pwaEnable',
    'mobileMenu',
    'menuHome',
    'menuArchive',
    'menuCategories',
    'menuTags',
    'menuMoments',
    'menuAbout',
    'menuSearch',
  ] as const) {
    const value = s[key] as unknown
    if (value === 'false') s[key] = false
    else if (value === 'true') s[key] = true
    else if (typeof value !== 'boolean') throw new Error(`${key} 必须是布尔值`)
  }
  if (
    s.sidebarPositions !== undefined &&
    (!s.sidebarPositions ||
      typeof s.sidebarPositions !== 'object' ||
      Array.isArray(s.sidebarPositions))
  )
    throw new Error('侧栏位置必须是对象')
  const positions = { ...s.sidebarPositions }
  for (const { key, label } of SIDEBAR_MODULES) {
    const side = positions[key] ?? (s.sidebarReverse ? 'right' : 'left')
    if (!['left', 'right', 'hidden'].includes(side))
      throw new Error(`${label}位置只能选择左侧、右侧或隐藏`)
    positions[key] = side
  }
  s.sidebarPositions = positions
  s.menus = normalizeMenus(s.menus)
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
