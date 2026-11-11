import { Component, computed, inject, input } from '@angular/core'
import { RouterLink } from '@angular/router'
import { BlogService } from '../services/blog.service'
import { ContactCardComponent } from './contact-card.component'
import { TocComponent } from './toc.component'
import { AnnouncementComponent } from './announcement.component'
import { SIDEBAR_MODULES } from '../../shared/theme-settings'
import type { SidebarModule } from '../../shared/types'

@Component({
  selector: 'app-sidebar',
  imports: [
    RouterLink,
    TocComponent,
    ContactCardComponent,
    AnnouncementComponent,
  ],
  template: `
    <div class="flex flex-col gap-4">
      @if (has('profile')) {
        <div class="fuwari-card p-4">
          <a
            [routerLink]="settings().profilePath || '/about'"
            class="group relative block overflow-hidden rounded-2xl"
          >
            <img
              [src]="blog.url(settings().avatar)"
              [alt]="settings().author"
              class="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <div
              class="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100"
            >
              <i class="far fa-id-card text-3xl text-white"></i>
            </div>
          </a>
          <div class="mt-3 text-center">
            <div class="text-xl font-bold">{{ settings().author }}</div>
            <div
              class="mx-auto mt-1 h-1 w-5 rounded bg-[var(--fuwari-primary)]"
            ></div>
            <p class="fuwari-muted mt-2 text-sm">{{ settings().subtitle }}</p>
          </div>
          @if (social().length) {
            <div class="mt-3 flex flex-wrap justify-center gap-2">
              @for (s of social(); track s.url) {
                <a
                  class="fuwari-social-btn"
                  [href]="blog.url(s.url)"
                  [title]="s.label"
                  target="_blank"
                  rel="noopener"
                >
                  <i [class]="s.icon"></i>
                </a>
              }
            </div>
          }
        </div>
      }
      @if (has('announcement')) {
        <app-announcement />
      }
      @if (has('stats') && settings().sidebarStats !== false) {
        <div class="fuwari-card grid grid-cols-3 gap-2 p-3 text-center">
          <a
            routerLink="/archive"
            class="rounded-xl p-2 hover:bg-[var(--fuwari-primary-soft)]"
          >
            <div class="text-lg font-bold">{{ blog.posts().length }}</div>
            <div class="fuwari-muted text-xs">文章</div>
          </a>
          <a
            routerLink="/categories"
            class="rounded-xl p-2 hover:bg-[var(--fuwari-primary-soft)]"
          >
            <div class="text-lg font-bold">{{ blog.categories().length }}</div>
            <div class="fuwari-muted text-xs">分类</div>
          </a>
          <a
            routerLink="/tags"
            class="rounded-xl p-2 hover:bg-[var(--fuwari-primary-soft)]"
          >
            <div class="text-lg font-bold">{{ blog.tags().length }}</div>
            <div class="fuwari-muted text-xs">标签</div>
          </a>
        </div>
      }
      @if (has('latestPosts') && settings().latestPosts) {
        <section class="fuwari-card p-4">
          <h2 class="fuwari-section-title mb-3">最新发布</h2>
          @for (p of latest(); track p.slug) {
            <a
              [routerLink]="['/posts', p.slug]"
              class="fuwari-link block py-1.5 text-sm"
              >{{ p.title }}</a
            >
          }
        </section>
      }
      @if (has('contact')) {
        <app-contact-card />
      }
      @if (
        has('categories') &&
        settings().sidebarCategories !== false &&
        blog.categories().length
      ) {
        <div class="fuwari-card p-4">
          <div class="fuwari-section-title mb-3">分类</div>
          <div class="flex flex-col gap-1">
            @for (c of blog.categories(); track c.name) {
              <a
                [routerLink]="['/categories', c.name]"
                class="flex items-center justify-between rounded-lg px-2.5 py-1.5 text-sm transition-colors hover:bg-[var(--fuwari-primary-soft)] hover:text-[var(--fuwari-primary)]"
              >
                <span
                  ><i class="far fa-folder mr-2 opacity-60"></i
                  >{{ c.name }}</span
                >
                <span class="fuwari-chip !px-2 !py-0 text-xs">{{
                  c.count
                }}</span>
              </a>
            }
          </div>
        </div>
      }

      @if (
        has('tags') && settings().sidebarTags !== false && blog.tags().length
      ) {
        <div class="fuwari-card p-4">
          <div class="fuwari-section-title mb-3">标签</div>
          <div class="flex flex-wrap gap-2">
            @for (t of blog.tags(); track t.name) {
              <a [routerLink]="['/tags', t.name]" class="fuwari-chip"
                >#{{ t.name }}</a
              >
            }
          </div>
        </div>
      }
      @if (has('toc') && settings().articleToc !== false && blog.toc().length) {
        <div class="hidden lg:sticky lg:top-[76px] lg:block">
          <div class="fuwari-card max-h-[calc(100vh-100px)] overflow-auto p-4">
            <div class="fuwari-section-title mb-3">目录</div>
            <app-toc />
          </div>
        </div>
      }
    </div>
  `,
})
export class SidebarComponent {
  readonly blog = inject(BlogService)
  readonly settings = this.blog.settings
  readonly modules = input<readonly SidebarModule[]>(
    SIDEBAR_MODULES.map(({ key }) => key),
  )
  has(key: SidebarModule) {
    return this.modules().includes(key)
  }
  readonly social = computed(() => {
    if (this.settings().rssEnable !== false) return this.settings().social
    const rss = new URL(this.blog.url('rss.xml'))
    return this.settings().social.filter((s) => {
      try {
        const url = new URL(this.blog.url(s.url), document.baseURI)
        return url.origin !== rss.origin || url.pathname !== rss.pathname
      } catch {
        return true
      }
    })
  })
  readonly latest = computed(() =>
    [...this.blog.posts()]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 6),
  )
}
