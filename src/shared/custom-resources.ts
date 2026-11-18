import type { BlogSettings } from './types'

const BASE_ORIGIN = 'https://navblog.invalid'

function baseUrl(baseHref: string): string {
  const path = baseHref.replace(/^\/+|\/+$/g, '')
  return `${BASE_ORIGIN}/${path}${path ? '/' : ''}`
}

/** 外部资源只接受 HTTPS；站内路径沿用 URL 相对 base href 的语义。 */
export function normalizeResourceUrl(value: string): string {
  const raw = value.trim()
  if (!raw || /[\u0000-\u0020\u007f\\]/.test(raw) || raw.startsWith('//') || raw.startsWith('#')) {
    throw new Error('资源地址请使用 HTTPS 地址或站内路径，不能包含空白、反斜线或仅有锚点')
  }
  if (/^[a-z][a-z\d+.-]*:/i.test(raw) && !/^https:\/\//i.test(raw)) {
    throw new Error('外部资源必须使用完整的 HTTPS 地址')
  }
  let url: URL
  try { url = new URL(raw, BASE_ORIGIN + '/') } catch { throw new Error('资源地址格式无效') }
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error('外部资源必须使用 HTTPS，且不能包含登录凭据')
  }
  url.hash = ''
  return /^[a-z][a-z\d+.-]*:/i.test(raw) ? url.href : raw.split('#')[0]
}

export function resourceIdentity(value: string, baseHref = '/'): string {
  const url = new URL(value, baseUrl(baseHref))
  url.hash = ''
  return url.href
}

function normalizeList(values: string[] | undefined, enabled: boolean, baseHref: string): string[] {
  if (values === undefined) return []
  if (!Array.isArray(values) || values.some((value) => typeof value !== 'string')) {
    throw new Error('外部资源配置必须是地址字符串数组')
  }
  const seen = new Set<string>()
  return values.map((value) => value.trim()).filter(Boolean).map((value) => enabled ? normalizeResourceUrl(value) : value).filter((value) => {
    if (!value) return false
    const identity = enabled ? resourceIdentity(value, baseHref) : value
    if (seen.has(identity)) return false
    seen.add(identity)
    return true
  })
}

const normalizeCss = (value: string) => value.replace(/\r\n?/g, '\n').trim()

export function normalizeCustomResources(settings: BlogSettings, baseHref = '/') {
  const cssEnabled = settings.customCssEnable !== false
  const jsEnabled = settings.customJsEnable !== false
  const css = normalizeCss(settings.customCss || '')
  if (cssEnabled && /<\s*\/?\s*(?:style|script)\b/i.test(css)) {
    throw new Error('自定义 CSS 请只填写样式规则，不要包含 style 或 script 标签')
  }
  return {
    customCssEnable: cssEnabled,
    customCss: css,
    customExternalCss: normalizeList(settings.customExternalCss, cssEnabled, baseHref),
    customJsEnable: jsEnabled,
    customExternalJs: normalizeList(settings.customExternalJs, jsEnabled, baseHref),
  }
}

// 只识别资源标签；完整跳过注释、脚本正文和 style 正文，避免把示例代码当资源。
const RESOURCE_TAGS = /<!--[\s\S]*?-->|<script\b(?:"[^"]*"|'[^']*'|[^'">])*?>[\s\S]*?<\/script\s*>|<style\b(?:"[^"]*"|'[^']*'|[^'">])*?>[\s\S]*?<\/style\s*>|<link\b(?:"[^"]*"|'[^']*'|[^'">])*?>/gi

function decodeAttribute(value: string): string {
  const named: Record<string, string> = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>' }
  return value.replace(/&(amp|quot|apos|lt|gt|#\d+|#x[\da-f]+);/gi, (entity, code: string) => {
    if (code[0] !== '#') return named[code.toLowerCase()]
    const number = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : Number(code.slice(1))
    return number > 0 && number <= 0x10ffff ? String.fromCodePoint(number) : entity
  })
}

function resourceTag(token: string) {
  const opening = /^<(script|style|link)\b((?:"[^"]*"|'[^']*'|[^'">])*?)>/i.exec(token)
  if (!opening) return undefined
  const attrs: Record<string, string> = {}
  for (const match of opening[2].matchAll(/([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) {
    const name = match[1].toLowerCase()
    if (!Object.hasOwn(attrs, name)) attrs[name] = decodeAttribute(match[2] ?? match[3] ?? match[4] ?? '')
  }
  return { name: opening[1].toLowerCase(), attrs, body: token.slice(opening[0].length).replace(/<\/(?:script|style)\s*>$/i, '') }
}

const escapeAttribute = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** 构建前/后均可调用：移除本模块旧输出，按最新设置生成一次，排在主题样式之后。 */
export function renderCustomResources(html: string, settings: BlogSettings, baseHref = '/'): string {
  const resources = normalizeCustomResources(settings, baseHref)
  html = html.replace(RESOURCE_TAGS, (token) => resourceTag(token)?.attrs['data-navblog-resource'] !== undefined ? '' : token)
  const cssUrls = new Set<string>()
  const jsUrls = new Set<string>()
  const inlineStyles = new Set<string>()
  for (const match of html.matchAll(RESOURCE_TAGS)) {
    const tag = resourceTag(match[0])
    if (!tag) continue
    if (tag.name === 'style' && !tag.attrs['media']) inlineStyles.add(normalizeCss(tag.body))
    let target: Set<string> | undefined
    let value = ''
    if (tag.name === 'script' && tag.attrs['src']) { target = jsUrls; value = tag.attrs['src'] }
    if (tag.name === 'link' && /\bstylesheet\b/i.test(tag.attrs['rel'] || '') && !tag.attrs['media']) {
      target = cssUrls; value = tag.attrs['href'] || ''
    }
    if (target && value) {
      try { target.add(resourceIdentity(value, baseHref)) } catch {}
    }
  }
  const added: string[] = []
  if (resources.customCssEnable) {
    for (const url of resources.customExternalCss) {
      const identity = resourceIdentity(url, baseHref)
      if (cssUrls.has(identity)) continue
      cssUrls.add(identity)
      added.push(`<link data-navblog-resource="css" rel="stylesheet" href="${escapeAttribute(url)}" crossorigin="anonymous" referrerpolicy="no-referrer" />`)
    }
    if (resources.customCss && !inlineStyles.has(resources.customCss)) {
      added.push(`<style data-navblog-resource="style">\n${resources.customCss}\n</style>`)
    }
  }
  if (resources.customJsEnable) {
    for (const url of resources.customExternalJs) {
      const identity = resourceIdentity(url, baseHref)
      if (jsUrls.has(identity)) continue
      jsUrls.add(identity)
      added.push(`<script data-navblog-resource="js" src="${escapeAttribute(url)}" defer crossorigin="anonymous" referrerpolicy="no-referrer"></script>`)
    }
  }
  // 不把脚本/CSS 字符串里的 </head> 当作真正的插入位置。
  const masked = html.replace(RESOURCE_TAGS, (token) => ' '.repeat(token.length))
  const closing = /<\/head\s*>/i.exec(masked)
  if (!closing) throw new Error('HTML 模板缺少 head 结束标签')
  return html.slice(0, closing.index).trimEnd()
    + (added.length ? '\n    ' + added.join('\n    ') : '')
    + '\n  </head>' + html.slice(closing.index + closing[0].length)
}
