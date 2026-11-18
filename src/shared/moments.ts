import type { Moment } from './types'

export const MOMENT_TEXT_LIMIT = 5000

function isoDate(value: unknown): string {
  if (typeof value !== 'string')
    throw new Error('动态时间必须是带时区的 ISO 日期')
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|([+-])(\d{2}):(\d{2}))$/.exec(
      value,
    )
  if (!match) throw new Error('动态时间必须是带时区的 ISO 日期')
  const [, y, m, d, h, min, sec, , offsetH, offsetM] = match
  if (
    +y < 1000 ||
    +m < 1 ||
    +m > 12 ||
    +d < 1 ||
    +d > new Date(Date.UTC(+y, +m, 0)).getUTCDate() ||
    +h > 23 ||
    +min > 59 ||
    +sec > 59 ||
    +(offsetH || 0) > 23 ||
    +(offsetM || 0) > 59
  )
    throw new Error('动态时间无效')
  const time = new Date(value)
  if (!Number.isFinite(time.getTime())) throw new Error('动态时间无效')
  return time.toISOString()
}

export function normalizeMoment(value: unknown): Moment {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('动态必须是对象')
  const item = value as Record<string, unknown>
  if (typeof item.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(item.id))
    throw new Error('动态 ID 无效')
  if (typeof item.text !== 'string') throw new Error('动态正文必须是文本')
  const text = item.text.replace(/\r\n?/g, '\n').trim()
  if (!text || Array.from(text).length > MOMENT_TEXT_LIMIT)
    throw new Error(`动态正文需要 1–${MOMENT_TEXT_LIMIT} 个字符`)
  return {
    id: item.id,
    date: isoDate(item.date),
    text,
    ...(item.updated === undefined ? {} : { updated: isoDate(item.updated) }),
  }
}

export function parseMoments(source: string): Moment[] {
  let data: unknown
  try {
    data = JSON.parse(source)
  } catch {
    throw new Error('动态 JSON 格式错误，已停止操作')
  }
  if (!Array.isArray(data) || data.length > 10000)
    throw new Error('动态数据必须是数组，最多 10000 条')
  const items = data.map(normalizeMoment)
  if (new Set(items.map((m) => m.id)).size !== items.length)
    throw new Error('动态 ID 重复，已停止操作')
  return items.sort(
    (a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id),
  )
}

export function formatMomentDate(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value))
}

export function momentDateInput(value: string): string {
  const d = new Date(value),
    pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
