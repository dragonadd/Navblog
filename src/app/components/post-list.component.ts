import { Component, inject, input } from '@angular/core'
import { RouterLink } from '@angular/router'
import type { PostMeta } from '../../shared/types'
import { BlogService, formatDate } from '../services/blog.service'

@Component({
  selector: 'app-post-list',
  imports: [RouterLink],
  template: `
    <div class="flex flex-col gap-4">
      @for (p of posts(); track p.slug) {
        <article
          class="fuwari-card fuwari-card-hover fuwari-post-card"
          [class.has-cover]="showCover() && !!p.cover"
          style="animation: fuwari-enter .28s ease both"
        >
          <div class="flex min-w-0 flex-col justify-center gap-2.5 py-1 md:pl-2">
            <a [routerLink]="['/posts', p.slug]" class="fuwari-post-title text-2xl md:text-[1.75rem]">
              @if (p.pinned) {
                <span class="mr-1 align-middle text-sm text-[var(--fuwari-primary)]" title="置顶"><i class="fas fa-thumbtack"></i></span>
              }
              {{ p.title }}
            </a>
            <div class="fuwari-meta">
              <span class="fuwari-meta-item">
                <span class="fuwari-meta-icon"><i class="far fa-calendar-alt"></i></span>{{ date(p.date) }}
              </span>
              @if (p.category) {
                <a [routerLink]="['/categories', p.category]" class="fuwari-meta-item hover:text-[var(--fuwari-primary)]">
                  <span class="fuwari-meta-icon"><i class="far fa-bookmark"></i></span>{{ p.category }}
                </a>
              }
              @if (p.tags.length) {
                <span class="fuwari-meta-item">
                  <span class="fuwari-meta-icon"><i class="fas fa-hashtag"></i></span>
                  @for (t of p.tags; track t; let last = $last) {
                    <a [routerLink]="['/tags', t]" class="hover:text-[var(--fuwari-primary)]">{{ t }}</a>
                    @if (!last) { <span class="opacity-50">/</span> }
                  }
                </span>
              }
            </div>
            @if (p.summary) {
              <p class="fuwari-muted line-clamp-2 text-sm leading-7">{{ p.summary }}</p>
            }
            <div class="fuwari-muted text-xs">
              {{ p.words || 0 }} 字 · 约 {{ readMinutes(p.words) }} 分钟
            </div>
          </div>
          @if (showCover() && p.cover) {
            <a [routerLink]="['/posts', p.slug]" class="fuwari-post-cover">
              <img [src]="blog.url(p.cover)" [alt]="p.title" loading="lazy" />
            </a>
          } @else {
            <a [routerLink]="['/posts', p.slug]" class="fuwari-readmore" aria-label="阅读全文">
              <i class="fas fa-chevron-right"></i>
            </a>
          }
        </article>
      } @empty {
        <div class="fuwari-card fuwari-muted p-10 text-center">
          <i class="far fa-folder-open mb-2 text-3xl"></i>
          <div>暂无文章</div>
        </div>
      }
    </div>
  `,
})
export class PostListComponent {
  readonly blog = inject(BlogService)
  readonly posts = input.required<PostMeta[]>()
  readonly showCover = input(true)
  date = formatDate
  readMinutes(words = 0) {
    return Math.max(1, Math.round(words / 400))
  }
}
