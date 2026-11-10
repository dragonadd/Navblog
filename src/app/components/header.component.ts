import {
  Component,
  ElementRef,
  HostListener,
  computed,
  inject,
  signal,
} from '@angular/core'
import { Router, RouterLink, RouterLinkActive } from '@angular/router'
import { FormsModule } from '@angular/forms'
import { ToastService } from '../services/toast.service'
import { BlogService } from '../services/blog.service'
import { ThemeService } from '../services/theme.service'

@Component({
  selector: 'app-header',
  imports: [RouterLink, RouterLinkActive, FormsModule],
  template: `
    <header class="sticky top-0 z-50 mx-auto w-full max-w-6xl px-3 md:px-4">
      <nav
        class="fuwari-navbar relative grid h-[60px] grid-cols-[1fr_auto] items-center px-3 md:grid-cols-[1fr_auto_1fr] md:px-5"
      >
        <a
          routerLink="/"
          class="fuwari-title min-w-0 truncate text-lg font-bold md:text-xl"
        >
          <i class="fas fa-feather-alt mr-1.5 text-[var(--fuwari-primary)]"></i
          >{{ settings().title }}
        </a>
        <div class="hidden items-center gap-1 md:flex">
          @for (m of visibleMenus(); track m.url) {
            <a
              class="fuwari-menu-item"
              [routerLink]="m.url"
              routerLinkActive="active"
              [routerLinkActiveOptions]="{ exact: m.url === '/' }"
            >
              <i [class]="m.icon"></i>{{ m.name }}
            </a>
          }
          @for (m of settings().menus; track m.url) {
            <a
              class="fuwari-menu-item"
              [href]="m.url"
              [attr.target]="m.blank ? '_blank' : null"
              rel="noopener"
              >{{ m.name }}</a
            >
          }
        </div>
        <div class="flex items-center justify-end gap-1">
          @if (settings().menuSearch !== false) {
            <button
              class="fuwari-tool-btn"
              title="搜索"
              aria-label="搜索"
              (click)="toggleSearch()"
            >
              <i class="fas fa-search"></i>
            </button>
          }
          @if (!settings().themeFixed) {
            <button
              class="fuwari-tool-btn"
              title="主题色"
              aria-label="主题色"
              (click)="paletteOpen.set(!paletteOpen())"
            >
              <i class="fas fa-palette"></i>
            </button>
          }
          <button
            class="fuwari-tool-btn"
            [attr.aria-label]="theme.dark() ? '浅色模式' : '深色模式'"
            [title]="theme.dark() ? '浅色模式' : '深色模式'"
            (click)="theme.toggleDark()"
          >
            <i [class]="theme.dark() ? 'fas fa-sun' : 'fas fa-moon'"></i>
          </button>
          <button
            type="button"
            class="fuwari-tool-btn"
            title="恢复站点默认外观"
            aria-label="恢复站点默认外观"
            (click)="theme.resetAppearance()"
          >
            <i class="fas fa-rotate-left" aria-hidden="true"></i>
          </button>
          @if (settings().mobileMenu !== false) {
            <button
              class="fuwari-tool-btn md:hidden"
              title="菜单"
              aria-label="菜单"
              (click)="mobileOpen.set(!mobileOpen())"
            >
              <i [class]="mobileOpen() ? 'fas fa-times' : 'fas fa-bars'"></i>
            </button>
          }
        </div>

        @if (searchOpen()) {
          <div
            class="fuwari-card absolute top-[68px] right-0 w-[min(24rem,calc(100vw-1.5rem))] p-3"
          >
            <form (submit)="doSearch($event)" class="flex gap-2">
              <input
                #searchInput
                class="fuwari-input"
                name="q"
                [(ngModel)]="keyword"
                placeholder="搜索文章标题、摘要、标签…"
                autocomplete="off"
              />
              <button class="fuwari-btn solid" type="submit">
                <i class="fas fa-search"></i>
              </button>
            </form>
            @if (quickResults().length) {
              <div class="mt-2 max-h-72 overflow-y-auto">
                @for (p of quickResults(); track p.slug) {
                  <a
                    [routerLink]="['/posts', p.slug]"
                    (click)="searchOpen.set(false)"
                    class="block rounded-lg px-3 py-2 text-sm hover:bg-[var(--fuwari-primary-soft)]"
                  >
                    <div class="font-semibold">{{ p.title }}</div>
                    <div class="fuwari-muted line-clamp-1 text-xs">
                      {{ p.summary }}
                    </div>
                  </a>
                }
              </div>
            } @else if (keyword.trim()) {
              <div class="fuwari-muted mt-3 px-1 text-sm">没有找到相关文章</div>
            }
          </div>
        }

        @if (paletteOpen()) {
          <div
            class="fuwari-card absolute top-[68px] right-0 w-[min(20rem,calc(100vw-1.5rem))] p-4"
          >
            <div class="mb-3 flex items-center justify-between">
              <span class="fuwari-section-title">主题色</span>
              <div class="flex items-center gap-2">
                @if (theme.hue() !== theme.defaultHue) {
                  <button
                    class="fuwari-tool-btn"
                    title="重置"
                    (click)="theme.resetHue()"
                  >
                    <i class="fas fa-rotate-left"></i>
                  </button>
                }
                <span
                  class="rounded-lg bg-[var(--fuwari-primary-soft)] px-2.5 py-1 text-sm font-bold text-[var(--fuwari-primary)]"
                >
                  {{ theme.hue() }}
                </span>
              </div>
            </div>
            <input
              type="range"
              min="0"
              max="360"
              step="1"
              class="fuwari-hue-slider"
              [value]="theme.hue()"
              (input)="theme.setHue(+$any($event.target).value)"
            />
            <button
              type="button"
              class="fuwari-btn mt-3 w-full justify-center !text-xs"
              (click)="copyColor()"
              aria-label="复制主题色 HEX"
            >
              {{ theme.hex }} <i class="far fa-copy"></i>
            </button>
          </div>
        }

        @if (mobileOpen()) {
          <div
            class="fuwari-card absolute top-[68px] right-0 left-0 p-2 md:hidden"
          >
            @for (m of menus; track m.url) {
              <a
                class="fuwari-menu-item flex w-full !py-2.5 !text-sm"
                [routerLink]="m.url"
                (click)="mobileOpen.set(false)"
              >
                <i [class]="m.icon + ' w-5'"></i>{{ m.name }}
              </a>
            }
            @for (m of settings().menus; track m.url) {
              <a
                class="fuwari-menu-item flex w-full !py-2.5 !text-sm"
                [href]="m.url"
                [attr.target]="m.blank ? '_blank' : null"
                >{{ m.name }}</a
              >
            }
          </div>
        }
      </nav>
    </header>
  `,
})
export class HeaderComponent {
  private toast = inject(ToastService)
  private blog = inject(BlogService)
  private router = inject(Router)
  private el = inject(ElementRef)
  readonly theme = inject(ThemeService)
  readonly settings = this.blog.settings
  readonly searchOpen = signal(false)
  readonly paletteOpen = signal(false)
  readonly mobileOpen = signal(false)
  readonly kw = signal('')
  readonly menus = [
    { name: '首页', url: '/', icon: 'fas fa-home' },
    { name: '归档', url: '/archive', icon: 'fas fa-archive' },
    { name: '分类', url: '/categories', icon: 'fas fa-folder-open' },
    { name: '标签', url: '/tags', icon: 'fas fa-tags' },
    { name: '碎碎念', url: '/moments', icon: 'far fa-comment-dots' },
    { name: '关于', url: '/about', icon: 'fas fa-user' },
  ]

  readonly visibleMenus = computed(() =>
    this.menus.filter((m) => {
      const key = (
        {
          '/': 'menuHome',
          '/archive': 'menuArchive',
          '/categories': 'menuCategories',
          '/tags': 'menuTags',
        } as const
      )[m.url as '/' | '/archive' | '/categories' | '/tags']
      return !key || this.settings()[key] !== false
    }),
  )
  get keyword() {
    return this.kw()
  }
  set keyword(v: string) {
    this.kw.set(v)
  }

  readonly quickResults = computed(() => {
    const k = this.kw().trim().toLowerCase()
    if (!k) return []
    return this.blog
      .posts()
      .filter((p) =>
        [p.title, p.summary, p.category, ...(p.tags || [])]
          .join(' ')
          .toLowerCase()
          .includes(k),
      )
      .slice(0, 8)
  })

  async copyColor() {
    try {
      await navigator.clipboard.writeText(this.theme.hex)
      this.toast.success('主题色已复制')
    } catch {
      this.toast.error('复制失败，请手动复制：' + this.theme.hex)
    }
  }
  @HostListener('document:keydown.escape')
  closePanels() {
    this.searchOpen.set(false)
    this.paletteOpen.set(false)
    this.mobileOpen.set(false)
  }

  toggleSearch() {
    this.searchOpen.set(!this.searchOpen())
    this.paletteOpen.set(false)
    if (this.searchOpen()) {
      setTimeout(() =>
        (
          this.el.nativeElement.querySelector(
            'input[name=q]',
          ) as HTMLInputElement
        )?.focus(),
      )
    }
  }

  doSearch(e: Event) {
    e.preventDefault()
    this.searchOpen.set(false)
    this.router.navigate(['/search'], { queryParams: { q: this.kw().trim() } })
  }

  @HostListener('document:click', ['$event'])
  onDocClick(e: MouseEvent) {
    if (!this.el.nativeElement.contains(e.target)) {
      this.searchOpen.set(false)
      this.paletteOpen.set(false)
      this.mobileOpen.set(false)
    }
  }
}
