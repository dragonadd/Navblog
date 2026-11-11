// 博客数据类型（浏览器端与构建脚本共用）
// Based on https://github.com/xjh22222228/nav (GPL-3.0)

export interface PostMeta {
  /** 正文为 Web Crypto 密文；标题、摘要、分类和封面仍公开。 */
  encrypted?: boolean
  hideSidebar?: boolean
  slug: string
  title: string
  /** 发布时间 YYYY-MM-DD 或 YYYY-MM-DD HH:mm */
  date: string
  /** 更新时间 */
  updated?: string
  category?: string
  tags: string[]
  summary?: string
  cover?: string
  draft?: boolean
  /** 置顶 */
  pinned?: boolean
  /** 关闭评论 */
  comments?: boolean
  /** 字数（构建/保存时统计） */
  words?: number
}

export interface Moment {
  id: string
  date: string
  text: string
  updated?: string
}

export interface SocialLink {
  /** Font Awesome class，例如 fab fa-github */
  icon: string
  label: string
  url: string
}

export interface MenuItem {
  name: string
  url: string
  /** 新窗口打开 */
  blank?: boolean
  visible?: boolean
}

export interface MenuLink extends MenuItem {
  children?: MenuItem[]
}

export type SidebarModule =
  | 'profile'
  | 'announcement'
  | 'stats'
  | 'latestPosts'
  | 'contact'
  | 'categories'
  | 'tags'
  | 'toc'
export type SidebarSide = 'left' | 'right'

export interface GiscusConfig {
  enable: boolean
  repo: string
  repoId: string
  category: string
  categoryId: string
  mapping: string
  strict: string
  reactionsEnabled: string
  inputPosition: string
  lang: string
}

export interface BlogSettings {
  appearance?: 'system' | 'light' | 'dark' | 'auto'
  darkStart?: number
  darkEnd?: number
  sidebarReverse?: boolean
  sidebarPositions?: Partial<Record<SidebarModule, SidebarSide>>
  beiAn?: string
  beiAnLink?: string
  beiAnGongan?: string
  rssEnable?: boolean
  rssFullContent?: boolean
  pwaEnable?: boolean
  pwaName?: string
  pwaShortName?: string
  pwaIcon?: string
  pwaIcon192?: string
  pwaIcon512?: string
  pwaIcon192Maskable?: string
  pwaIcon512Maskable?: string
  pwaThemeColor?: string
  pwaBackgroundColor?: string
  coverWidth?: number
  coverDefault?: boolean
  coverHover?: boolean
  showSummary?: boolean
  showListTags?: boolean
  listMode?: 'page' | 'scroll'
  latestPosts?: boolean
  contactEnable?: boolean
  contactFlip?: boolean
  contactTitle?: string
  contactDescription?: string
  contactBadge?: string
  contactUrl?: string
  contactText?: string
  contactBackTitle?: string
  contactBackDescription?: string
  contactBackText?: string
  profilePath?: string
  sidebarCategories?: boolean
  sidebarTags?: boolean
  sidebarStats?: boolean
  articleToc?: boolean
  floatComment?: boolean
  floatDark?: boolean
  articleCover?: boolean
  articleCoverTop?: boolean
  articleMeta?: boolean
  articleShare?: boolean
  articleCopyright?: boolean
  articleAdjacent?: boolean
  articleComment?: boolean
  mobileMenu?: boolean
  menuHome?: boolean
  menuArchive?: boolean
  menuCategories?: boolean
  menuTags?: boolean
  menuMoments?: boolean
  menuAbout?: boolean
  menuSearch?: boolean
  title: string
  subtitle: string
  description: string
  keywords: string
  author: string
  avatar: string
  favicon: string
  /** 网站起始年份 */
  since: number
  heroEnable: boolean
  heroImage: string
  heroCreditText: string
  heroCreditLink: string
  /** 主题色相 0-360 */
  themeHue: number
  /** 固定色相，隐藏调色盘 */
  themeFixed: boolean
  postsPerPage: number
  /** 列表卡片显示封面 */
  showCover: boolean
  /** 一言 API 地址；留空使用 https://v1.hitokoto.cn，兼容旧版设置。 */
  hitokotoApi?: string
  /** 每日文字设置，兼容仅有 hitokotoApi 的旧配置。 */
  hitokotoEnable?: boolean
  hitokotoShowTitle?: boolean
  hitokotoTitle?: string
  hitokotoSources?: string
  hitokotoCustomText?: string
  hitokotoShowFrom?: boolean
  hitokotoMaxLength?: number
  /** 主页公告；缺省不启用。正文支持 Markdown，保留换行。 */
  announcementEnable?: boolean
  announcementTitle?: string
  announcementText?: string
  announcementLink?: string
  announcementClosable?: boolean
  social: SocialLink[]
  /** 额外顶部菜单 */
  menus: MenuLink[]
  license: string
  licenseUrl: string
  giscus: GiscusConfig
  /** 底部自定义 HTML */
  footerHtml: string
  /** 注入到 <head> 的自定义 HTML（统计脚本等） */
  headHtml: string
  /** 专用样式和脚本设置，正式站点重新构建后生效。 */
  customCssEnable?: boolean
  customCss?: string
  customExternalCss?: string[]
  customJsEnable?: boolean
  customExternalJs?: string[]
  /** 不蒜子访问统计 */
  busuanzi: boolean
  /** jsDelivr 等 GitHub CDN 域名 */
  gitHubCDN: string
  /** 保存后请求的部署钩子 URL（如 Vercel/Netlify/Cloudflare Deploy Hook） */
  actionUrl: string
}

export interface BlogConfig {
  gitRepoUrl: string
  branch: string
  imageRepoUrl: string
  siteUrl: string
  baseHref: string
}

export interface TocItem {
  id: string
  text: string
  level: number
}

export interface TaxonomyItem {
  name: string
  count: number
}
