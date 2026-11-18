import '@angular/compiler'
import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { DEFAULT_HITOKOTO_API, HitokotoService, normalizeHitokotoApi } from '../src/app/services/hitokoto.service'

const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
let saved: Map<string, string>
beforeEach(() => {
  saved = new Map()
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => saved.get(key) ?? null,
      setItem: (key: string, value: string) => saved.set(key, value),
    },
  })
})
afterEach(() => {
  if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage)
  else Reflect.deleteProperty(globalThis, 'localStorage')
})

const response = (text = '今日一句') => new Response(JSON.stringify({ hitokoto: text, from: '测试', from_who: null }), {
  headers: { 'Content-Type': 'application/json' },
})

test('同日并发、路由重访及刷新只请求一次，旧设置和空设置均用默认 API', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => response())
  const service = new HitokotoService()
  const [first, second] = await Promise.all([service.getQuote(), service.getQuote('  ')])
  assert.deepEqual(first, { text: '今日一句', from: '测试', author: '' })
  assert.deepEqual(first, second)
  await service.getQuote()
  assert.deepEqual(await new HitokotoService().getQuote(), first)
  assert.equal(fetch.mock.callCount(), 1)
  assert.equal(fetch.mock.calls[0].arguments[0], normalizeHitokotoApi(DEFAULT_HITOKOTO_API))
})

test('按访客本地日期在跨天后更新，而不是按 UTC 日期', async (t) => {
  const now = new Date(2026, 10, 9, 23, 59, 59).getTime()
  t.mock.timers.enable({ apis: ['Date'], now })
  const fetch = t.mock.method(globalThis, 'fetch', async () => response(`句子 ${fetch.mock.callCount()}`))
  const service = new HitokotoService()
  const yesterday = await service.getQuote()
  assert.equal(JSON.parse([...saved.values()][0]).date, '2026-11-09')
  t.mock.timers.setTime(now + 2000)
  const today = await service.getQuote()
  assert.notEqual(today.text, yesterday.text)
  assert.equal(JSON.parse([...saved.values()][0]).date, '2026-11-10')
  assert.equal(fetch.mock.callCount(), 2)
})

test('更换 API 不沿用旧接口缓存，切回原接口仍复用当天数据', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async (url) => response(`句子来自 ${url}`))
  const service = new HitokotoService()
  const first = await service.getQuote()
  const custom = await service.getQuote('https://example.com/quote?c=a')
  assert.notEqual(first.text, custom.text)
  assert.deepEqual(await service.getQuote(), first)
  assert.equal(fetch.mock.callCount(), 2)
})

test('损坏的缓存会重新获取', async (t) => {
  saved.set(`navblog:hitokoto:v2:${JSON.stringify([normalizeHitokotoApi(), 'custom', ''])}`, '{broken')
  const fetch = t.mock.method(globalThis, 'fetch', async () => response())
  await new HitokotoService().getQuote()
  assert.equal(fetch.mock.callCount(), 1)
})

test('浏览器禁用 localStorage 时仍显示并使用内存缓存', async (t) => {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get: () => { throw new Error('Storage blocked') } })
  const fetch = t.mock.method(globalThis, 'fetch', async () => response())
  const service = new HitokotoService()
  await service.getQuote()
  await service.getQuote()
  assert.equal(fetch.mock.callCount(), 1)
})

test('请求失败、HTTP 错误和无效响应均不缓存，允许再次重试', async (t) => {
  let attempt = 0
  t.mock.method(globalThis, 'fetch', async () => {
    attempt++
    if (attempt === 1) throw new TypeError('Failed to fetch')
    if (attempt === 2) return new Response('', { status: 503 })
    if (attempt === 3) return new Response('{"hitokoto":"  "}')
    if (attempt === 4) return new Response('<html>error</html>')
    return response()
  })
  const service = new HitokotoService()
  for (let i = 0; i < 4; i++) {
    await assert.rejects(service.getQuote())
    assert.equal(saved.size, 0)
  }
  assert.equal((await service.getQuote()).text, '今日一句')
  assert.equal(attempt, 5)
})

test('8 秒超时后中止请求，且不写入缓存', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  t.mock.method(globalThis, 'fetch', (_url, options) => new Promise<Response>((_resolve, reject) => {
    options?.signal?.addEventListener('abort', () => reject(new Error('Aborted')), { once: true })
  }))
  const result = assert.rejects(new HitokotoService().getQuote(), /Aborted/)
  t.mock.timers.tick(8000)
  await result
  assert.equal(saved.size, 0)
})

test('拒绝非 HTTP 协议及无效地址', async () => {
  const service = new HitokotoService()
  await assert.rejects(service.getQuote('javascript:alert(1)'), /HTTP/)
  await assert.rejects(service.getQuote('not-a-url'))
})
