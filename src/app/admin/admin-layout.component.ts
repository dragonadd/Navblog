import { Component, inject, signal } from '@angular/core'
import {
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router'
import { GitService } from '../services/git.service'
import { BlogService } from '../services/blog.service'
import { LocalDemoService } from '../services/local-demo.service'

@Component({
  selector: 'app-admin-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div
      class="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[220px_minmax(0,1fr)]"
    >
      <aside class="fuwari-card h-fit p-3 lg:sticky lg:top-[76px]">
        <div class="flex items-center gap-3 px-2 py-2">
          @if (!demo.active() && git.user()?.avatar) {
            <img [src]="git.user()!.avatar" class="h-9 w-9 rounded-xl" alt="" />
          } @else {
            <div
              class="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--fuwari-primary-soft)] text-[var(--fuwari-primary)]"
            >
              <i class="fas fa-user"></i>
            </div>
          }
          <div class="min-w-0">
            <div class="truncate text-sm font-bold">
              {{ demo.active() ? '本地演示' : git.user()?.name || '管理员' }}
            </div>
            <div class="fuwari-muted text-xs">
              {{
                demo.active()
                  ? '浏览器本地数据'
                  : git.providerName + ' · ' + git.repo.branch
              }}
            </div>
          </div>
        </div>
        <nav class="mt-2 flex flex-row flex-wrap gap-1 lg:flex-col">
          @for (m of menus; track m.url) {
            <a
              class="fuwari-menu-item !text-sm"
              [routerLink]="m.url"
              routerLinkActive="active"
              [routerLinkActiveOptions]="{ exact: true }"
            >
              <i [class]="m.icon + ' w-4'"></i>{{ m.name }}
            </a>
          }
          <a class="fuwari-menu-item !text-sm" routerLink="/"
            ><i class="fas fa-home w-4"></i>查看博客</a
          >
          @if (demo.active()) {
            <button
              type="button"
              class="fuwari-menu-item !text-sm"
              (click)="exported.set(demo.exportFiles())"
            >
              导出演示数据
            </button>
          }
          <button
            class="fuwari-menu-item cursor-pointer border-0 bg-transparent !text-sm"
            (click)="logout()"
          >
            <i class="fas fa-sign-out-alt w-4"></i
            >{{ demo.active() ? '退出演示' : '退出登录' }}
          </button>
        </nav>
        @if (git.busy()) {
          <div class="fuwari-muted mt-3 px-2 text-xs">
            <i class="fas fa-sync fa-spin mr-1"></i>正在与仓库同步…
          </div>
        }
      </aside>
      <section class="min-w-0">
        @if (demo.active()) {
          <div class="fuwari-card mb-4 flex gap-3 p-4 text-sm" role="status">
            <i class="fas fa-laptop fuwari-primary mt-1" aria-hidden="true"></i>
            <div>
              <strong>本地演示模式</strong>
              <p class="fuwari-muted mt-1 text-xs">
                修改仅保存在当前浏览器，不写入项目文件或 Git
                仓库。保存后点击“查看博客”预览；退出演示恢复原始内容。
              </p>
            </div>
          </div>
        }
        <router-outlet />
        @if (exported()) {
          <section class="fuwari-card mt-4 p-4">
            <p class="mb-2 text-sm">
              已保存的本地演示文件，可复制备份或同步到项目。
            </p>
            <textarea
              aria-label="本地演示数据 JSON"
              class="fuwari-input font-mono"
              rows="12"
              readonly
              [value]="exported()"
            ></textarea>
          </section>
        }
      </section>
    </div>
  `,
})
export class AdminLayout {
  readonly demo = inject(LocalDemoService)
  readonly exported = signal('')
  readonly git = inject(GitService)
  private blog = inject(BlogService)
  private router = inject(Router)
  readonly menus = [
    { name: '文章管理', url: '/admin', icon: 'fas fa-list' },
    { name: '写文章', url: '/admin/new', icon: 'fas fa-pen' },
    { name: '碎碎念管理', url: '/admin/moments', icon: 'far fa-comment-dots' },
    { name: '关于页面', url: '/admin/about', icon: 'far fa-id-card' },
    { name: '站点设置', url: '/admin/settings', icon: 'fas fa-cog' },
  ]
  constructor() {
    this.git.fetchUser()
  }
  logout() {
    if (this.demo.active()) {
      this.demo.exit()
      this.blog.refreshDemo()
      this.router.navigateByUrl('/')
      return
    }
    this.git.logout()
    this.router.navigateByUrl('/admin/login')
  }
}
