import {
  Component,
  OnDestroy,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core'
import { RouterLink } from '@angular/router'
import { FormsModule } from '@angular/forms'
import { DomSanitizer, SafeHtml } from '@angular/platform-browser'
import { BlogService, formatDate } from '../services/blog.service'
import { ToastService } from '../services/toast.service'
import { normalizeMeta, parseFrontMatter } from '../../shared/frontmatter'
import { decryptPostBody } from '../../shared/post-crypto'
import { renderMarkdown } from '../../shared/markdown'
import { GiscusComponent } from '../components/giscus.component'

@Component({
  selector: 'app-post-page',
  imports: [RouterLink, GiscusComponent, FormsModule],
  template: `
    @if (meta(); as m) {
      <article class="fuwari-card overflow-hidden p-5 md:p-8">
        @if (
          m.cover &&
          blog.settings().articleCover !== false &&
          blog.settings().articleCoverTop
        ) {
          <img
            [src]="blog.url(m.cover)"
            [alt]="m.title"
            class="mb-6 h-[200px] w-full object-cover sm:h-[240px] md:h-[260px]"
          />
        }
        <header class="mb-6">
          <h1 class="text-3xl leading-tight font-bold lg:text-4xl">
            {{ m.title }}
          </h1>
          @if (blog.settings().articleMeta !== false) {
            <div class="fuwari-meta mt-4">
              <span class="fuwari-meta-item"
                ><span class="fuwari-meta-icon"
                  ><i class="far fa-calendar-alt"></i></span
                >{{ date(m.date) }}</span
              >
              @if (m.updated) {
                <span class="fuwari-meta-item"
                  ><span class="fuwari-meta-icon"
                    ><i class="fas fa-pen"></i></span
                  >更新于 {{ date(m.updated) }}</span
                >
              }
              @if (m.category) {
                <a
                  [routerLink]="['/categories', m.category]"
                  class="fuwari-meta-item hover:text-[var(--fuwari-primary)]"
                >
                  <span class="fuwari-meta-icon"
                    ><i class="far fa-bookmark"></i></span
                  >{{ m.category }}
                </a>
              }
              @if (!m.encrypted) {
                <span class="fuwari-meta-item"
                  ><span class="fuwari-meta-icon"
                    ><i class="far fa-file-alt"></i></span
                  >{{ m.words || 0 }} 字</span
                >
              } @else {
                <span class="fuwari-meta-item"
                  ><i class="fas fa-lock"></i>加密文章</span
                >
              }
              @if (!m.encrypted) {
                <span class="fuwari-meta-item"
                  ><span class="fuwari-meta-icon"
                    ><i class="far fa-clock"></i></span
                  >约 {{ minutes() }} 分钟</span
                >
              }
            </div>
            @if (m.tags.length) {
              <div class="mt-3 flex flex-wrap gap-2">
                @for (t of m.tags; track t) {
                  <a [routerLink]="['/tags', t]" class="fuwari-chip"
                    >#{{ t }}</a
                  >
                }
              </div>
            }
          }
          @if (
            m.cover &&
            blog.settings().articleCover !== false &&
            !blog.settings().articleCoverTop
          ) {
            <img
              [src]="blog.url(m.cover)"
              [alt]="m.title"
              class="mt-5 max-h-[420px] w-full rounded-2xl object-cover"
            />
          }
        </header>

        @if (loading()) {
          <div class="fuwari-muted py-16 text-center">
            <i class="fas fa-spinner fa-spin mr-2"></i>加载中…
          </div>
        } @else if (error()) {
          <div class="py-16 text-center text-red-500">
            文章加载失败：{{ error() }}
          </div>
        } @else if (locked()) {
          <form
            class="rounded-2xl bg-[var(--fuwari-bg-soft)] p-5"
            (submit)="unlock($event)"
          >
            <h2 class="mb-2 font-semibold">
              <i class="fas fa-lock mr-2" aria-hidden="true"></i>输入密码阅读
            </h2>
            <p class="fuwari-muted mb-4 text-sm whitespace-pre-line">
              {{ m.summary }}
            </p>
            <div class="flex flex-col gap-3 sm:flex-row">
              <input
                class="fuwari-input"
                type="password"
                name="password"
                [(ngModel)]="password"
                autocomplete="off"
                aria-label="文章阅读密码"
                required
              />
              <button
                class="fuwari-btn solid shrink-0"
                type="submit"
                [disabled]="unlocking()"
              >
                {{ unlocking() ? '解锁中…' : '解锁阅读' }}
              </button>
            </div>
            @if (unlockError()) {
              <p class="mt-3 text-sm text-red-500" role="alert">
                {{ unlockError() }}
              </p>
            }
          </form>
        } @else {
          <div class="prose-blog" [innerHTML]="html()"></div>
          @if (m.encrypted) {
            <button
              class="fuwari-btn mt-4 !text-xs"
              type="button"
              (click)="relock()"
            >
              <i class="fas fa-lock"></i>重新锁定
            </button>
          }
        }

        @if (blog.settings().articleShare !== false) {
          <div class="mt-6 flex flex-wrap items-center gap-2">
            <span class="fuwari-muted text-sm">分享文章</span>
            <button class="fuwari-btn !text-xs" (click)="copyUrl()">
              <i class="far fa-copy"></i>复制链接
            </button>
            @if (canShare) {
              <button class="fuwari-btn !text-xs" (click)="share()">
                <i class="fas fa-share-alt"></i>分享
              </button>
            }
          </div>
        }
        @if (blog.settings().articleCopyright !== false) {
          <div
            class="mt-8 rounded-2xl border border-[var(--fuwari-border)] bg-[var(--fuwari-bg-soft)] p-4 text-sm"
          >
            <div class="flex flex-col gap-1.5">
              <div>
                <span class="fuwari-muted">文章作者：</span
                ><a routerLink="/about" class="fuwari-link">{{
                  blog.settings().author
                }}</a>
              </div>
              <div class="break-all">
                <span class="fuwari-muted">文章链接：</span
                ><a [href]="pageUrl()" class="fuwari-link">{{ pageUrl() }}</a>
              </div>
              @if (blog.settings().license) {
                <div>
                  <span class="fuwari-muted">版权声明：</span>本文采用
                  <a
                    [href]="blog.settings().licenseUrl"
                    target="_blank"
                    rel="noopener"
                    class="fuwari-link"
                    >{{ blog.settings().license }}</a
                  >
                  许可协议，转载请注明出处。
                </div>
              }
            </div>
            <button
              class="fuwari-btn mt-3 !px-3 !py-1.5 !text-xs"
              (click)="copyUrl()"
            >
              <i class="far fa-copy"></i>复制链接
            </button>
          </div>
        }

        @if (blog.settings().articleAdjacent !== false) {
          <div class="mt-4 grid gap-4 sm:grid-cols-2">
            @if (prev(); as p) {
              <a
                [routerLink]="['/posts', p.slug]"
                class="fuwari-card fuwari-card-hover block p-4"
              >
                <div class="fuwari-muted text-xs tracking-wide uppercase">
                  <i class="fas fa-chevron-left mr-1"></i>上一篇
                </div>
                <div class="mt-1 line-clamp-1 font-semibold">{{ p.title }}</div>
              </a>
            } @else {
              <div class="hidden sm:block"></div>
            }
            @if (next(); as n) {
              <a
                [routerLink]="['/posts', n.slug]"
                class="fuwari-card fuwari-card-hover block p-4 text-right"
              >
                <div class="fuwari-muted text-xs tracking-wide uppercase">
                  下一篇<i class="fas fa-chevron-right ml-1"></i>
                </div>
                <div class="mt-1 line-clamp-1 font-semibold">{{ n.title }}</div>
              </a>
            }
          </div>
        }
        @if (commentsEnabled()) {
          <section id="comments" class="fuwari-card mt-4 p-5 md:p-6">
            <div class="fuwari-section-title mb-4">
              <i class="far fa-comments"></i>评论
            </div>
            <app-giscus />
          </section>
        }
      </article>
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
  readonly unlockedSlug = signal('')
  readonly locked = computed(
    () => !!this.meta()?.encrypted && this.unlockedSlug() !== this.slug(),
  )
  readonly unlocking = signal(false)
  readonly unlockError = signal('')
  password = ''
  private encryptedBody = ''
  private requestVersion = 0
  private alive = true
  readonly date = formatDate
  readonly minutes = computed(() =>
    Math.max(1, Math.round((this.meta()?.words || 0) / 400)),
  )
  readonly index = computed(() =>
    this.blog.posts().findIndex((p) => p.slug === this.slug()),
  )
  readonly prev = computed(() =>
    this.index() >= 0 ? this.blog.posts()[this.index() + 1] : undefined,
  )
  readonly next = computed(() =>
    this.index() > 0 ? this.blog.posts()[this.index() - 1] : undefined,
  )
  readonly pageUrl = computed(() => {
    const site = this.blog.config.siteUrl
    const path = `posts/${encodeURIComponent(this.slug())}/`
    return site
      ? `${site}${this.blog.config.baseHref}${path}`
      : this.blog.url(path)
  })
  readonly commentsEnabled = computed(
    () =>
      this.blog.settings().articleComment !== false &&
      !!this.blog.settings().giscus?.enable &&
      !!this.meta() &&
      !this.locked() &&
      !this.loading() &&
      !this.error() &&
      this.meta()?.comments !== false,
  )

  constructor() {
    effect(() => {
      const slug = this.slug()
      const m = this.meta()
      this.blog.setTitle(m?.title || '文章不存在')
      void this.load(slug)
    })
    effect(() => this.blog.commentsVisible.set(this.commentsEnabled()))
  }

  private async load(slug: string) {
    const version = ++this.requestVersion
    this.loading.set(true)
    this.error.set('')
    this.html.set('')
    this.blog.toc.set([])
    this.unlockedSlug.set('')
    this.encryptedBody = this.password = ''
    this.unlockError.set('')
    this.unlocking.set(false)
    if (!this.meta()) {
      this.loading.set(false)
      return
    }
    try {
      const src = await this.blog.getPostSource(slug)
      if (
        !this.alive ||
        version !== this.requestVersion ||
        slug !== this.slug()
      )
        return
      const parsed = parseFrontMatter(src)
      const sourceMeta = normalizeMeta(parsed.data, slug, parsed.body)
      if (!!sourceMeta.encrypted !== !!this.meta()?.encrypted)
        throw new Error('文章保护状态已更新，请刷新页面')
      if (sourceMeta.encrypted) this.encryptedBody = parsed.body
      else this.renderBody(parsed.body)
    } catch (e: any) {
      if (this.alive && version === this.requestVersion)
        this.error.set(e?.message || String(e))
    } finally {
      if (this.alive && version === this.requestVersion) this.loading.set(false)
    }
  }

  private renderBody(body: string) {
    const { html, toc } = renderMarkdown(body)
    this.html.set(this.sanitizer.bypassSecurityTrustHtml(html))
    this.blog.toc.set(toc)
    if (location.hash) {
      const version = this.requestVersion
      setTimeout(() => {
        if (!this.alive || version !== this.requestVersion) return
        try {
          document
            .getElementById(decodeURIComponent(location.hash.slice(1)))
            ?.scrollIntoView()
        } catch {}
      })
    }
  }

  async unlock(event: Event) {
    event.preventDefault()
    if (this.unlocking() || !this.encryptedBody || !this.locked()) return
    const version = this.requestVersion,
      slug = this.slug(),
      password = this.password
    this.password = ''
    this.unlocking.set(true)
    this.unlockError.set('')
    try {
      const body = await decryptPostBody(this.encryptedBody, password)
      if (
        !this.alive ||
        version !== this.requestVersion ||
        slug !== this.slug()
      )
        return
      this.renderBody(body)
      this.unlockedSlug.set(slug)
    } catch (e: any) {
      if (this.alive && version === this.requestVersion)
        this.unlockError.set(e.message)
    } finally {
      if (this.alive && version === this.requestVersion)
        this.unlocking.set(false)
    }
  }

  relock() {
    ++this.requestVersion
    this.unlockedSlug.set('')
    this.html.set('')
    this.blog.toc.set([])
    this.password = ''
    this.unlockError.set('')
  }

  readonly canShare = typeof navigator.share === 'function'
  async share() {
    try {
      await navigator.share({ title: this.meta()?.title, url: this.pageUrl() })
    } catch (error: any) {
      if (error?.name !== 'AbortError')
        this.toast.error('分享失败，可使用复制链接')
    }
  }
  copyUrl() {
    navigator.clipboard
      ?.writeText(this.pageUrl())
      .then(() => this.toast.success('链接已复制'))
      .catch(() => this.toast.error('复制失败，请手动复制链接'))
  }

  ngOnDestroy() {
    this.alive = false
    ++this.requestVersion
    this.html.set('')
    this.password = this.encryptedBody = ''
    this.blog.toc.set([])
    this.blog.commentsVisible.set(false)
  }
}
