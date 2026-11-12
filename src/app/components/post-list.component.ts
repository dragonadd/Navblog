import { Component, inject, input, signal } from '@angular/core'
import { RouterLink } from '@angular/router'
import { HighlightComponent } from './highlight.component'
import type { PostMeta } from '../../shared/types'
import { BlogService, formatDate } from '../services/blog.service'

@Component({
  selector: 'app-post-list',
  imports: [RouterLink, HighlightComponent],
  template: `
    <div class="flex flex-col gap-4">
      @for (p of posts(); track p.slug) {
        <article
          class="fuwari-card fuwari-card-hover fuwari-post-card"
          [class.has-cover]="showCover() && !!cover(p) && !failed(p)"
          [style.--cover-width]="(blog.settings().coverWidth || 280) + 'px'"
          [class.no-cover-hover]="blog.settings().coverHover === false"
          style="animation: fuwari-enter .28s ease both"
        >
          <div
            class="flex min-w-0 flex-col justify-center gap-2.5 py-1 md:pl-2"
          >
            <a
              [routerLink]="['/posts', p.slug]"
              class="fuwari-post-title text-2xl md:text-[1.75rem]"
            >
              @if (p.pinned) {
                <span
                  class="mr-1 align-middle text-sm text-[var(--fuwari-primary)]"
                  title="置顶"
                  ><i class="fas fa-thumbtack"></i
                ></span>
              }
              <app-highlight [text]="p.title" [query]="query()" />
            </a>
            <div class="fuwari-meta">
              <a
                class="fuwari-meta-item"
                routerLink="/archive"
                [fragment]="archiveAnchor(p.date)"
                ><span class="fuwari-meta-icon"
                  ><i class="far fa-calendar-alt"></i></span
                >{{ date(p.date) }}</a
              >
              @if (p.category && (!p.encrypted || !query().trim())) {
                <a
                  [routerLink]="['/categories', p.category]"
                  class="fuwari-meta-item hover:text-[var(--fuwari-primary)]"
                >
                  <span class="fuwari-meta-icon"
                    ><i class="far fa-bookmark"></i></span
                  >{{ p.category }}
                </a>
              }
              @if (
                blog.settings().showListTags !== false &&
                p.tags.length &&
                (!p.encrypted || !query().trim())
              ) {
                <span class="fuwari-meta-item">
                  <span class="fuwari-meta-icon"
                    ><i class="fas fa-hashtag"></i
                  ></span>
                  @for (t of p.tags; track t; let last = $last) {
                    <a
                      [routerLink]="['/tags', t]"
                      class="hover:text-[var(--fuwari-primary)]"
                      >{{ t }}</a
                    >
                    @if (!last) {
                      <span class="opacity-50">/</span>
                    }
                  }
                </span>
              }
            </div>
            @if (
              blog.settings().showSummary !== false &&
              p.summary &&
              (!p.encrypted || !query().trim())
            ) {
              <p class="fuwari-muted line-clamp-2 text-sm leading-7">
                <app-highlight [text]="p.summary || ''" [query]="query()" />
              </p>
            }
            <div class="fuwari-muted text-xs">
              @if (p.encrypted) {
                <i class="fas fa-lock mr-1" aria-hidden="true"></i>加密文章
              } @else {
                {{ p.words || 0 }} 字 · 约 {{ readMinutes(p.words) }} 分钟
              }
            </div>
          </div>
          @if (showCover() && cover(p) && !failed(p)) {
            <a [routerLink]="['/posts', p.slug]" class="fuwari-post-cover">
              <img
                [src]="blog.url(cover(p))"
                (error)="failCover(p)"
                [alt]="p.title"
                loading="lazy"
              />
            </a>
          } @else {
            <a
              [routerLink]="['/posts', p.slug]"
              class="fuwari-readmore"
              aria-label="阅读全文"
            >
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
  readonly query = input('')
  archiveAnchor(date: string) {
    return /^\d{4}-\d{2}/.test(date)
      ? 'archive-' + date.slice(0, 7)
      : 'archive-unknown'
  }
  readonly failedImages = signal<Record<string, string>>({})
  cover(p: PostMeta) {
    return (
      p.cover ||
      (this.blog.settings().coverDefault ? this.blog.settings().heroImage : '')
    )
  }
  failed(p: PostMeta) {
    return this.failedImages()[p.slug] === this.cover(p)
  }
  failCover(p: PostMeta) {
    this.failedImages.update((v) => ({ ...v, [p.slug]: this.cover(p) }))
  }
  date = formatDate
  readMinutes(words = 0) {
    return Math.max(1, Math.round(words / 400))
  }
}
