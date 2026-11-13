import type { BlogSettings, Moment, PostMeta } from './types'

function calendarDay(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  const time = Date.UTC(year, month - 1, day)
  if (year < 1000 || new Date(time).toISOString().slice(0, 10) !== value)
    return null
  return time
}

export function normalizeBlogInfoSettings(settings: Partial<BlogSettings>) {
  const dates = {
    blogStartDate:
      settings.blogStartDate === undefined ? '' : settings.blogStartDate,
    blogCommentCountDate:
      settings.blogCommentCountDate === undefined
        ? ''
        : settings.blogCommentCountDate,
  }
  for (const key of ['blogStartDate', 'blogCommentCountDate'] as const) {
    if (typeof dates[key] !== 'string')
      throw new Error('博客信息日期必须是文本')
    dates[key] = dates[key].trim()
    if (dates[key] && calendarDay(dates[key]) === null)
      throw new Error('博客信息日期请填写有效的 YYYY-MM-DD 日期')
  }
  const blogCommentCount = settings.blogCommentCount ?? null
  if (
    blogCommentCount !== null &&
    (typeof blogCommentCount !== 'number' ||
      !Number.isSafeInteger(blogCommentCount) ||
      blogCommentCount < 0)
  )
    throw new Error('评论总数必须是非负安全整数，未配置时请留空')
  if ((blogCommentCount !== null) !== !!dates.blogCommentCountDate)
    throw new Error('评论快照请同时填写总数和核实日期')
  return { ...dates, blogCommentCount }
}

function contentTime(value: string): number | null {
  const match =
    /^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})?)?$/.exec(
      value,
    )
  if (
    !match ||
    calendarDay(match[1]) === null ||
    +(match[2] || 0) > 23 ||
    +(match[3] || 0) > 59 ||
    +(match[4] || 0) > 59
  )
    return null
  const time = new Date(
    value.length === 10 ? `${value}T00:00:00` : value.replace(' ', 'T'),
  ).getTime()
  return Number.isFinite(time) ? time : null
}

export function readBlogInfo(
  settings: Partial<BlogSettings>,
  posts: readonly PostMeta[],
  moments: readonly Moment[] | null,
  now = new Date(),
) {
  const publicPosts = posts.filter((post) => !post.draft && !post.hidden)
  const start = calendarDay(settings.blogStartDate || '')
  // 比较本地日历日期，避免夏令时使一天不足 24 小时。
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  const times = [
    ...publicPosts.flatMap((post) =>
      post.updated ? [post.date, post.updated] : [post.date],
    ),
    ...(moments || []).flatMap((moment) =>
      moment.updated ? [moment.date, moment.updated] : [moment.date],
    ),
  ].map(contentTime)
  let latest: number | null = null
  for (const time of times) {
    if (
      time !== null &&
      time <= now.getTime() &&
      (latest === null || time > latest)
    )
      latest = time
  }
  const activityUnavailable =
    moments === null ||
    times.some((time) => time === null) ||
    (times.length > 0 && latest === null)
  return {
    articleCount: publicPosts.length,
    commentCount: settings.blogCommentCount ?? null,
    commentCountDate: settings.blogCommentCountDate || '',
    runningDays:
      start === null || start > today ? null : (today - start) / 86400000,
    lastActivity:
      !activityUnavailable && latest !== null
        ? new Date(latest).toISOString()
        : null,
    activityUnavailable,
  }
}
