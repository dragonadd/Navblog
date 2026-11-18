import '@angular/compiler'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createEnvironmentInjector } from '@angular/core'
import { SidebarComponent } from '../src/app/components/sidebar.component'
import { BlogService } from '../src/app/services/blog.service'
import { LocalDemoService } from '../src/app/services/local-demo.service'
import {
  availableSidebarModules,
  normalizeThemeSettings,
  SIDEBAR_MODULES,
} from '../src/shared/theme-settings'

test('碎碎念模块可设置左右或隐藏，关闭开关后不占用侧栏', () => {
  assert.ok(SIDEBAR_MODULES.some(({ key }) => key === ('moments' as any)))
  assert.equal(
    normalizeThemeSettings({ sidebarMoments: 'false' } as any).sidebarMoments,
    false,
  )
  assert.throws(
    () => normalizeThemeSettings({ sidebarMoments: 1 } as any),
    /布尔/,
  )
  for (const side of ['left', 'right', 'hidden']) {
    const settings = normalizeThemeSettings({
      sidebarPositions: { moments: side },
    } as any)
    assert.equal((settings.sidebarPositions as any).moments, side)
    assert.ok(
      availableSidebarModules(settings, {
        announcement: false,
        categories: false,
        tags: false,
        toc: false,
      }).includes('moments' as any),
    )
    assert.ok(
      !availableSidebarModules({ ...settings, sidebarMoments: false } as any, {
        announcement: false,
        categories: false,
        tags: false,
        toc: false,
      }).includes('moments' as any),
    )
  }
})

test('侧栏选择最新发布时间，保留纯文本换行，演示修改后更新，空或损坏数据不使侧栏崩溃', () => {
  let local = JSON.stringify([
    {
      id: 'older',
      date: '2026-01-01T00:00:00Z',
      updated: '2026-02-02T00:00:00Z',
      text: '较早发布',
    },
    {
      id: 'newer',
      date: '2026-02-01T00:00:00Z',
      text: '<b>原样文字</b>\n第二行',
    },
  ])
  const injector = createEnvironmentInjector(
    [
      BlogService,
      {
        provide: LocalDemoService,
        useValue: {
          readJson: (_: string, fallback: unknown) => fallback,
          read: (file: string) =>
            file === 'data/moments.json' ? local : undefined,
        },
      },
    ],
    null as any,
  )
  try {
    const blog = injector.get(BlogService)
    const sidebar = injector.runInContext(() => new SidebarComponent()) as any
    assert.equal(sidebar.latestMoment().id, 'newer')
    assert.equal(sidebar.latestMoment().text, '<b>原样文字</b>\n第二行')
    local = JSON.stringify([
      { id: 'next', date: '2026-03-01T00:00:00Z', text: '更新内容' },
    ])
    blog.refreshDemo()
    assert.equal(sidebar.latestMoment().id, 'next')
    local = '[]'
    blog.refreshDemo()
    assert.equal(sidebar.latestMoment(), undefined)
    local = '{'
    blog.refreshDemo()
    assert.doesNotThrow(() => sidebar.latestMoment())
    assert.equal(sidebar.latestMoment(), undefined)
  } finally {
    injector.destroy()
  }
})
