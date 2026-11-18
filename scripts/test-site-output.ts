import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as lib from './lib'
import { normalizeThemeSettings } from '../src/shared/theme-settings'
import type { BlogSettings } from '../src/shared/types'

test('manifest 名称、颜色和子路径应用到安装参数与图标', () => {
  assert.equal(typeof (lib as any).createManifest, 'function')
  const s = normalizeThemeSettings({
    title: '我的站点',
    pwaName: '安装名称',
    pwaShortName: '简称',
    pwaThemeColor: '#112233',
    pwaBackgroundColor: '#445566',
  }) as BlogSettings
  const manifest = (lib as any).createManifest(s, '/blog/')
  assert.equal(manifest.name, '安装名称')
  assert.equal(manifest.short_name, '简称')
  assert.equal(manifest.theme_color, '#112233')
  assert.equal(manifest.start_url, '/blog/')
  assert.equal(manifest.scope, '/blog/')
  assert.equal(manifest.icons[0].src, '/blog/icons/icon-192x192.png')
  assert.equal(
    (lib as any).createManifest(
      normalizeThemeSettings({ title: '我的站点' }),
      '/',
    ).name,
    '我的站点',
  )
})
test('尺寸错误、目录越界和非本地图标拒绝；可配置 maskable', () => {
  assert.equal(typeof (lib as any).createManifest, 'function')
  const s = normalizeThemeSettings({ title: '图标测试' })
  for (const pwaIcon192 of [
    'icons/icon-512x512.png',
    '../data/settings.json',
    'https://example.com/icon.png',
    'avatar.svg',
  ])
    assert.throws(() => (lib as any).createManifest({ ...s, pwaIcon192 }, '/'))
  const manifest = (lib as any).createManifest(
    { ...s, pwaIcon192Maskable: 'icons/icon-192x192.png' },
    '/',
  )
  assert.equal(manifest.icons[2].purpose, 'maskable')
})
test('RSS 摘要模式不输出普通全文；加密文章无论模式只用公开摘要', () => {
  assert.equal(typeof (lib as any).rssContent, 'function')
  const meta = {
    slug: 'test',
    title: '公开',
    date: '2026-11-10',
    tags: [],
    summary: '公开摘要 & 说明',
  }
  assert.ok(
    (lib as any)
      .rssContent(meta, '全文机密标记', true)
      .includes('全文机密标记'),
  )
  assert.ok(
    !(lib as any)
      .rssContent(meta, '全文机密标记', false)
      .includes('全文机密标记'),
  )
  assert.ok((lib as any).rssContent(meta, '', false).includes('&amp;'))
  for (const full of [true, false]) {
    const text = (lib as any).rssContent(
      { ...meta, encrypted: true },
      'ciphertext',
      full,
    )
    assert.ok(!text.includes('ciphertext'))
    assert.ok(text.includes('公开摘要'))
  }
})
