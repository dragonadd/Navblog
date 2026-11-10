import { Component, computed, inject, signal } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { RouterLink } from '@angular/router'
import { AdminStore } from './admin-store.service'
import { BlogService, formatDate } from '../services/blog.service'
import { ToastService } from '../services/toast.service'
import { LocalDemoService } from '../services/local-demo.service'

@Component({
  selector: 'app-admin-posts-page',
  imports: [RouterLink, FormsModule],
  template: `
    <div class="fuwari-card p-5">
      <div class="flex flex-wrap items-center gap-3">
        <h1 class="fuwari-section-title !text-lg">
          文章管理
          <span class="fuwari-muted text-sm font-normal"
            >共 {{ store.posts().length }} 篇</span
          >
        </h1>
        <div class="ml-auto flex gap-2">
          <input
            class="fuwari-input !w-56"
            placeholder="筛选标题/分类/标签"
            [ngModel]="kw()"
            (ngModelChange)="kw.set($event)"
          />
          <button
            class="fuwari-btn"
            [title]="demo.active() ? '刷新本地演示' : '从仓库刷新'"
            (click)="refresh()"
          >
            <i class="fas fa-sync" [class.fa-spin]="loading()"></i>
          </button>
          <a class="fuwari-btn solid shrink-0" routerLink="/admin/new"
            ><i class="fas fa-plus"></i>写文章</a
          >
        </div>
      </div>
      <div class="mt-4 overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr
              class="fuwari-muted border-b border-[var(--fuwari-border)] text-left text-xs"
            >
              <th class="px-2 py-2 font-semibold">标题</th>
              <th class="px-2 py-2 font-semibold">分类</th>
              <th class="hidden px-2 py-2 font-semibold md:table-cell">标签</th>
              <th class="px-2 py-2 font-semibold">日期</th>
              <th class="px-2 py-2 text-right font-semibold">操作</th>
            </tr>
          </thead>
          <tbody>
            @for (p of list(); track p.slug) {
              <tr
                class="border-b border-dashed border-[var(--fuwari-border)] last:border-0"
              >
                <td class="px-2 py-2.5">
                  <a
                    [routerLink]="['/admin/edit', p.slug]"
                    class="font-medium hover:text-[var(--fuwari-primary)]"
                    >{{ p.title }}</a
                  >
                  @if (p.pinned) {
                    <span class="fuwari-chip ml-2 !px-2 !py-0 text-xs"
                      >置顶</span
                    >
                  }
                  @if (p.encrypted) {
                    <span class="fuwari-chip ml-2 !px-2 !py-0 text-xs"
                      >加密</span
                    >
                  }
                  @if (p.draft) {
                    <span
                      class="ml-2 rounded-full bg-orange-500/15 px-2 text-xs text-orange-500"
                      >草稿</span
                    >
                  }
                  <div class="fuwari-muted text-xs">/{{ p.slug }}</div>
                </td>
                <td class="px-2 py-2.5">{{ p.category || '-' }}</td>
                <td
                  class="fuwari-muted hidden px-2 py-2.5 text-xs md:table-cell"
                >
                  {{ p.tags.join(', ') }}
                </td>
                <td class="fuwari-muted px-2 py-2.5 whitespace-nowrap">
                  {{ date(p.date) }}
                </td>
                <td class="px-2 py-2.5 text-right whitespace-nowrap">
                  @if (!p.draft) {
                    <a
                      class="fuwari-tool-btn"
                      [routerLink]="['/posts', p.slug]"
                      title="查看"
                      ><i class="far fa-eye"></i
                    ></a>
                  }
                  <a
                    class="fuwari-tool-btn"
                    [routerLink]="['/admin/edit', p.slug]"
                    title="编辑"
                    ><i class="fas fa-pen"></i
                  ></a>
                  <button
                    class="fuwari-tool-btn hover:!text-red-500"
                    title="删除"
                    (click)="remove(p.slug, p.title)"
                  >
                    <i class="far fa-trash-alt"></i>
                  </button>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="5" class="fuwari-muted py-10 text-center">
                  暂无文章
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      <p class="fuwari-muted mt-4 text-xs">
        <i class="fas fa-info-circle mr-1"></i
        >{{
          demo.active()
            ? '本地演示：保存后可在本地博客预览，退出演示恢复原始内容。'
            : '保存后内容会提交到仓库，托管平台重新构建完成后（通常 1~3 分钟）前台才会更新。'
        }}
      </p>
    </div>
  `,
})
export class AdminPostsPage {
  readonly demo = inject(LocalDemoService)
  readonly store = inject(AdminStore)
  private toast = inject(ToastService)
  readonly date = formatDate
  readonly kw = signal('')
  readonly loading = signal(false)
  readonly list = computed(() => {
    const k = this.kw().trim().toLowerCase()
    return this.store
      .posts()
      .filter(
        (p) =>
          !k ||
          [p.title, p.slug, p.category, ...p.tags]
            .join(' ')
            .toLowerCase()
            .includes(k),
      )
  })

  constructor() {
    inject(BlogService).setTitle('文章管理')
    this.refresh()
  }

  async refresh() {
    this.loading.set(true)
    try {
      await this.store.loadIndex()
    } catch (e: any) {
      this.toast.error('读取仓库失败：' + e.message)
    } finally {
      this.loading.set(false)
    }
  }

  async remove(slug: string, title: string) {
    if (
      !confirm(
        `确定删除文章「${title}」吗？${this.demo.active() ? '只影响本地演示，退出演示恢复原始内容。' : '此操作会提交到仓库。'}`,
      )
    )
      return
    try {
      await this.store.deletePost(slug)
      this.toast.success('已删除')
    } catch (e: any) {
      this.toast.error('删除失败：' + e.message)
    }
  }
}
