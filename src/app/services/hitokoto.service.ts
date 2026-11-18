import { Injectable } from '@angular/core'
import type { BlogSettings } from '../../shared/types'
import {
  extractDailyQuote, normalizeHitokotoApi, localDate, parseDailySources,
  sourceText, renderDailyTemplate, limitDailyText, dailyTextLimit,
  type DailyQuote, type DailySource,
} from '../../shared/daily-text'

export { normalizeHitokotoApi } from '../../shared/daily-text'
export const DEFAULT_HITOKOTO_API = 'https://v1.hitokoto.cn'
export type Hitokoto = DailyQuote
export interface DailyPart extends DailyQuote { label: string; attribution: boolean; template?: string }
export interface DailyContent { parts: DailyPart[]; failures: string[] }
interface DailyCache { date: string; quote: DailyQuote }

function validQuote(value: unknown): value is DailyQuote {
  if (!value || typeof value !== 'object') return false
  const quote = value as DailyQuote
  return typeof quote.text === 'string' && !!quote.text.trim() && typeof quote.from === 'string' && typeof quote.author === 'string'
}

/** 每个文字来源独立按天缓存，某个接口失败不影响其他内容。 */
@Injectable({ providedIn: 'root' })
export class HitokotoService {
  private memory = new Map<string, DailyCache>()
  private pending = new Map<string, Promise<DailyQuote>>()

  async getQuote(value?: string): Promise<DailyQuote> {
    const source = { url: normalizeHitokotoApi(value), label: '一言', kind: 'custom', path: '' }
    return this.getSource(source)
  }

  async getDaily(settings: BlogSettings): Promise<DailyContent> {
    if (settings.hitokotoEnable === false) return { parts: [], failures: [] }
    const sources = parseDailySources(sourceText(settings))
    const results = await Promise.all(sources.map(async (source) => {
      try {
        const quote = await this.getSource(source)
        return { part: { ...quote, label: source.label, attribution: source.attribution ?? settings.hitokotoShowFrom !== false } }
      } catch (error) {
        return { failure: `${source.label}：${error instanceof Error ? error.message : '获取失败'}` }
      }
    }))
    const parts: DailyPart[] = []
    const failures: string[] = []
    for (const result of results) {
      if (result.part) parts.push(result.part)
      if (result.failure) failures.push(result.failure)
    }
    const template = settings.hitokotoCustomText?.trim()
    if (template) {
      parts.push({ text: renderDailyTemplate(template), from: '', author: '', label: '自定义文字', attribution: false, template })
    }
    const limit = dailyTextLimit(settings.hitokotoMaxLength)
    return { parts: parts.map((part) => ({ ...part, text: limitDailyText(part.text, limit) })), failures }
  }

  private getSource(source: DailySource): Promise<DailyQuote> {
    return this.cached(JSON.stringify([source.url, source.kind, source.path]), () => this.fetchQuote(source))
  }

  private async cached(identity: string, load: () => Promise<DailyQuote>): Promise<DailyQuote> {
    const date = localDate()
    const key = `navblog:hitokoto:v2:${identity}`
    const memory = this.memory.get(key)
    if (memory?.date === date) return memory.quote
    try {
      const cached: unknown = JSON.parse(localStorage.getItem(key) || 'null')
      if (cached && typeof cached === 'object') {
        const entry = cached as DailyCache
        if (entry.date === date && validQuote(entry.quote)) {
          this.memory.set(key, entry)
          return entry.quote
        }
      }
    } catch {}
    const requestKey = `${key}:${date}`
    const pending = this.pending.get(requestKey)
    if (pending) return pending
    const request = load().then((quote) => {
      const entry = { date, quote }
      this.memory.set(key, entry)
      try { localStorage.setItem(key, JSON.stringify(entry)) } catch {}
      return quote
    })
    this.pending.set(requestKey, request)
    try { return await request } finally { this.pending.delete(requestKey) }
  }

  private async fetchQuote(source: DailySource): Promise<DailyQuote> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    try {
      const response = await fetch(source.url, {
        signal: controller.signal, cache: 'no-store', credentials: 'omit',
        headers: { Accept: 'application/json,text/plain' },
      })
      if (!response.ok) throw new Error(`接口返回 ${response.status}`)
      const raw = await response.text()
      if (/^\s*</.test(raw) || /text\/html/i.test(response.headers.get('Content-Type') || '')) throw new Error('接口返回了 HTML 页面')
      let data: unknown
      try { data = JSON.parse(raw) } catch {
        if (/^\s*[\[{]/.test(raw) || /json/i.test(response.headers.get('Content-Type') || '')) throw new Error('接口返回了无效 JSON')
        data = raw
      }
      return extractDailyQuote(data, source)
    } finally { clearTimeout(timeout) }
  }
}
