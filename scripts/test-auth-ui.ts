import '@angular/compiler'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createEnvironmentInjector, signal } from '@angular/core'
import { Router } from '@angular/router'
import { LoginPage } from '../src/app/admin/login.page'
import { LoginPasswordComponent } from '../src/app/components/login-password.component'
import { AuthService } from '../src/app/services/auth.service'
import { BlogService } from '../src/app/services/blog.service'
import { GitService } from '../src/app/services/git.service'
import { LocalDemoService } from '../src/app/services/local-demo.service'
import { ToastService } from '../src/app/services/toast.service'
import { authIdentity, encryptAuth } from '../src/shared/auth'

const repo = {
  provider: 'github',
  host: 'github.com',
  owner: 'alice',
  repo: 'blog',
  branch: 'main',
  projectId: '',
} as const
const next = () => new Promise((resolve) => setTimeout(resolve, 0))
test('有密文默认密码Tab，密码解出Token走统一校验；Token兜底与配置异常可用', async () => {
  const password = 'Test1234',
    token = 'not-a-real-token',
    raw = await encryptAuth(token, password, authIdentity(repo))
  let source: string | null = raw,
    fail = false
  const logins: string[] = []
  const injector = createEnvironmentInjector(
    [
      {
        provide: AuthService,
        useValue: {
          loadPublic: async () => {
            if (fail) throw Error('格式错误')
            return source
          },
        },
      },
      { provide: BlogService, useValue: { setTitle() {} } },
      {
        provide: GitService,
        useValue: {
          repo,
          isLogin: () => false,
          login: async (token: string) => logins.push(token),
          cancelPendingLogin() {},
        },
      },
      { provide: LocalDemoService, useValue: { active: () => false } },
      { provide: ToastService, useValue: { success() {} } },
      { provide: Router, useValue: { navigateByUrl() {} } },
    ],
    null as any,
  )
  try {
    const page = injector.runInContext(() => new LoginPage())
    await next()
    assert.equal(page.mode(), 'password')
    page.password = password
    await page.submit({ preventDefault() {} } as Event)
    assert.deepEqual(logins, [token])
    assert.equal(page.password, '')
    page.selectMode('token')
    page.token = 'manual-test-token'
    await page.submit({ preventDefault() {} } as Event)
    assert.equal(logins[1], 'manual-test-token')
    source = null
    await page.loadConfig()
    assert.equal(page.mode(), 'token')
    assert.equal(page.authSource(), null)
    fail = true
    await page.loadConfig()
    assert.equal(page.mode(), 'token')
    assert.match(page.configError(), /格式错误/)
    page.ngOnDestroy()
  } finally {
    injector.destroy()
  }
})
test('密码模块强度/确认校验阻止保存，提交失败保留错误和密码，不误报成功', async () => {
  let saves = 0
  const messages: string[] = []
  const injector = createEnvironmentInjector(
    [
      {
        provide: AuthService,
        useValue: {
          loadManagement: async () => 'unset',
          setPassword: async () => {
            saves++
            throw Error('版本冲突')
          },
          removePassword: async () => {},
        },
      },
      { provide: LocalDemoService, useValue: { active: () => false } },
      {
        provide: ToastService,
        useValue: { success: (s: string) => messages.push(s) },
      },
    ],
    null as any,
  )
  try {
    const component = injector.runInContext(() => new LoginPasswordComponent())
    await next()
    component.password.set('short')
    component.confirm.set('short')
    await component.save({ preventDefault() {} } as Event)
    assert.equal(saves, 0)
    component.password.set('Abc12345')
    component.confirm.set('wrong')
    await component.save({ preventDefault() {} } as Event)
    assert.equal(saves, 0)
    component.confirm.set('Abc12345')
    await component.save({ preventDefault() {} } as Event)
    assert.equal(saves, 1)
    assert.match(component.error(), /版本冲突/)
    assert.equal(component.password(), 'Abc12345')
    assert.equal(messages.length, 0)
    component.ngOnDestroy()
    assert.equal(component.password(), '')
  } finally {
    injector.destroy()
  }
})
