import { Component, inject } from '@angular/core'
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router'
import { GitService } from '../services/git.service'

@Component({
  selector: 'app-admin-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside class="fuwari-card h-fit p-3 lg:sticky lg:top-[76px]">
        <div class="flex items-center gap-3 px-2 py-2">
          @if (git.user()?.avatar) {
            <img [src]="git.user()!.avatar" class="h-9 w-9 rounded-xl" alt="" />
          } @else {
            <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--fuwari-primary-soft)] text-[var(--fuwari-primary)]"><i class="fas fa-user"></i></div>
          }
          <div class="min-w-0">
            <div class="truncate text-sm font-bold">{{ git.user()?.name || '管理员' }}</div>
            <div class="fuwari-muted text-xs">{{ git.providerName }} · {{ git.repo.branch }}</div>
          </div>
        </div>
        <nav class="mt-2 flex flex-row flex-wrap gap-1 lg:flex-col">
          @for (m of menus; track m.url) {
            <a class="fuwari-menu-item !text-sm" [routerLink]="m.url" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">
              <i [class]="m.icon + ' w-4'"></i>{{ m.name }}
            </a>
          }
          <a class="fuwari-menu-item !text-sm" routerLink="/"><i class="fas fa-home w-4"></i>查看博客</a>
          <button class="fuwari-menu-item cursor-pointer border-0 bg-transparent !text-sm" (click)="logout()">
            <i class="fas fa-sign-out-alt w-4"></i>退出登录
          </button>
        </nav>
        @if (git.busy()) {
          <div class="fuwari-muted mt-3 px-2 text-xs"><i class="fas fa-sync fa-spin mr-1"></i>正在与仓库同步…</div>
        }
      </aside>
      <section class="min-w-0">
        <router-outlet />
      </section>
    </div>
  `,
})
export class AdminLayout {
  readonly git = inject(GitService)
  private router = inject(Router)
  readonly menus = [
    { name: '文章管理', url: '/admin', icon: 'fas fa-list' },
    { name: '写文章', url: '/admin/new', icon: 'fas fa-pen' },
    { name: '关于页面', url: '/admin/about', icon: 'far fa-id-card' },
    { name: '站点设置', url: '/admin/settings', icon: 'fas fa-cog' },
  ]
  constructor() {
    this.git.fetchUser()
  }
  logout() {
    this.git.logout()
    this.router.navigateByUrl('/admin/login')
  }
}
