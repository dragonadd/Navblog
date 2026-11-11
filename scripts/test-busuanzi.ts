import '@angular/compiler'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  createEnvironmentInjector,
  signal,
  ɵEffectScheduler,
  ɵChangeDetectionScheduler,
} from '@angular/core'
import { HttpClient } from '@angular/common/http'
import { DomSanitizer } from '@angular/platform-browser'
import { Subject } from 'rxjs'
import { BlogService } from '../src/app/services/blog.service'
import { FooterComponent } from '../src/app/components/footer.component'

function footer(enabled = true) {
  const settings = signal({ busuanzi: enabled })
  const path = signal('/')
  const requests: {
    url: string
    callback: string
    response: Subject<unknown>
  }[] = []
  const injector = createEnvironmentInjector(
    [
      {
        provide: ɵEffectScheduler,
        useFactory: () => (ɵEffectScheduler as any).ɵprov.factory(),
      },
      { provide: ɵChangeDetectionScheduler, useValue: { notify() {} } },
      { provide: BlogService, useValue: { settings } },
      { provide: DomSanitizer, useValue: {} },
      {
        provide: HttpClient,
        useValue: {
          jsonp: (url: string, callback: string) => {
            const response = new Subject<unknown>()
            requests.push({ url, callback, response })
            return response
          },
        },
      },
    ],
    null as any,
  )
  const component = injector.runInContext(() => new FooterComponent()) as any
  component.path = path
  const flush = () => injector.get(ɵEffectScheduler).flush()
  const reply = (data: unknown) => {
    requests.at(-1)!.response.next(data)
    requests.at(-1)!.response.complete()
  }
  return { injector, component, settings, path, requests, flush, reply }
}

test('关闭统计不发请求，启用后使用官方 JSONP 并显示有效计数，其他设置不重复计数', () => {
  const f = footer(false)
  try {
    f.flush()
    assert.equal(f.requests.length, 0)
    f.settings.set({ busuanzi: true })
    f.flush()
    assert.equal(f.requests.length, 1)
    const url = new URL(f.requests[0].url)
    assert.equal(
      url.origin + url.pathname,
      'https://busuanzi.ibruce.info/busuanzi',
    )
    assert.ok(Number(url.searchParams.get('t')) > 0)
    assert.equal(f.requests[0].callback, 'jsonpCallback')
    f.reply({ site_pv: 10, site_uv: 9 })
    assert.deepEqual(f.component.stats(), { pv: 10, uv: 9 })
    assert.equal(f.component.statsFailed(), false)
    f.settings.set({ busuanzi: true, title: '修改标题' } as any)
    f.flush()
    assert.equal(f.requests.length, 1)
    f.settings.set({ busuanzi: false })
    f.flush()
    assert.equal(f.component.stats(), null)
  } finally {
    f.injector.destroy()
  }
})

test('站内换页重新请求，目录锚点不重复计数，旧页面响应不能覆盖新页面', () => {
  const f = footer()
  try {
    f.flush()
    const old = f.requests[0].response
    f.path.set('/about')
    f.flush()
    assert.equal(f.requests.length, 2)
    assert.equal(old.observers.length, 0)
    old.next({ site_pv: 999, site_uv: 999 })
    assert.equal(f.component.stats(), null)
    f.reply({ site_pv: 11, site_uv: 9 })
    assert.deepEqual(f.component.stats(), { pv: 11, uv: 9 })
    f.path.set('/about#本站')
    f.flush()
    assert.equal(f.requests.length, 2)
  } finally {
    f.injector.destroy()
  }
})

test('无效返回值和网络失败显示不可用，合法零计数保留', () => {
  const f = footer()
  try {
    for (const [index, data] of [
      null,
      {},
      { site_pv: -1, site_uv: 2 },
      { site_pv: '<script>', site_uv: 1 },
      { site_pv: 1.5, site_uv: 1 },
    ].entries()) {
      f.path.set(`/page/${index}`)
      f.flush()
      f.reply(data)
      assert.equal(f.component.stats(), null)
      assert.equal(f.component.statsFailed(), true)
    }
    f.path.set('/error')
    f.flush()
    f.requests.at(-1)!.response.error(new Error('blocked'))
    assert.equal(f.component.statsFailed(), true)
    f.path.set('/zero')
    f.flush()
    f.reply({ site_pv: 0, site_uv: 0 })
    assert.deepEqual(f.component.stats(), { pv: 0, uv: 0 })
    assert.equal(f.component.statsFailed(), false)
  } finally {
    f.injector.destroy()
  }
})

test('超时取消统计请求，组件销毁清理未完成请求', (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] })
  const f = footer()
  try {
    f.flush()
    t.mock.timers.tick(10001)
    assert.equal(f.component.statsFailed(), true)
    assert.equal(f.requests[0].response.observers.length, 0)
    f.path.set('/next')
    f.flush()
    const pending = f.requests.at(-1)!.response
    f.injector.destroy()
    assert.equal(pending.observers.length, 0)
  } finally {
    if (!(f.injector as any).destroyed) f.injector.destroy()
  }
})
