import '@angular/compiler'
import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { createEnvironmentInjector, type EnvironmentInjector } from '@angular/core'
import { LocalDemoService, isLocalPreview } from '../src/app/services/local-demo.service'
import { GitService, parseRepo } from '../src/app/services/git.service'
import { authIdentity } from '../src/shared/auth'
import config from '../src/generated/config.json'
import { BlogService } from '../src/app/services/blog.service'
import { AdminStore } from '../src/app/admin/admin-store.service'

const names = ['location', 'document', 'localStorage', 'sessionStorage', 'FileReader'] as const
const originals = new Map(names.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]))
let local: Map<string, string>
let session: Map<string, string>
let injector: EnvironmentInjector | undefined
function setGlobal(name: string, value: unknown) {
  Object.defineProperty(globalThis, name, { configurable: true, value })
}
function storage(map: Map<string, string>) {
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => { map.set(key, value) },
    removeItem: (key: string) => { map.delete(key) },
  }
}
beforeEach(() => {
  local = new Map()
  session = new Map([[`navblog:token:v1:/:${authIdentity(parseRepo(config.gitRepoUrl, config.branch))}`, 'test-existing-token']])
  setGlobal('location', { hostname: 'localhost' })
  setGlobal('document', { baseURI: 'http://localhost:4173/' })
  setGlobal('localStorage', storage(local))
  setGlobal('sessionStorage', storage(session))
})
afterEach(() => {
  injector?.destroy()
  injector = undefined
  for (const name of names) {
    const descriptor = originals.get(name)
    if (descriptor) Object.defineProperty(globalThis, name, descriptor)
    else Reflect.deleteProperty(globalThis, name)
  }
})
function services() {
  injector = createEnvironmentInjector([LocalDemoService, BlogService, GitService, AdminStore], null!)
  return { demo: injector.get(LocalDemoService), blog: injector.get(BlogService), git: injector.get(GitService), store: injector.get(AdminStore) }
}

test('仅允许明确的回环地址', () => {
  for (const host of ['localhost', '127.0.0.1', '::1', '[::1]']) assert.equal(isLocalPreview(host), true)
  for (const host of ['example.com', 'localhost.example.com', '127.0.0.1.example.com', '192.168.1.10', '0.0.0.0']) assert.equal(isLocalPreview(host), false)
})

test('进入、刷新和退出演示，不修改已有 Token；退出后重进保留演示数据', () => {
  const demo = new LocalDemoService()
  demo.enter()
  demo.save([{ path: 'data/about.md', content: '本地关于页' }])
  const reload = new LocalDemoService()
  assert.equal(reload.active(), true)
  assert.equal(reload.read('data/about.md'), '本地关于页')
  reload.exit()
  assert.equal(reload.read('data/about.md'), undefined)
  assert.equal(new LocalDemoService().active(), false)
  reload.enter()
  assert.equal(reload.read('data/about.md'), '本地关于页')
  assert.equal(local.has('token'), false)
})

test('线上域名即便存在演示标记也无法进入或写入演示', () => {
  session.set('navblog:local-demo:v1:/', 'active')
  setGlobal('location', { hostname: 'blog.example.com' })
  const demo = new LocalDemoService()
  assert.equal(demo.available, false)
  assert.equal(demo.active(), false)
  assert.throws(() => demo.enter(), /仅可/)
  assert.throws(() => demo.save([{ path: 'data/about.md', content: 'test' }]), /请先/)
})

test('浏览器保存失败时不产生部分修改，损坏的 JSON 使用默认数据', () => {
  const demo = new LocalDemoService()
  demo.enter()
  demo.save([{ path: 'data/posts.json', content: 'false' }])
  assert.deepEqual(demo.readJson('data/posts.json', []), [])
  setGlobal('localStorage', { setItem: () => { throw new Error('quota') } })
  assert.throws(() => demo.save([{ path: 'data/about.md', content: 'unsaved' }]), /无法保存/)
  assert.equal(demo.read('data/about.md'), undefined)
})

test('演示设置、文章增改删、关于页均写入本地，并同步前台；Git 和部署钩子无请求', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => { throw new Error('Unexpected network') })
  const { demo, blog, git, store } = services()
  const title = blog.settings().title
  demo.enter()
  await store.loadSettings()
  await store.saveSettings({ ...blog.settings(), title: '演示标题', hitokotoApi: 'https://example.com/quote', actionUrl: 'https://example.com/deploy' })
  assert.equal((await store.loadSettings()).title, '演示标题')
  assert.equal(blog.settings().hitokotoApi, 'https://example.com/quote')
  await store.savePost({ slug: 'local-test', title: '本地文章', date: '2026-11-10', tags: [] }, '演示正文')
  assert.equal(blog.findPost('local-test')?.title, '本地文章')
  assert.equal((await store.loadPost('local-test'))?.body.trim(), '演示正文')
  await store.savePost({ slug: 'local-renamed', title: '修改后的文章', date: '2026-11-10', tags: [] }, '修改正文', 'local-test')
  assert.equal(await git.getFile('data/posts/local-test.md'), null)
  assert.match(await blog.getPostSource('local-renamed'), /修改正文/)
  await store.deletePost('local-renamed')
  assert.equal(blog.findPost('local-renamed'), undefined)
  demo.save([{ path: 'data/about.md', content: '原关于页' }])
  await store.loadAbout()
  await store.saveAbout('本地关于')
  assert.equal(await blog.getAboutSource(), '本地关于')
  await git.fetchUser()
  git.triggerDeploy()
  await assert.rejects(git.login('unused-token'), /不会访问/)
  assert.equal(fetch.mock.callCount(), 0)
  assert.equal(local.has('token'), false)
  demo.exit()
  blog.refreshDemo()
  assert.equal(blog.settings().title, title)
})

test('未修改的文章和关于页只读取本地静态资源', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async (url) => {
    assert.match(String(url), /^http:\/\/localhost:4173\/content\//)
    return new Response('---\ntitle: 本地示例\ndate: 2026-11-10\n---\n本地文件正文')
  })
  const { demo, store } = services()
  demo.enter()
  assert.equal((await store.loadPost('hello-world'))?.body.trim(), '本地文件正文')
  assert.match(await store.loadAbout(), /本地文件正文/)
  assert.equal(fetch.mock.callCount(), 2)
})

test('碎碎念演示增改删和导出只写浏览器，退出恢复正式动态', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => { throw new Error('Unexpected network') })
  const { demo, blog, store } = services()
  demo.enter()
  assert.deepEqual(await store.loadMoments(), [])
  const item = { id: 'demo-moment', date: '2026-11-10T00:00:00Z', text: '第一行\n第二行' }
  await store.saveMoment(item, false)
  assert.equal(blog.getMoments()[0].text, item.text)
  assert.ok(JSON.parse(demo.exportFiles())['data/moments.json'].includes('第二行'))
  await store.saveMoment({ ...item, text: '修改后' }, true)
  assert.equal(blog.getMoments()[0].text, '修改后')
  await store.deleteMoment(item.id)
  assert.deepEqual(blog.getMoments(), [])
  assert.equal(fetch.mock.callCount(), 0)
  assert.equal(local.has('token'), false)
  demo.exit()
  assert.deepEqual(blog.getMoments(), [])
})

test('本地演示版本保护拒绝另一个窗口已更新的动态文件', () => {
  const demo = new LocalDemoService()
  demo.enter()
  demo.save([{ path: 'data/moments.json', content: '[]' }])
  const anotherWindow = new LocalDemoService()
  const latest = '[{"id":"remote","date":"2026-11-10T00:00:00Z","text":"新动态"}]'
  anotherWindow.save([{ path: 'data/moments.json', content: latest }])
  assert.throws(() => demo.save([{ path: 'data/moments.json', content: '[]', expectedContent: '[]' }]), /已被其他窗口修改/)
  assert.equal(new LocalDemoService().read('data/moments.json'), latest)
})

test('每日文字两个开关保存和刷新后保留 false，不被默认值覆盖', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => { throw new Error('Unexpected network') })
  const { demo, blog, store } = services()
  demo.enter()
  await store.loadSettings()
  await store.saveSettings({ ...blog.settings(), hitokotoEnable: false, hitokotoShowTitle: false })
  blog.refreshDemo()
  assert.equal(blog.settings().hitokotoEnable, false)
  assert.equal(blog.settings().hitokotoShowTitle, false)
  const saved = await store.loadSettings()
  assert.equal(saved.hitokotoEnable, false)
  assert.equal(saved.hitokotoShowTitle, false)
  const reloaded = new LocalDemoService().readJson('data/settings.json', blog.settings())
  assert.equal(reloaded.hitokotoEnable, false)
  assert.equal(reloaded.hitokotoShowTitle, false)
  assert.equal(fetch.mock.callCount(), 0)
})

test('图片在演示中返回 Data URL，不上传到 Git', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => { throw new Error('Unexpected upload') })
  setGlobal('FileReader', class {
    result = 'data:image/png;base64,aGVsbG8='
    onload?: () => void
    readAsDataURL() { this.onload?.() }
  })
  const { demo, git } = services()
  demo.enter()
  assert.equal(await git.uploadImage(new File(['hello'], 'test.png', { type: 'image/png' })), 'data:image/png;base64,aGVsbG8=')
  assert.equal(fetch.mock.callCount(), 0)
})

test('普通 Token 模式仍通过 Git API 读取文件', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.match(String(url), /\/contents\/data\/about.md/)
    assert.equal((options?.headers as Record<string, string>).Authorization, 'Bearer test-existing-token')
    return new Response(JSON.stringify({ content: Buffer.from('远程正文').toString('base64'), sha: 'remote-sha' }))
  })
  const { demo, git } = services()
  assert.equal(demo.active(), false)
  assert.deepEqual(await git.getFile('data/about.md'), { content: '远程正文', sha: 'remote-sha' })
  assert.equal(fetch.mock.callCount(), 1)
})
