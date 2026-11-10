import { Component, OnDestroy, computed, inject, signal } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { AUTH_DEPLOY_MESSAGE, validLoginPassword } from '../../shared/auth'
import { AuthService } from '../services/auth.service'
import { LocalDemoService } from '../services/local-demo.service'
import { ToastService } from '../services/toast.service'

@Component({
  selector: 'app-login-password',
  imports: [FormsModule],
  template: `
    <section class="fuwari-card p-5">
      <h2 class="fuwari-section-title mb-4">登录密码管理</h2>
      @if (demo.active()) {
        <p class="fuwari-muted text-sm">
          本地演示不读取或保存真实 Token。请退出演示并使用 Token
          登录后管理密码。
        </p>
      } @else {
        <div class="mb-4 flex flex-wrap items-center gap-3 text-sm">
          <span>{{ statusText() }}</span
          ><button
            type="button"
            class="fuwari-btn !text-xs"
            (click)="refresh()"
            [disabled]="checking() || busy()"
          >
            刷新状态
          </button>
        </div>
        @if (status() === 'invalid') {
          <p class="mb-3 text-sm text-red-500" role="alert">
            凭证文件损坏，可用当前已校验的 Token 重新设置或移除。
          </p>
        }
        @if (error()) {
          <p class="mb-3 text-sm text-red-500" role="alert">{{ error() }}</p>
        }
        <form (submit)="save($event)">
          <div class="grid gap-3 md:grid-cols-2">
            <label class="fuwari-label"
              >新登录密码<input
                class="fuwari-input mt-1"
                type="password"
                name="password"
                [ngModel]="password()"
                (ngModelChange)="password.set($event)"
                [disabled]="busy()"
                autocomplete="new-password"
                aria-label="新登录密码"
            /></label>
            <label class="fuwari-label"
              >确认登录密码<input
                class="fuwari-input mt-1"
                type="password"
                name="confirm"
                [ngModel]="confirm()"
                (ngModelChange)="confirm.set($event)"
                [disabled]="busy()"
                autocomplete="new-password"
                aria-label="确认登录密码"
            /></label>
          </div>
          @if (password() && !strong()) {
            <p class="mt-2 text-sm text-red-500" role="alert">
              密码至少 8 位，且必须包含字母和数字。
            </p>
          }
          @if (confirm() && password() !== confirm()) {
            <p class="mt-2 text-sm text-red-500" role="alert">
              两次密码不一致。
            </p>
          }
          <p class="fuwari-muted mt-2 text-xs">
            为了安全性，建议使用 12 位以上的独有密码。
          </p>
          <p class="fuwari-muted mt-3 text-xs leading-relaxed">
            此操作会将加密后的 Token
            提交到您的仓库。请妥善保管密码；弱密码可能被离线猜解。移除密码不会撤销历史密文中的
            Token，需要撤销访问时请轮换 Token。
          </p>
          <div class="mt-4 flex flex-wrap gap-3">
            <button
              class="fuwari-btn solid"
              type="submit"
              [disabled]="
                busy() ||
                checking() ||
                status() === 'unknown' ||
                !strong() ||
                password() !== confirm()
              "
            >
              {{
                busy()
                  ? '处理中…'
                  : status() === 'unset'
                    ? '设置密码'
                    : '修改密码'
              }}
            </button>
            @if (status() === 'set' || status() === 'invalid') {
              <button
                class="fuwari-btn danger"
                type="button"
                (click)="removeOpen.set(true)"
                [disabled]="busy() || checking()"
              >
                移除密码
              </button>
            }
          </div>
        </form>
        @if (removeOpen()) {
          <div
            class="mt-4 rounded-xl border border-[var(--fuwari-border)] p-3 text-sm"
            role="group"
            aria-label="移除登录密码确认"
          >
            <p>移除后恢复 Token 登录。Git 历史和旧部署中的密文仍可能存在。</p>
            <div class="mt-3 flex gap-2">
              <button
                class="fuwari-btn danger !text-xs"
                (click)="remove()"
                [disabled]="busy()"
              >
                确认移除</button
              ><button
                class="fuwari-btn !text-xs"
                (click)="removeOpen.set(false)"
                [disabled]="busy()"
              >
                取消
              </button>
            </div>
          </div>
        }
      }
    </section>
  `,
})
export class LoginPasswordComponent implements OnDestroy {
  readonly demo = inject(LocalDemoService)
  private auth = inject(AuthService)
  private toast = inject(ToastService)
  readonly status = signal<'unknown' | 'unset' | 'set' | 'invalid'>('unknown')
  readonly checking = signal(false)
  readonly busy = signal(false)
  readonly error = signal('')
  readonly password = signal('')
  readonly confirm = signal('')
  readonly strong = computed(() => validLoginPassword(this.password()))
  readonly removeOpen = signal(false)
  readonly statusText = computed(() =>
    this.checking()
      ? '读取状态中…'
      : {
          unknown: '状态未读取',
          unset: '尚未设置登录密码',
          set: '已设置登录密码',
          invalid: '登录配置异常',
        }[this.status()],
  )
  private alive = true
  constructor() {
    if (!this.demo.active()) void this.refresh()
  }
  async refresh(clearError = true) {
    if (this.busy() || this.checking() || !this.alive) return
    this.checking.set(true)
    if (clearError) this.error.set('')
    try {
      const state = await this.auth.loadManagement()
      if (this.alive) this.status.set(state)
    } catch {
      if (this.alive) {
        this.status.set('unknown')
        this.error.set('无法读取仓库登录配置，请刷新状态后重试')
      }
    } finally {
      if (this.alive) this.checking.set(false)
    }
  }
  async save(event: Event) {
    event.preventDefault()
    if (
      this.busy() ||
      this.checking() ||
      this.status() === 'unknown' ||
      !this.strong() ||
      this.password() !== this.confirm()
    )
      return
    this.busy.set(true)
    this.error.set('')
    try {
      await this.auth.setPassword(this.password(), this.confirm())
      if (!this.alive) return
      this.password.set('')
      this.confirm.set('')
      this.status.set('set')
      this.toast.success(AUTH_DEPLOY_MESSAGE)
    } catch (e: any) {
      if (this.alive) this.error.set(e.message)
    } finally {
      if (this.alive) {
        this.busy.set(false)
        await this.refresh(false)
      }
    }
  }
  async remove() {
    if (this.busy() || !this.removeOpen()) return
    this.busy.set(true)
    this.error.set('')
    try {
      await this.auth.removePassword()
      if (!this.alive) return
      this.removeOpen.set(false)
      this.password.set('')
      this.confirm.set('')
      this.status.set('unset')
      this.toast.success(AUTH_DEPLOY_MESSAGE)
    } catch (e: any) {
      if (this.alive) this.error.set(e.message)
    } finally {
      if (this.alive) {
        this.busy.set(false)
        await this.refresh(false)
      }
    }
  }
  ngOnDestroy() {
    this.alive = false
    this.password.set('')
    this.confirm.set('')
  }
}
