import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as theme from '../src/shared/theme-settings'
import '@angular/compiler'
import { createEnvironmentInjector, signal } from '@angular/core'
import { SidebarComponent } from '../src/app/components/sidebar.component'
import { BlogService } from '../src/app/services/blog.service'

test('旧配置使用系统主题、开启全文 RSS/PWA、左侧栏', () => {
  const s = theme.normalizeThemeSettings({}) as any
  assert.equal(s.appearance, 'system')
  assert.equal(s.rssEnable, true)
  assert.equal(s.rssFullContent, true)
  assert.equal(s.pwaEnable, true)
  assert.equal(s.sidebarReverse, false)
})
test('明确 false 保留，非法时段、颜色和执行链接拒绝', () => {
  const s = theme.normalizeThemeSettings({
    rssEnable: false,
    rssFullContent: false,
    pwaEnable: false,
  } as any) as any
  assert.equal(s.rssEnable, false)
  assert.equal(s.rssFullContent, false)
  assert.equal(s.pwaEnable, false)
  for (const value of [
    { appearance: 'other' },
    { darkStart: 24 },
    { darkEnd: -1 },
    { darkStart: 1.5 },
    { pwaThemeColor: 'red; color:red' },
    { beiAnLink: 'javascript:alert(1)' },
  ])
    assert.throws(() => theme.normalizeThemeSettings(value as any))
})
test('手动偏好优先，自动时段覆盖跨午夜及边界', () => {
  const resolveDark = (theme as any).resolveDark
  assert.equal(typeof resolveDark, 'function')
  const at = (hour: number) => new Date(2026, 10, 10, hour, 0)
  const auto = { appearance: 'auto', darkStart: 22, darkEnd: 7 }
  assert.equal(resolveDark(auto, null, false, at(22)), true)
  assert.equal(resolveDark(auto, null, true, at(7)), false)
  assert.equal(resolveDark(auto, null, false, at(0)), true)
  assert.equal(resolveDark(auto, '0', true, at(23)), false)
  assert.equal(resolveDark(auto, '1', false, at(12)), true)
  assert.equal(
    resolveDark(
      { appearance: 'auto', darkStart: 8, darkEnd: 17 },
      null,
      false,
      at(9),
    ),
    true,
  )
  assert.equal(
    resolveDark(
      { appearance: 'auto', darkStart: 8, darkEnd: 8 },
      null,
      true,
      at(9),
    ),
    false,
  )
  assert.equal(resolveDark({ appearance: 'light' }, null, true, at(0)), false)
  assert.equal(resolveDark({ appearance: 'dark' }, null, false, at(0)), true)
  assert.equal(resolveDark({}, 'invalid', true, at(0)), true)
})

test('关闭 RSS 仅隐藏本站订阅，保留外站同路径和不可解析的社交地址', () => {
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document')
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { baseURI: 'https://site.example/blog/' } })
  const injector = createEnvironmentInjector([{ provide: BlogService, useValue: {
    settings: signal({ rssEnable: false, social: [{ url: 'rss.xml' }, { url: 'https://other.example/blog/rss.xml' }, { url: 'https://' }] }),
    url: (value: string) => value.startsWith('https://') ? value : new URL(value, 'https://site.example/blog/').href,
  } }], null as any)
  try {
    const sidebar = injector.runInContext(() => new SidebarComponent())
    assert.deepEqual(sidebar.social().map(s => s.url), ['https://other.example/blog/rss.xml', 'https://'])
  } finally {
    injector.destroy()
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument)
    else Reflect.deleteProperty(globalThis, 'document')
  }
})
