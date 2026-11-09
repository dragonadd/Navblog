// 博客数据类型（浏览器端与构建脚本共用）
// Based on https://github.com/xjh22222228/nav (GPL-3.0)

export interface PostMeta {
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

export interface SocialLink {
  /** Font Awesome class，例如 fab fa-github */
  icon: string
  label: string
  url: string
}

export interface MenuLink {
  name: string
  url: string
  /** 新窗口打开 */
  blank?: boolean
}

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
