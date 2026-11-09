import { Component, OnDestroy, computed, effect, inject, input, signal } from '@angular/core'
import { RouterLink } from '@angular/router'
import { DomSanitizer, SafeHtml } from '@angular/platform-browser'
import { BlogService, formatDate } from '../services/blog.service'
import { ToastService } from '../services/toast.service'
import { parseFrontMatter } from '../../shared/frontmatter'
import { renderMarkdown } from '../../shared/markdown'
import { GiscusComponent } from '../components/giscus.component'

@Component({
  selector: 'app-post-page',
  imports: [RouterLink, GiscusComponent],
  template: `
    @if (meta(); as m) {
      <article class="fuwari-card p-5 md:p-8">
        <header class="mb-6">
          <h1 class="text-3xl leading-tight font-bold lg:text-4xl">{{ m.title }}</h1>
          <div class="fuwari-meta mt-4">
            <span class="fuwari-meta-item"><span class="fuwari-meta-icon"><i class="far fa-calendar-alt"></i></span>{{ date(m.date) }}</span>
            @if (m.updated) {
              <span class="fuwari-meta-item"><span class="fuwari-meta-icon"><i class="fas fa-pen"></i></span>更新于 {{ date(m.updated) }}</span>
            }
            @if (m.category) {
              <a [routerLink]="['/categories', m.category]" class="fuwari-meta-item hover:text-[var(--fuwari-primary)]">
                <span class="fuwari-meta-icon"><i class="far fa-bookmark"></i></span>{{ m.category }}
              </a>
            }
            <span class="fuwari-meta-item"><span class="fuwari-meta-icon"><i class="far fa-file-alt"></i></span>{{ m.words || 0 }} 字</span>
            <span class="fuwari-meta-item"><span class="fuwari-meta-icon"><i class="far fa-clock"></i></span>约 {{ minutes() }} 分钟</span>
          </div>
          @if (m.tags.length) {
            <div class="mt-3 flex flex-wrap gap-2">
              @for (t of m.tags; track t) {
                <a [routerLink]="['/tags', t]" class="fuwari-chip">#{{ t }}</a>
              }
            </div>
          }
          @if (m.cover) {
            <img [src]="blog.url(m.cover)" [alt]="m.title" class="mt-5 max-h-[420px] w-full rounded-2xl object-cover" />
          }
        </header>

        @if (loading()) {
          <div class="fuwari-muted py-16 text-center"><i class="fas fa-spinner fa-spin mr-2"></i>加载中…</div>
        } @else if (error()) {
          <div class="py-16 text-center text-red-500">文章加载失败：{{ error() }}</div>
        } @else {
          <div class="prose-blog" [innerHTML]="html()"></div>
        }

        <div class="mt-8 rounded-2xl border border-[var(--fuwari-border)] bg-[var(--fuwari-bg-soft)] p-4 text-sm">
          <div class="flex flex-col gap-1.5">
            <div><span class="fuwari-muted">文章作者：</span><a routerLink="/about" class="fuwari-link">{{ blog.settings().author }}</a></div>
            <div class="break-all"><span class="fuwari-muted">文章链接：</span><a [href]="pageUrl()" class="fuwari-link">{{ pageUrl() }}</a></div>
            @if (blog.settings().license) {
              <div>
                <span class="fuwari-muted">版权声明：</span>本文采用
                <a [href]="blog.settings().licenseUrl" target="_blank" rel="noopener" class="fuwari-link">{{ blog.settings().license }}</a>
                许可协议，转载请注明出处。
              </div>
            }
          </div>
          <button class="fuwari-btn mt-3 !px-3 !py-1.5 !text-xs" (click)="copyUrl()"><i class="far fa-copy"></i>复制链接</button>
        </div>
      </article>

      <div class="mt-4 grid gap-4 sm:grid-cols-2">
        @if (prev(); as p) {
          <a [routerLink]="['/posts', p.slug]" class="fuwari-card fuwari-card-hover block p-4">
            <div class="fuwari-muted text-xs tracking-wide uppercase"><i class="fas fa-chevron-left mr-1"></i>上一篇</div>
            <div class="mt-1 line-clamp-1 font-semibold">{{ p.title }}</div>
          </a>
        } @else { <div class="hidden sm:block"></div> }
        @if (next(); as n) {
          <a [routerLink]="['/posts', n.slug]" class="fuwari-card fuwari-card-hover block p-4 text-right">
            <div class="fuwari-muted text-xs tracking-wide uppercase">下一篇<i class="fas fa-chevron-right ml-1"></i></div>
            <div class="mt-1 line-clamp-1 font-semibold">{{ n.title }}</div>
          </a>
        }
      </div>

      @if (commentsEnabled()) {
        <section id="comments" class="fuwari-card mt-4 p-5 md:p-6">
          <div class="fuwari-section-title mb-4"><i class="far fa-comments"></i>评论</div>
          <app-giscus />
        </section>
      }
    } @else {
      <div class="fuwari-card p-10 text-center">
        <div class="text-5xl font-bold text-[var(--fuwari-primary)]">404</div>
        <p class="fuwari-muted mt-3">文章不存在或已被删除</p>
        <a routerLink="/" class="fuwari-btn mt-5">返回首页</a>
      </div>
    }
  `,
})
export class PostPage implements OnDestroy {
  readonly blog = inject(BlogService)
  private toast = inject(ToastService)
  private sanitizer = inject(DomSanitizer)
  readonly slug = input<string>('')
  readonly meta = computed(() => this.blog.findPost(this.slug()))
  readonly html = signal<SafeHtml>('')
  readonly loading = signal(true)
  readonly error = signal('')
  readonly date = formatDate
  readonly minutes = computed(() => Math.max(1, Math.round((this.meta()?.words || 0) / 400)))
  readonly index = computed(() => this.blog.posts().findIndex((p) => p.slug === this.slug()))
  readonly prev = computed(() => this.blog.posts()[this.index() + 1])
  readonly next = computed(() => (this.index() > 0 ? this.blog.posts()[this.index() - 1] : undefined))
  readonly pageUrl = computed(() => {
    const site = this.blog.config.siteUrl
    const path = `posts/${encodeURIComponent(this.slug())}/`
    return site ? `${site}${this.blog.config.baseHref}${path}` : this.blog.url(path)
  })
  readonly commentsEnabled = computed(
    () => !!this.blog.settings().giscus?.enable && this.meta()?.comments !== false,
  )

  constructor() {
    effect(() => {
      const slug = this.slug()
      const m = this.meta()
      this.blog.setTitle(m?.title || '文章不存在')
      if (m) this.load(slug)
    })
  }

  private async load(slug: string) {
    this.loading.set(true)
    this.error.set('')
    try {
      const src = await this.blog.getPostSource(slug)
      if (slug !== this.slug()) return
      const { html, toc } = renderMarkdown(parseFrontMatter(src).body)
      this.html.set(this.sanitizer.bypassSecurityTrustHtml(html))
      this.blog.toc.set(toc)
      if (location.hash) {
        setTimeout(() => document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView())
      }
    } catch (e: any) {
      this.error.set(e?.message || String(e))
    } finally {
      this.loading.set(false)
    }
  }

  copyUrl() {
    navigator.clipboard?.writeText(this.pageUrl()).then(() => this.toast.success('链接已复制'))
  }

  ngOnDestroy() {
    this.blog.toc.set([])
  }
}
