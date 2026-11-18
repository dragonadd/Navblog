import { Injectable, inject } from '@angular/core'
import {
  AUTH_MAX_LENGTH,
  AUTH_PATH,
  authIdentity,
  encryptAuth,
  parseAuth,
  validLoginPassword,
} from '../../shared/auth'
import { BlogService } from './blog.service'
import { GitService } from './git.service'
import { LocalDemoService } from './local-demo.service'

@Injectable({ providedIn: 'root' })
export class AuthService {
  private blog = inject(BlogService)
  private git = inject(GitService)
  private demo = inject(LocalDemoService)
  private file:
    { content: string; sha: string; lastCommit?: string } | null | undefined

  async loadPublic(): Promise<string | null> {
    const controller = new AbortController(),
      timer = setTimeout(() => controller.abort(), 8000)
    try {
      const url = new URL(this.blog.url(AUTH_PATH))
      url.searchParams.set('t', String(Date.now()))
      const response = await fetch(url.href, {
        cache: 'no-store',
        credentials: 'omit',
        signal: controller.signal,
      })
      if (response.status === 404 || response.status === 204) return null
      if (!response.ok)
        throw new Error(
          `登录配置读取失败（${response.status}），可使用 Token 登录`,
        )
      if (Number(response.headers.get('content-length')) > AUTH_MAX_LENGTH)
        throw new Error('登录配置过大')
      const raw = await response.text()
      if (!raw.trim()) return null
      if (
        /^\s*</.test(raw) ||
        /text\/html/i.test(response.headers.get('content-type') || '')
      )
        throw new Error('登录配置返回了 HTML，请检查部署；可使用 Token 登录')
      parseAuth(raw)
      return raw
    } catch (e) {
      if (controller.signal.aborted)
        throw new Error('登录配置读取超时，可重试或使用 Token 登录')
      throw e
    } finally {
      clearTimeout(timer)
    }
  }

  async loadManagement(): Promise<'unset' | 'set' | 'invalid'> {
    if (this.demo.active()) throw new Error('本地演示不处理真实登录凭证')
    this.file = undefined
    const file = await this.git.getFile(AUTH_PATH)
    this.file = file
    if (!file?.content.trim()) return 'unset'
    try {
      parseAuth(file.content)
      return 'set'
    } catch {
      return 'invalid'
    }
  }

  private managedFile() {
    if (this.demo.active()) throw new Error('本地演示不处理真实登录凭证')
    if (!this.git.token()) throw new Error('请先通过 Token 或密码登录')
    if (this.file === undefined) throw new Error('请先刷新登录密码状态')
    return this.file
  }

  async setPassword(password: string, confirm: string) {
    const file = this.managedFile()
    if (!validLoginPassword(password))
      throw new Error('密码至少 8 位，且必须包含字母和数字')
    if (password !== confirm) throw new Error('两次密码不一致')
    const token = this.git.token()
    await this.git.validateToken(token)
    const content = await encryptAuth(
      token,
      password,
      authIdentity(this.git.repo),
    )
    if (this.git.token() !== token || this.demo.active())
      throw new Error('登录状态已变化，请重新登录')
    await this.git.commit(
      [
        {
          path: AUTH_PATH,
          content,
          expectedSha: file?.sha ?? null,
          expectedLastCommit: file?.lastCommit,
        },
      ],
      'update admin login password',
    )
    this.file = undefined
  }

  async removePassword() {
    const file = this.managedFile()
    if (!file) throw new Error('尚未设置登录密码')
    const token = this.git.token()
    await this.git.validateToken(token)
    if (this.demo.active() || this.git.token() !== token)
      throw new Error('登录状态已变化，请重新登录')
    await this.git.commit(
      [
        {
          path: AUTH_PATH,
          content: null,
          expectedSha: file.sha,
          expectedLastCommit: file.lastCommit,
        },
      ],
      'remove admin login password',
    )
    this.file = undefined
  }
}
