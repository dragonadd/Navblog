/** 参考 daily-push 的文字来源思路，供浏览器和后台共用。 */
export interface DailySource {
  label: string
  url: string
  kind: string
  path: string
  attribution?: boolean
}

export interface DailyQuote { text: string; from: string; author: string }
export const DAILY_TEXT_SOURCES = [
  { name: 'hitokoto', label: '一言', url: 'https://v1.hitokoto.cn/' },
  { name: 'jinrishici', label: '今日诗词', url: 'https://v2.jinrishici.com/one.json' },
  { name: 'xygeng', label: '随机句子', url: 'https://api.xygeng.cn/one' },
  { name: '60s', label: '每天 60 秒读懂世界', url: 'https://60s.viki.moe/v2/60s' },
  { name: 'history', label: '历史上的今天', url: 'https://60s.viki.moe/v2/today_in_history' },
] as const

export function normalizeHitokotoApi(value?: string): string {
  let url: URL
  try { url = new URL(value?.trim() || DAILY_TEXT_SOURCES[0].url) } catch {
    throw new Error('请输入完整的 HTTP 或 HTTPS 接口地址')
  }
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('接口必须使用 HTTP 或 HTTPS')
  if (url.username || url.password) throw new Error('接口地址不能包含登录凭证')
  url.hash = ''
  return url.href
}

export function localDate(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export function sourceText(settings: { hitokotoSources?: string; hitokotoApi?: string }): string {
  return settings.hitokotoSources ?? (settings.hitokotoApi?.trim() || 'hitokoto')
}

/** 支持 名称 | 地址或内置名 | data.content | 正文/出处；每行一个来源。 */
export function parseDailySources(raw: string): DailySource[] {
  const lines = raw.split(/[\n;；]+/).map((line) => line.trim()).filter(Boolean)
  if (lines.length > 5) throw new Error('每日文字最多配置 5 个接口来源')
  return lines.map((line) => {
    let attribution: boolean | undefined
    const parts = line.split(/[|｜]/).map((part) => part.trim()).filter((part) => {
      if (['正文', '只发正文', '无出处', 'nofrom'].includes(part.toLowerCase())) { attribution = false; return false }
      if (['出处', '保留出处', 'withfrom'].includes(part.toLowerCase())) { attribution = true; return false }
      return !!part
    })
    let index = parts.findIndex((part) => /^https?:\/\//i.test(part))
    if (index < 0) index = parts.findIndex((part) => DAILY_TEXT_SOURCES.some((source) => source.name === part.toLowerCase()))
    if (index < 0) throw new Error(`无法识别文字来源：${line}`)
    const address = parts[index]
    const builtin = DAILY_TEXT_SOURCES.find((source) => source.name === address.toLowerCase())
    const url = normalizeHitokotoApi(builtin?.url || address)
    const path = parts[index + 1] || ''
    if (index > 1 || parts.length > index + 2) throw new Error('来源格式应为：名称 | 接口 | 字段路径 | 正文或出处')
    if (path && !/^[\w-]+(?:\.[\w-]+)*$/.test(path)) throw new Error(`取值路径格式无效：${path}`)
    return { label: index > 0 ? parts[0] : builtin?.label || new URL(url).hostname, url, kind: builtin?.name || 'custom', path, attribution }
  })
}

export function pickByPath(value: unknown, path: string): unknown {
  for (const key of path.split('.')) {
    if (!value || typeof value !== 'object' || !Object.hasOwn(value, key)) return undefined
    value = (value as Record<string, unknown>)[key]
  }
  return value
}

const TEXT_KEYS = ['hitokoto', 'content', 'text', 'news', 'sentence', 'title', 'description', 'headline', 'summary', 'tip']
const OMIT_KEYS = /^(image|images|cover|cover_4k|img|picture|photo|thumbnail|url|link|href|src|icon|avatar|code|status|message|error|token|key|from|from_who|author|name|origin)$/i
const clean = (value: unknown): string => typeof value === 'string' ? value.trim() : ''
const readable = (value: unknown): string => {
  const text = clean(value)
  return /^(?:https?:\/\/|data:image\/|<\s*[!a-z])/i.test(text) ? '' : text
}

export function toDailyText(value: unknown, depth = 0): string {
  if (depth > 5) return ''
  if (typeof value === 'string') return readable(value)
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((entry) => toDailyText(entry, depth + 1)).filter(Boolean).map((text, index) => `${index + 1}. ${text}`).join('\n')
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    for (const key of TEXT_KEYS) {
      const text = toDailyText(record[key], depth + 1)
      if (text) return text
    }
  }
  return ''
}

/** 优先正文类字段，再递归匹配；不把图片地址和错误信息当作正文。 */
function autoText(value: unknown, depth = 0): string {
  const direct = toDailyText(value, depth)
  if (direct || depth >= 5 || !value || typeof value !== 'object') return direct
  const entries = Object.entries(value).filter(([key]) => !OMIT_KEYS.test(key)).slice(0, 100)
  for (const [, child] of entries) {
    if (child && typeof child === 'object') {
      const text = autoText(child, depth + 1)
      if (text) return text
    }
  }
  return entries.map(([, child]) => readable(child)).sort((a, b) => b.length - a.length)[0] || ''
}

export function extractDailyQuote(data: unknown, source: DailySource): DailyQuote {
  const at = (path: string) => pickByPath(data, path)
  let text = ''
  let from = ''
  let author = ''
  if (source.path) {
    text = toDailyText(at(source.path))
    if (!text) throw new Error(`没有取到文字，请检查字段路径 ${source.path}`)
  } else if (source.kind === '60s') {
    text = toDailyText(at('data.news'))
    const tip = readable(at('data.tip'))
    if (text && tip) text += `\n\n💡 ${tip}`
  } else if (source.kind === 'history') {
    const items = at('data.items')
    if (Array.isArray(items)) {
      text = items.slice(0, 8).map((item: unknown) => {
        const title = readable(pickByPath(item, 'title'))
        const year = pickByPath(item, 'year')
        return title ? `· ${typeof year === 'number' || typeof year === 'string' ? year + '年 · ' : ''}${title}` : ''
      }).filter(Boolean).join('\n')
    }
  }
  if (!text) text = autoText(data)
  if (!text) throw new Error('接口未返回可用文字，请指定正确的字段路径')
  if (source.kind === 'jinrishici') {
    from = clean(at('data.origin.title'))
    author = clean(at('data.origin.author'))
  } else if (source.kind === 'xygeng') {
    from = clean(at('data.origin'))
    author = clean(at('data.name'))
  } else {
    from = clean(at('from')) || clean(at('data.from'))
    author = clean(at('from_who')) || clean(at('author')) || clean(at('data.author'))
  }
  return { text, from, author }
}

export function renderDailyTemplate(template: string, now = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  const variables: Record<string, string> = {
    date: localDate(now), time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
    weekday: `星期${'日一二三四五六'[now.getDay()]}`, month: `${now.getMonth() + 1} 月`, day: `${now.getDate()} 日`,
  }
  return template.replace(/\\n/g, '\n').replace(/\{(date|time|weekday|month|day)\}/g, (_, name: string) => variables[name]).trim()
}

export function dailyTextLimit(value?: number): number {
  return Math.min(4000, Math.max(100, Math.round(Number(value) || 1200)))
}

export function limitDailyText(text: string, limit: number): string {
  const characters = Array.from(text)
  return characters.length > limit ? characters.slice(0, limit).join('') + '…' : text
}
