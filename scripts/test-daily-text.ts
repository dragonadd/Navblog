import '@angular/compiler'
import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import settingsJson from '../data/settings.json'
import type { BlogSettings } from '../src/shared/types'
import { parseDailySources, extractDailyQuote, renderDailyTemplate, limitDailyText, sourceText } from '../src/shared/daily-text'
import { HitokotoService } from '../src/app/services/hitokoto.service'

const settings = (overrides: Partial<BlogSettings> = {}): BlogSettings => ({ ...settingsJson, ...overrides })
const jsonResponse = (data: unknown) => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } })
const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
beforeEach(() => {
  const data = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => data.get(key) || null,
    setItem: (key: string, value: string) => { data.set(key, value) },
  } })
})
afterEach(() => {
  if (original) Object.defineProperty(globalThis, 'localStorage', original)
  else Reflect.deleteProperty(globalThis, 'localStorage')
})

test('解析内置名、显示名、自定义接口和点号路径；出处设置不依赖位置', () => {
  const sources = parseDailySources('一言 | hitokoto | 正文\nhttps://example.com/api | data.news.0\n出处｜诗词｜jinrishici')
  assert.equal(sources[0].attribution, false)
  assert.equal(sources[0].label, '一言')
  assert.equal(sources[1].path, 'data.news.0')
  assert.equal(sources[2].attribution, true)
  assert.equal(sources[2].kind, 'jinrishici')
  assert.equal(parseDailySources('hitokoto | https://example.com/custom')[0].kind, 'custom')
})

test('拒绝未知来源、图片来源、多余参数、无效路径和超出来源数量', () => {
  for (const raw of ['bing', 'unknown', 'javascript:alert(1)', 'https://x.com | data[0]', 'a | b | hitokoto', 'https://x.com | a | b', Array(6).fill('hitokoto').join('\n')]) {
    assert.throws(() => parseDailySources(raw))
  }
})

test('五个文字内置源正确提取正文和出处', () => {
  const quote = (name: string, data: unknown) => extractDailyQuote(data, parseDailySources(name)[0])
  assert.deepEqual(quote('hitokoto', { hitokoto: '一句话', from: '作品', from_who: '作者' }), { text: '一句话', from: '作品', author: '作者' })
  assert.deepEqual(quote('jinrishici', { data: { content: '诗句', origin: { title: '诗题', author: '诗人' } } }), { text: '诗句', from: '诗题', author: '诗人' })
  assert.deepEqual(quote('xygeng', { data: { content: '随机文字', origin: '出处', name: '作者' } }), { text: '随机文字', from: '出处', author: '作者' })
  assert.equal(quote('60s', { data: { news: ['新闻一', '新闻二'], tip: '提示' } }).text, '1. 新闻一\n2. 新闻二\n\n💡 提示')
  assert.equal(quote('history', { data: { items: [{ year: 2000, title: '事件一' }, { year: 2001, title: '事件二' }] } }).text, '· 2000年 · 事件一\n· 2001年 · 事件二')
})

test('自动识别嵌套文字、数组和纯文本，显式路径优先且不存在时明确报错', () => {
  const custom = parseDailySources('https://example.com/api')[0]
  assert.equal(extractDailyQuote({ data: { content: '嵌套正文' } }, custom).text, '嵌套正文')
  assert.equal(extractDailyQuote(['甲', '乙'], custom).text, '1. 甲\n2. 乙')
  assert.equal(extractDailyQuote('纯文本', custom).text, '纯文本')
  const source = parseDailySources('hitokoto | data.chosen')[0]
  assert.equal(extractDailyQuote({ hitokoto: '忽略', data: { chosen: '指定正文' } }, source).text, '指定正文')
  assert.throws(() => extractDailyQuote({ hitokoto: '不应回退' }, source), /路径/)
})

test('不会将图片、错误消息或出处当作正文；回退提取可读文字', () => {
  const custom = parseDailySources('https://example.com/api')[0]
  assert.throws(() => extractDailyQuote({ image: 'https://x.com/a.png', error: '接口失败', from: '出处' }, custom))
  assert.equal(extractDailyQuote({ image: 'https://x.com/a.png', data: { saying: '陌生字段里的文字' } }, custom).text, '陌生字段里的文字')
})

test('日期变量、多行文字及字数截断正确，保留完整 emoji', () => {
  assert.equal(renderDailyTemplate('{date} {time} {weekday} {month} {day}\\n{unknown}', new Date(2026, 10, 10, 8, 5)), '2026-11-10 08:05 星期二 11 月 10 日\n{unknown}')
  assert.equal(limitDailyText('😀甲乙', 2), '😀甲…')
})

test('部分接口失败仍返回成功来源和自定义文字；重试只请求失败来源', async (t) => {
  const counts: Record<string, number> = {}
  t.mock.method(globalThis, 'fetch', async (url) => {
    const key = String(url)
    counts[key] = (counts[key] || 0) + 1
    if (key.includes('failed')) throw new Error('offline')
    return jsonResponse({ content: '可用正文' })
  })
  const service = new HitokotoService()
  const config = settings({ hitokotoSources: '正常 | https://example.com/ok\n失败 | https://example.com/failed', hitokotoCustomText: '自定义 {date}' })
  const result = await service.getDaily(config)
  assert.equal(result.parts.length, 2)
  assert.equal(result.failures.length, 1)
  assert.match(result.failures[0], /失败/)
  await service.getDaily(config)
  assert.equal(counts['https://example.com/ok'], 1)
  assert.equal(counts['https://example.com/failed'], 2)
})

test('更改标题、出处和截断长度复用当天 API 缓存，单源出处覆盖全局', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => jsonResponse({ hitokoto: '长'.repeat(200), from_who: '作者' }))
  const service = new HitokotoService()
  await service.getDaily(settings({ hitokotoSources: 'hitokoto' }))
  const result = await service.getDaily(settings({ hitokotoSources: 'hitokoto | 出处', hitokotoShowFrom: false, hitokotoMaxLength: 100, hitokotoTitle: '每日文字' }))
  assert.equal(fetch.mock.callCount(), 1)
  assert.equal(result.parts[0].attribution, true)
  assert.equal(result.parts[0].text, '长'.repeat(100) + '…')
  const hidden = await service.getDaily(settings({ hitokotoSources: 'hitokoto | 正文', hitokotoShowFrom: true }))
  assert.equal(hidden.parts[0].attribution, false)
})

test('自定义文字按当前时间生成，刷新不沿用旧缓存，关闭后不请求 API', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date(2026, 10, 10, 8, 0).getTime() })
  const fetch = t.mock.method(globalThis, 'fetch', async () => { throw new Error('Should not fetch') })
  const service = new HitokotoService()
  const config = settings({ hitokotoSources: '', hitokotoCustomText: '{date} {time}' })
  assert.equal((await service.getDaily(config)).parts[0].text, '2026-11-10 08:00')
  t.mock.timers.setTime(new Date(2026, 10, 10, 12, 0).getTime())
  assert.equal((await service.getDaily(config)).parts[0].text, '2026-11-10 12:00')
  assert.equal((await new HitokotoService().getDaily(config)).parts[0].text, '2026-11-10 12:00')
  t.mock.timers.setTime(new Date(2026, 10, 11, 12, 0).getTime())
  assert.equal((await service.getDaily(config)).parts[0].text, '2026-11-11 12:00')
  assert.deepEqual(await service.getDaily(settings({ hitokotoEnable: false })), { parts: [], failures: [] })
  assert.equal(fetch.mock.callCount(), 0)
})

test('兼容旧 API 设置，明确的空来源不会恢复默认接口', () => {
  assert.equal(sourceText({ hitokotoApi: 'https://example.com/old' }), 'https://example.com/old')
  assert.equal(sourceText({}), 'hitokoto')
  assert.equal(sourceText({ hitokotoSources: '', hitokotoApi: 'https://example.com/old' }), '')
})

test('总开关关闭时跳过无效来源和自定义文字，不读取缓存或发请求', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => { throw new Error('Should not fetch') })
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get: () => { throw new Error('Should not read storage') } })
  const result = await new HitokotoService().getDaily(settings({
    hitokotoEnable: false, hitokotoSources: '无效接口', hitokotoCustomText: '不应生成 {date}',
  }))
  assert.deepEqual(result, { parts: [], failures: [] })
  assert.equal(fetch.mock.callCount(), 0)
})

test('隐藏标题保留正文和出处，关闭再启用仍复用当天缓存', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => jsonResponse({ hitokoto: '保留正文', from: '作品', from_who: '作者' }))
  const service = new HitokotoService()
  const config = settings({ hitokotoSources: 'hitokoto', hitokotoShowTitle: false })
  const first = await service.getDaily(config)
  assert.equal(first.parts[0].text, '保留正文')
  assert.equal(first.parts[0].from, '作品')
  assert.equal(first.parts[0].author, '作者')
  assert.equal(first.parts[0].attribution, true)
  assert.deepEqual(await service.getDaily({ ...config, hitokotoEnable: false }), { parts: [], failures: [] })
  assert.deepEqual(await service.getDaily({ ...config, hitokotoEnable: true }), first)
  assert.equal(fetch.mock.callCount(), 1)
})

test('浏览器请求支持纯文本和 JSON 字符串，拒绝 HTML 错误页', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url) => {
    if (String(url).endsWith('/plain')) return new Response('直接返回的文字', { headers: { 'Content-Type': 'text/plain' } })
    if (String(url).endsWith('/json')) return jsonResponse('JSON 字符串')
    return new Response('<html>错误页</html>', { headers: { 'Content-Type': 'text/html' } })
  })
  const result = await new HitokotoService().getDaily(settings({ hitokotoCustomText: '', hitokotoSources: 'https://example.com/plain\nhttps://example.com/json\nhttps://example.com/html' }))
  assert.deepEqual(result.parts.map((part) => part.text), ['直接返回的文字', 'JSON 字符串'])
  assert.equal(result.failures.length, 1)
})
