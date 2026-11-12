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
  host: { class: 'sticky top-0 z-[60] block w-full shrink-0' },
  imports: [RouterLink, RouterLinkActive, FormsModule],
  template: `
    <header class="mx-auto w-full max-w-6xl px-3 md:px-4">
      <nav
        class="fuwari-navbar relative grid h-[60px] grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3 backdrop-blur-md md:px-4 lg:grid-cols-[minmax(9rem,1fr)_minmax(0,auto)_minmax(9rem,1fr)]"
      >
        <a
          routerLink="/"
          (click)="closePanels()"
          class="fuwari-title max-w-48 min-w-0 truncate text-lg font-bold md:text-xl"
        >
          <i class="fas fa-feather-alt mr-1.5 text-[var(--fuwari-primary)]"></i
          >{{ settings().title }}
        </a>
        <div
          class="hidden min-w-0 items-center gap-1 overflow-x-auto px-1 [justify-content:safe_center] lg:flex"
          aria-label="顶部菜单"
        >
          @for (m of visibleMenus(); track m.url) {
            <a
              class="fuwari-menu-item shrink-0"
              [routerLink]="m.url"
              (click)="closePanels()"
              routerLinkActive="active"
              [routerLinkActiveOptions]="{ exact: m.url === '/' }"
            >
              <i [class]="m.icon"></i>{{ m.name }}
            </a>
          }
          @for (m of extraMenus(); track $index) {
            <div class="flex shrink-0 items-center">
              @if (m.url) {
                <a
                  class="fuwari-menu-item max-w-36"
                  [href]="blog.url(m.url)"
                  [title]="m.name"
                  [attr.target]="m.blank ? '_blank' : null"
                  rel="noopener noreferrer"
                  (click)="closePanels()"
                >
                  <span class="truncate">{{ m.name }}</span>
                </a>
                @if (m.children.length) {
                  <button
                    class="fuwari-tool-btn !h-8 !w-6"
                    type="button"
                    (click)="toggleExtra($index, $event)"
                    [attr.aria-expanded]="extraOpen() === $index"
                    [attr.aria-controls]="
                      extraOpen() === $index ? 'desktop-extra-menu' : null
                    "
                    [attr.aria-label]="
                      (extraOpen() === $index ? '收起 ' : '展开 ') +
                      m.name +
                      '二级菜单'
                    "
                  >
                    <i
                      class="fas fa-chevron-down text-xs"
                      aria-hidden="true"
                    ></i>
                  </button>
                }
              } @else {
                <button
                  class="fuwari-menu-item max-w-36"
                  type="button"
                  (click)="toggleExtra($index, $event)"
                  [title]="m.name"
                  [attr.aria-expanded]="extraOpen() === $index"
                  [attr.aria-controls]="
                    extraOpen() === $index ? 'desktop-extra-menu' : null
                  "
                  [attr.aria-label]="
                    (extraOpen() === $index ? '收起 ' : '展开 ') +
                    m.name +
                    '二级菜单'
                  "
                >
                  <span class="truncate">{{ m.name }}</span
                  ><i
                    class="fas fa-chevron-down text-xs"
                    aria-hidden="true"
                  ></i>
                </button>
              }
            </div>
          }
        </div>
        <div class="flex items-center justify-end gap-1">
          @if (settings().menuSearch !== false) {
            <button
              class="fuwari-tool-btn"
              title="搜索"
              aria-label="搜索"
              (click)="toggleSearch($event)"
            >
              <i class="fas fa-search"></i>
            </button>
          }
          @if (!settings().themeFixed) {
            <button
              class="fuwari-tool-btn"
              title="主题色"
              aria-label="主题色"
              (click)="togglePalette($event)"
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
          @if (
            settings().mobileMenu !== false &&
            (visibleMenus().length || extraMenus().length)
          ) {
            <button
              class="fuwari-tool-btn lg:hidden"
              title="菜单"
              aria-label="菜单"
              (click)="toggleMobile($event)"
            >
              <i [class]="mobileOpen() ? 'fas fa-times' : 'fas fa-bars'"></i>
            </button>
          }
        </div>

        @if (activeExtra(); as menu) {
          @if (menu.children.length) {
            <div
              id="desktop-extra-menu"
              class="fuwari-card absolute top-full z-10 mt-2 hidden max-h-[calc(100dvh-5rem)] max-w-full overflow-y-auto p-2 lg:block"
              [style.left.px]="extraLeft()"
              [style.width.px]="submenuWidth"
              role="group"
              [attr.aria-label]="menu.name + '二级菜单'"
            >
              @for (child of menu.children; track $index) {
                <a
                  class="fuwari-menu-item flex w-full whitespace-normal"
                  [href]="blog.url(child.url)"
                  [attr.target]="child.blank ? '_blank' : null"
                  rel="noopener noreferrer"
                  (click)="closePanels()"
                  ><span class="min-w-0 break-words">{{ child.name }}</span></a
                >
              }
            </div>
          }
        }

        @if (searchOpen()) {
          <div
            class="fuwari-card absolute top-full right-0 mt-2 w-[min(24rem,calc(100vw-1.5rem))] p-3"
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
                    @if (!p.encrypted) {
                      <div class="fuwari-muted line-clamp-1 text-xs">
                        {{ p.summary }}
                      </div>
                    }
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
            class="fuwari-card absolute top-full right-0 mt-2 w-[min(20rem,calc(100vw-1.5rem))] p-4"
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
            class="fuwari-card absolute top-full right-0 left-0 mt-2 max-h-[calc(100dvh-5rem)] overflow-y-auto p-2 lg:hidden"
          >
            @for (m of visibleMenus(); track m.url) {
              <a
                class="fuwari-menu-item flex w-full !py-2.5 !text-sm"
                [routerLink]="m.url"
                (click)="closePanels()"
              >
                <i [class]="m.icon + ' w-5'"></i>{{ m.name }}
              </a>
            }
            @for (m of extraMenus(); track $index) {
              <div>
                <div class="flex items-center">
                  @if (m.url) {
                    <a
                      class="fuwari-menu-item flex min-w-0 flex-1 !py-2.5 !text-sm"
                      [href]="blog.url(m.url)"
                      [attr.target]="m.blank ? '_blank' : null"
                      rel="noopener noreferrer"
                      (click)="closePanels()"
                      ><span class="min-w-0 break-words">{{ m.name }}</span></a
                    >
                    @if (m.children.length) {
                      <button
                        class="fuwari-tool-btn shrink-0"
                        type="button"
                        (click)="toggleExtra($index)"
                        [attr.aria-expanded]="extraOpen() === $index"
                        [attr.aria-controls]="
                          extraOpen() === $index
                            ? 'mobile-extra-' + $index
                            : null
                        "
                        [attr.aria-label]="
                          (extraOpen() === $index ? '收起 ' : '展开 ') +
                          m.name +
                          '二级菜单'
                        "
                      >
                        <i
                          class="fas fa-chevron-down text-xs"
                          aria-hidden="true"
                        ></i>
                      </button>
                    }
                  } @else {
                    <button
                      class="fuwari-menu-item flex w-full justify-between !py-2.5 !text-sm"
                      type="button"
                      (click)="toggleExtra($index)"
                      [attr.aria-expanded]="extraOpen() === $index"
                      [attr.aria-controls]="
                        extraOpen() === $index ? 'mobile-extra-' + $index : null
                      "
                      [attr.aria-label]="
                        (extraOpen() === $index ? '收起 ' : '展开 ') +
                        m.name +
                        '二级菜单'
                      "
                    >
                      <span class="min-w-0 break-words">{{ m.name }}</span
                      ><i
                        class="fas fa-chevron-down text-xs"
                        aria-hidden="true"
                      ></i>
                    </button>
                  }
                </div>
                @if (extraOpen() === $index && m.children.length) {
                  <div
                    class="mb-1 ml-3 border-l border-[var(--fuwari-border)] pl-2"
                    [id]="'mobile-extra-' + $index"
                    role="group"
                    [attr.aria-label]="m.name + '二级菜单'"
                  >
                    @for (child of m.children; track $index) {
                      <a
                        class="fuwari-menu-item flex w-full !py-2.5 !text-sm"
                        [href]="blog.url(child.url)"
                        [attr.target]="child.blank ? '_blank' : null"
                        rel="noopener noreferrer"
                        (click)="closePanels()"
                        ><span class="min-w-0 break-words">{{
                          child.name
                        }}</span></a
                      >
                    }
                  </div>
                }
              </div>
            }
          </div>
        }
      </nav>
    </header>
  `,
})
export class HeaderComponent {
  private toast = inject(ToastService)
  readonly blog = inject(BlogService)
  private router = inject(Router)
  private el = inject(ElementRef)
  private escapeTarget: HTMLElement | null = null
  readonly theme = inject(ThemeService)
  readonly settings = this.blog.settings
  readonly searchOpen = signal(false)
  readonly paletteOpen = signal(false)
  readonly mobileOpen = signal(false)
  readonly extraOpen = signal<number | null>(null)
  readonly extraLeft = signal(0)
  readonly submenuWidth = 256
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
          '/moments': 'menuMoments',
          '/about': 'menuAbout',
        } as const
      )[
        m.url as
          '/' | '/archive' | '/categories' | '/tags' | '/moments' | '/about'
      ]
      return !key || this.settings()[key] !== false
    }),
  )
  readonly extraMenus = computed(() =>
    this.settings()
      .menus.filter((menu) => menu.visible !== false)
      .map((menu) => ({
        ...menu,
        children: (menu.children || []).filter(
          (child) => child.visible !== false,
        ),
      }))
      .filter((menu) => menu.url || menu.children.length),
  )
  readonly activeExtra = computed(
    () => this.extraMenus()[this.extraOpen() ?? -1],
  )
  get keyword() {
    return this.kw()
  }
  set keyword(v: string) {
    this.kw.set(v)
  }

  readonly quickResults = computed(() =>
    this.blog.searchPosts(this.kw()).slice(0, 8),
  )

  async copyColor() {
    try {
      await navigator.clipboard.writeText(this.theme.hex)
      this.toast.success('主题色已复制')
    } catch {
      this.toast.error('复制失败，请手动复制：' + this.theme.hex)
    }
  }
  @HostListener('document:keydown.escape')
  onEscape() {
    if (
      !this.searchOpen() &&
      !this.paletteOpen() &&
      !this.mobileOpen() &&
      this.extraOpen() === null
    )
      return
    const target = this.escapeTarget
    this.closePanels()
    if (target?.isConnected) target.focus({ preventScroll: true })
  }

  @HostListener('window:resize')
  closePanels() {
    this.searchOpen.set(false)
    this.paletteOpen.set(false)
    this.mobileOpen.set(false)
    this.extraOpen.set(null)
    this.escapeTarget = null
  }

  toggleExtra(index: number, event?: MouseEvent) {
    const open = this.extraOpen() !== index,
      mobile = this.mobileOpen(),
      mobileTarget = this.escapeTarget
    this.closePanels()
    this.mobileOpen.set(mobile)
    if (mobile) this.escapeTarget = mobileTarget
    if (!open || !this.extraMenus()[index]?.children.length) return
    this.extraOpen.set(index)
    if (event) {
      if (!mobile) this.escapeTarget = event.currentTarget as HTMLElement
      const nav = this.el.nativeElement
        .querySelector('nav')
        .getBoundingClientRect()
      const left =
        (event.currentTarget as HTMLElement).getBoundingClientRect().left -
        nav.left
      this.extraLeft.set(
        Math.max(
          0,
          Math.min(left, nav.width - Math.min(this.submenuWidth, nav.width)),
        ),
      )
    }
  }

  togglePalette(event?: MouseEvent) {
    const open = !this.paletteOpen()
    this.closePanels()
    this.paletteOpen.set(open)
    if (open && event) this.escapeTarget = event.currentTarget as HTMLElement
  }

  toggleMobile(event?: MouseEvent) {
    const open = !this.mobileOpen()
    this.closePanels()
    this.mobileOpen.set(open)
    if (open && event) this.escapeTarget = event.currentTarget as HTMLElement
  }

  toggleSearch(event?: MouseEvent) {
    const open = !this.searchOpen()
    this.closePanels()
    this.searchOpen.set(open)
    if (open && event) this.escapeTarget = event.currentTarget as HTMLElement
    if (this.searchOpen()) {
      setTimeout(() =>
        (
          this.el.nativeElement.querySelector(
            'input[name=q]',
          ) as HTMLInputElement
        )?.focus({ preventScroll: true }),
      )
    }
  }

  doSearch(e: Event) {
    e.preventDefault()
    this.closePanels()
    this.router.navigate(['/search'], { queryParams: { q: this.kw().trim() } })
  }

  @HostListener('document:click', ['$event'])
  onDocClick(e: MouseEvent) {
    if (!this.el.nativeElement.contains(e.target)) {
      this.closePanels()
    }
  }
}
