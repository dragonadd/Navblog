import { Component, OnDestroy, inject, signal } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { Router, RouterLink } from '@angular/router'
import { GitService } from '../services/git.service'
import { AuthService } from '../services/auth.service'
import { ToastService } from '../services/toast.service'
import { BlogService } from '../services/blog.service'
import { LocalDemoService } from '../services/local-demo.service'
import { authIdentity, decryptAuth } from '../../shared/auth'

@Component({
  selector: 'app-login-page',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="flex min-h-[70vh] items-center justify-center">
      <div class="fuwari-card w-full max-w-md p-5 sm:p-8">
        <div class="text-center">
          <div
            class="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--fuwari-primary-soft)] text-2xl text-[var(--fuwari-primary)]"
          >
            <i class="fas fa-pen-nib" aria-hidden="true"></i>
          </div>
          <h1 class="mt-4 text-2xl font-bold">管理后台</h1>
        </div>
        <p class="fuwari-muted mt-4 break-all text-xs">
          仓库：{{ blog.config.gitRepoUrl || '请先配置仓库地址' }}
        </p>
        <p class="fuwari-muted mt-1 break-all text-xs">
          提交分支：{{ git.repo.branch }}
        </p>
        @if (checking()) {
          <p class="fuwari-muted mt-4 text-sm" role="status">
            正在读取登录配置…
          </p>
        }
        @if (configError()) {
          <div class="mt-4 text-sm">
            <p class="text-red-500" role="alert">{{ configError() }}</p>
            <button
              class="fuwari-btn mt-2 !text-xs"
              (click)="loadConfig()"
              [disabled]="checking() || loading()"
            >
              重新读取配置
            </button>
          </div>
        }
        @if (authSource()) {
          <div
            class="mt-5 flex rounded-xl bg-[var(--fuwari-bg-soft)] p-1"
            role="tablist"
            aria-label="后台登录方式"
            (keydown)="tabKey($event)"
          >
            <button
              id="password-tab"
              type="button"
              role="tab"
              aria-controls="login-panel"
              [attr.aria-selected]="mode() === 'password'"
              class="fuwari-menu-item flex-1 justify-center"
              [class.active]="mode() === 'password'"
              (click)="selectMode('password')"
              [disabled]="loading()"
            >
              密码登录
            </button>
            <button
              id="token-tab"
              type="button"
              role="tab"
              aria-controls="login-panel"
              [attr.aria-selected]="mode() === 'token'"
              class="fuwari-menu-item flex-1 justify-center"
              [class.active]="mode() === 'token'"
              (click)="selectMode('token')"
              [disabled]="loading()"
            >
              Token 登录
            </button>
          </div>
        }
        <form
          id="login-panel"
          class="mt-5 flex flex-col gap-4"
          [attr.role]="authSource() ? 'tabpanel' : null"
          [attr.aria-labelledby]="authSource() ? mode() + '-tab' : null"
          (submit)="submit($event)"
        >
          @if (mode() === 'password' && authSource()) {
            <label class="fuwari-label"
              >登录密码<input
                type="password"
                class="fuwari-input mt-1"
                name="password"
                [(ngModel)]="password"
                [disabled]="loading()"
                autocomplete="off"
                required
                aria-label="登录密码"
            /></label>
            <p class="fuwari-muted text-xs">
              忘记密码可切换 Token 登录，再到设置中重设密码。
            </p>
          } @else {
            <label class="fuwari-label"
              >{{ git.providerName }} Token<input
                type="password"
                class="fuwari-input mt-1"
                name="token"
                [(ngModel)]="token"
                [disabled]="loading()"
                placeholder="粘贴具有仓库写权限的 Token"
                autocomplete="off"
                required
                aria-label="Git Token"
            /></label>
            <a
              class="fuwari-link text-xs"
              [href]="git.tokenHelpUrl"
              target="_blank"
              rel="noopener noreferrer"
              >如何获取 Token？</a
            >
          }
          @if (loginError()) {
            <p class="text-sm text-red-500" role="alert">{{ loginError() }}</p>
          }
          <button
            type="submit"
            class="fuwari-btn solid justify-center"
            [disabled]="
              checking() ||
              loading() ||
              (mode() === 'password' ? !password : !token.trim())
            "
          >
            {{ loading() ? '正在校验…' : '登录' }}
          </button>
          <p class="fuwari-muted text-xs">
            Token 仅保存在当前标签页的
            sessionStorage，刷新可保留，退出登录会清除。请勿在公共电脑使用；浏览器恢复会话可能保留数据。
          </p>
        </form>
        @if (demo.available) {
          <div class="mt-4 border-t border-[var(--fuwari-border)] pt-4">
            <button
              type="button"
              class="fuwari-btn w-full justify-center"
              (click)="enterDemo()"
              [disabled]="loading()"
            >
              进入本地演示（无需 Token）
            </button>
            <p class="fuwari-muted mt-2 text-center text-xs">
              演示仅保存浏览器副本，不读取或提交真实凭证。
            </p>
          </div>
        }
        <a class="fuwari-link mt-4 block text-center text-sm" routerLink="/"
          >返回博客</a
        >
      </div>
    </div>
  `,
})
export class LoginPage implements OnDestroy {
  readonly demo = inject(LocalDemoService)
  readonly git = inject(GitService)
  readonly blog = inject(BlogService)
  private auth = inject(AuthService)
  private toast = inject(ToastService)
  private router = inject(Router)
  readonly authSource = signal<string | null>(null)
  readonly mode = signal<'password' | 'token'>('token')
  readonly checking = signal(false)
  readonly loading = signal(false)
  readonly configError = signal('')
  readonly loginError = signal('')
  token = ''
  password = ''
  private alive = true
  private configVersion = 0
  constructor() {
    this.blog.setTitle('登录')
    if (this.demo.active() || this.git.isLogin())
      this.router.navigateByUrl('/admin')
    else void this.loadConfig()
  }
  async loadConfig() {
    if (this.checking() || this.loading()) return
    const version = ++this.configVersion
    this.checking.set(true)
    this.configError.set('')
    try {
      const raw = await this.auth.loadPublic()
      if (this.alive && version === this.configVersion) {
        this.authSource.set(raw)
        this.mode.set(raw ? 'password' : 'token')
      }
    } catch (e: any) {
      if (this.alive && version === this.configVersion) {
        this.authSource.set(null)
        this.mode.set('token')
        this.configError.set(e.message || '登录配置读取失败，可使用 Token 登录')
      }
    } finally {
      if (this.alive && version === this.configVersion) this.checking.set(false)
    }
  }
  selectMode(mode: 'token' | 'password') {
    if (this.loading()) return
    this.mode.set(mode)
    this.token = this.password = ''
    this.loginError.set('')
  }
  tabKey(event: KeyboardEvent) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    if (this.loading()) return
    event.preventDefault()
    const mode = event.key === 'ArrowLeft' ? 'password' : 'token'
    this.selectMode(mode)
    document.getElementById(mode + '-tab')?.focus()
  }
  enterDemo() {
    this.demo.enter()
    this.blog.refreshDemo()
    this.router.navigateByUrl('/admin')
  }
  async submit(event: Event) {
    event.preventDefault()
    if (this.loading() || this.checking()) return
    this.loading.set(true)
    this.loginError.set('')
    const token = this.token,
      password = this.password,
      source = this.authSource(),
      mode = this.mode()
    this.token = this.password = ''
    try {
      const credential =
        mode === 'password' && source
          ? await decryptAuth(source, password, authIdentity(this.git.repo))
          : token
      if (!this.alive) return
      await this.git.login(credential)
      if (!this.alive) return
      this.toast.success('登录成功')
      this.router.navigateByUrl('/admin')
    } catch (e: any) {
      if (this.alive)
        this.loginError.set(
          mode === 'password' && e.status === 401
            ? `密码已解密，但 Git Token 验证失败。请用有效 Token 登录分支 ${this.git.repo.branch}，重新设置登录密码并等待该分支部署完成。`
            : e.message || '登录失败，请重试',
        )
    } finally {
      if (this.alive) this.loading.set(false)
    }
  }
  ngOnDestroy() {
    this.alive = false
    ++this.configVersion
    this.token = this.password = ''
    this.git.cancelPendingLogin()
  }
}
