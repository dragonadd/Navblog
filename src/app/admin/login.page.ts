import { Component, inject, signal } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { Router, RouterLink } from '@angular/router'
import { GitService } from '../services/git.service'
import { ToastService } from '../services/toast.service'
import { BlogService } from '../services/blog.service'

@Component({
  selector: 'app-login-page',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="flex min-h-[70vh] items-center justify-center">
      <div class="fuwari-card w-full max-w-md p-8">
        <div class="text-center">
          <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--fuwari-primary-soft)] text-2xl text-[var(--fuwari-primary)]">
            <i class="fas fa-pen-nib"></i>
          </div>
          <h1 class="mt-4 text-2xl font-bold">管理后台</h1>
          <p class="fuwari-muted mt-1 text-sm">使用 {{ git.providerName }} Token 登录</p>
        </div>
        <form class="mt-6 flex flex-col gap-4" (submit)="submit($event)">
          <div>
            <label class="fuwari-label">仓库</label>
            <div class="fuwari-input !bg-transparent text-sm break-all">{{ blog.config.gitRepoUrl || '未配置 blog.config.yaml → gitRepoUrl' }}</div>
          </div>
          <div>
            <label class="fuwari-label">Access Token</label>
            <input class="fuwari-input" type="password" name="token" [(ngModel)]="token" placeholder="粘贴具有仓库写权限的 Token" autocomplete="off" />
            <a class="fuwari-link mt-1.5 inline-block text-xs" [href]="git.tokenHelpUrl" target="_blank" rel="noopener">
              <i class="fas fa-external-link-alt mr-1"></i>如何获取 Token？（需要 repo 权限）
            </a>
          </div>
          <button class="fuwari-btn solid !py-2.5" type="submit" [disabled]="loading() || !token.trim()">
            @if (loading()) { <i class="fas fa-spinner fa-spin"></i> } 登录
          </button>
          <p class="fuwari-muted text-center text-xs">Token 仅保存在当前浏览器的 localStorage 中，直接与 Git 平台 API 通信。</p>
          <a routerLink="/" class="fuwari-link text-center text-sm"><i class="fas fa-arrow-left mr-1"></i>返回博客</a>
        </form>
      </div>
    </div>
  `,
})
export class LoginPage {
  readonly git = inject(GitService)
  readonly blog = inject(BlogService)
  private toast = inject(ToastService)
  private router = inject(Router)
  token = ''
  readonly loading = signal(false)

  constructor() {
    this.blog.setTitle('登录')
    if (this.git.isLogin()) this.router.navigateByUrl('/admin')
  }

  async submit(e: Event) {
    e.preventDefault()
    this.loading.set(true)
    try {
      await this.git.login(this.token)
      this.toast.success('登录成功')
      this.router.navigateByUrl('/admin')
    } catch (err: any) {
      this.toast.error('登录失败：' + (err?.message || err))
    } finally {
      this.loading.set(false)
    }
  }
}
