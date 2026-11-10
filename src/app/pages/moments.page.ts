import { Component, inject, signal } from '@angular/core'
import type { Moment } from '../../shared/types'
import { formatMomentDate } from '../../shared/moments'
import { BlogService } from '../services/blog.service'

@Component({
  selector: 'app-moments-page',
  template: `
    <header class="fuwari-card mb-4 p-5 md:p-6">
      <h1 class="text-3xl font-bold">碎碎念</h1>
      <p class="fuwari-muted mt-2 text-sm">
        记录此刻，留给未来。<span class="ml-2"
          >{{ items().length }} 条动态</span
        >
      </p>
    </header>
    @if (error()) {
      <div class="fuwari-card p-5" role="alert">
        <p class="text-sm text-red-500">{{ error() }}</p>
        <button class="fuwari-btn mt-3" (click)="load()">重试</button>
      </div>
    } @else {
      <ol class="moments-timeline">
        @for (item of items(); track item.id) {
          <li class="moment-item" [id]="'moment-' + item.id">
            <img
              [src]="blog.url(blog.settings().avatar)"
              [alt]="blog.settings().author"
              class="moment-avatar"
              loading="lazy"
            />
            <article class="fuwari-card min-w-0 p-4 md:p-5">
              <header
                class="mb-3 flex flex-wrap items-baseline justify-between gap-2"
              >
                <span class="text-sm font-semibold">{{
                  blog.settings().author
                }}</span>
                <a class="fuwari-muted text-xs" [href]="'#moment-' + item.id"
                  ><time [attr.datetime]="item.date">{{
                    date(item.date)
                  }}</time></a
                >
              </header>
              <p class="whitespace-pre-line break-words text-sm leading-7">
                {{ item.text }}
              </p>
              @if (item.updated) {
                <p class="fuwari-muted mt-3 text-xs">
                  编辑于 {{ date(item.updated) }}
                </p>
              }
            </article>
          </li>
        } @empty {
          <li class="fuwari-card fuwari-muted p-10 text-center text-sm">
            还没有碎碎念。
          </li>
        }
      </ol>
    }
  `,
})
export class MomentsPage {
  readonly blog = inject(BlogService)
  readonly items = signal<Moment[]>([])
  readonly error = signal('')
  readonly date = formatMomentDate
  constructor() {
    this.blog.setTitle('碎碎念')
    this.load()
  }
  load() {
    this.error.set('')
    try {
      this.items.set(this.blog.getMoments())
    } catch (e: any) {
      this.error.set('动态读取失败：' + e.message)
    }
  }
}
