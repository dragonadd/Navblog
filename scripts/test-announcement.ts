import '@angular/compiler'
import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { createEnvironmentInjector, type EnvironmentInjector } from '@angular/core'
import settingsJson from '../data/settings.json'
import type { BlogSettings } from '../src/shared/types'
import { announcementVersion, normalizeAnnouncementLink, readAnnouncement, renderAnnouncementMarkdown } from '../src/shared/announcement'
import { renderMarkdown } from '../src/shared/markdown'
import { AnnouncementStateService } from '../src/app/services/announcement-state.service'

const settings = (overrides: Partial<BlogSettings> = {}): BlogSettings => ({ ...settingsJson, ...overrides })
const names = ['document', 'window', 'localStorage'] as const
const originals = new Map(names.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]))
let data: Map<string, string>
let events: Map<string, EventListener>
let injectors: EnvironmentInjector[]
const setGlobal = (name: string, value: unknown) => Object.defineProperty(globalThis, name, { configurable: true, value })
beforeEach(() => {
  data = new Map()
  events = new Map()
  injectors = []
  setGlobal('document', { baseURI: 'https://example.com/blog/' })
  setGlobal('window', { addEventListener: (name: string, handler: EventListener) => events.set(name, handler), removeEventListener: (name: string) => events.delete(name) })
  setGlobal('localStorage', { getItem: (key: string) => data.get(key) || null, setItem: (key: string, value: string) => data.set(key, value) })
})
afterEach(() => {
  for (const injector of injectors) injector.destroy()
  for (const name of names) {
    const descriptor = originals.get(name)
    if (descriptor) Object.defineProperty(globalThis, name, descriptor)
    else Reflect.deleteProperty(globalThis, name)
  }
})
function state() {
  const injector = createEnvironmentInjector([AnnouncementStateService], null!)
  injectors.push(injector)
  return injector.get(AnnouncementStateService)
}

test('旧设置默认禁用，空标题和明确 false 仍保留；保存的 Markdown 原文不被改写', () => {
  const old = settings()
  delete old.announcementEnable
  delete old.announcementClosable
  assert.equal(readAnnouncement(old).enabled, false)
  assert.equal(readAnnouncement(old).closable, true)
  const result = readAnnouncement(settings({ announcementTitle: '', announcementText: '<script>alert(1)</script>\n第二行', announcementClosable: false }))
  assert.equal(result.title, '')
  assert.equal(result.closable, false)
  assert.equal(result.text, '<script>alert(1)</script>\n第二行')
})

test('公告 Markdown 支持强调、列表及单行换行，标题不创建文章目录或锚点', () => {
  const html = renderAnnouncementMarkdown('**上线啦**\n*欢迎来访*\n\n- 第一项\n- 第二项\n\n## 提醒', 'https://example.com/blog/')
  assert.match(html, /<strong>上线啦<\/strong><br>\s*<em>欢迎来访<\/em>/)
  assert.match(html, /<ul>\s*<li>第一项<\/li>\s*<li>第二项<\/li>/)
  assert.match(html, /<h2>提醒<\/h2>/)
  assert.ok(!html.includes('md-anchor'))
  const post = renderMarkdown('第一行\n第二行\n\n## 文章标题')
  assert.ok(!post.html.includes('<br>'))
  assert.equal(post.toc.length, 1)
})

test('公告 Markdown 的站内链接和图片遵循部署子路径，外链使用安全新窗口', () => {
  const html = renderAnnouncementMarkdown('[关于](/about) [文章](posts/news) [外链](https://other.example/news "详情")\n\n![图片](images/note.png)', 'https://example.com/blog/')
  assert.match(html, /href="https:\/\/example.com\/blog\/about"/)
  assert.match(html, /href="https:\/\/example.com\/blog\/posts\/news"/)
  assert.match(html, /href="https:\/\/other.example\/news"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/)
  assert.match(html, /src="https:\/\/example.com\/blog\/images\/note.png"/)
  assert.equal((html.match(/target="_blank"/g) || []).length, 1)
})

test('公告原始 HTML 按文字显示，危险链接和图片只保留文字，不阻止其他 Markdown 渲染', () => {
  const raw = renderAnnouncementMarkdown('<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n**仍可显示**', 'https://example.com/blog/')
  assert.ok(!/<script>|<img\b/i.test(raw))
  assert.match(raw, /&lt;script&gt;/)
  assert.match(raw, /<strong>仍可显示<\/strong>/)
  for (const href of ['javascript:alert(1)', 'data:text/html,bad', '//other.example/path', 'https://user:pass@other.example/path']) {
    const html = renderAnnouncementMarkdown(`[**文字**](${href}) ![图片](${href})`, 'https://example.com/blog/')
    assert.ok(!/<a\b|<img\b/i.test(html), href)
    assert.match(html, /<strong>文字<\/strong>/)
    assert.ok(html.includes('图片'))
  }
})

test('公告链接支持站内与 HTTP(S)，拒绝执行协议、凭据与模糊地址；无效配置不使主页崩溃', () => {
  assert.equal(normalizeAnnouncementLink(' posts/news/ '), 'posts/news/')
  assert.equal(normalizeAnnouncementLink('https://example.com/news'), 'https://example.com/news')
  assert.equal(normalizeAnnouncementLink(''), '')
  for (const value of ['javascript:alert(1)', 'data:text/html,test', 'https://user:pass@example.com', '//example.com', 'https://example.com/\nx', '\\example.com']) assert.throws(() => normalizeAnnouncementLink(value))
  assert.equal(readAnnouncement(settings({ announcementLink: 'javascript:alert(1)' })).link, '')
})

test('标题、文本或链接变更创建新版本，启用与关闭按钮开关不创建新版本', () => {
  const original = readAnnouncement(settings({ announcementText: '原公告' }))
  const version = announcementVersion(original)
  for (const changes of [{ title: '新标题' }, { text: '新公告' }, { link: 'posts/new/' }]) assert.notEqual(announcementVersion({ ...original, ...changes }), version)
  assert.equal(announcementVersion({ ...original, enabled: !original.enabled, closable: !original.closable }), version)
})

test('关闭公告后刷新保留，其他站点子路径不继承关闭记录', () => {
  state().dismiss('版本一')
  assert.equal(state().dismissed(), '版本一')
  assert.equal(data.get('navblog:announcement:v1:/blog/'), '版本一')
  setGlobal('document', { baseURI: 'https://example.com/other/' })
  assert.equal(state().dismissed(), '')
})

test('浏览器存储受限时仍允许当前页面关闭公告', () => {
  setGlobal('localStorage', { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') } })
  const service = state()
  assert.equal(service.dismissed(), '')
  service.dismiss('版本一')
  assert.equal(service.dismissed(), '版本一')
})

test('其他标签页关闭或清空记录时同步状态，服务销毁后清理监听', () => {
  const service = state()
  data.set('navblog:announcement:v1:/blog/', '版本二')
  events.get('storage')?.({ key: 'navblog:announcement:v1:/blog/' } as unknown as Event)
  assert.equal(service.dismissed(), '版本二')
  data.clear()
  events.get('storage')?.({ key: null } as unknown as Event)
  assert.equal(service.dismissed(), '')
  injectors[0].destroy()
  assert.equal(events.has('storage'), false)
  injectors = []
})
