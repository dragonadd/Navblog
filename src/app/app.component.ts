// Blog based on https://github.com/xjh22222228/nav (GPL-3.0)
import {
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core'
import { NavigationEnd, Router, RouterOutlet } from '@angular/router'
import { filter } from 'rxjs'
import { HeaderComponent } from './components/header.component'
import { SidebarComponent } from './components/sidebar.component'
import { FooterComponent } from './components/footer.component'
import { FloatButtonsComponent } from './components/float-buttons.component'
import { ToastComponent } from './components/toast.component'
import { BlogService } from './services/blog.service'
import { ThemeService } from './services/theme.service'
import { AnnouncementStateService } from './services/announcement-state.service'
import { readAnnouncement, announcementVersion } from '../shared/announcement'
import {
  availableSidebarModules,
  sidebarModuleSide,
} from '../shared/theme-settings'

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    HeaderComponent,
    SidebarComponent,
    FooterComponent,
    FloatButtonsComponent,
    ToastComponent,
  ],
  template: `
    <div id="theme-fuwari" class="fuwari-bg flex min-h-screen flex-col">
      <app-header [wide]="wideLayout()" />
      @if (isAdmin()) {
        <main class="mx-auto w-full max-w-6xl flex-1 px-3 pt-4 pb-12 md:px-4">
          <router-outlet />
        </main>
      } @else {
        @if (showHero()) {
          <div class="fuwari-hero" [style.background-image]="heroBg()">
            @if (settings().heroCreditText) {
              <a
                class="fuwari-hero-credit"
                [href]="settings().heroCreditLink || null"
                target="_blank"
                rel="noopener"
              >
                <i class="fas fa-camera mr-1"></i
                >{{ settings().heroCreditText }}
              </a>
            }
          </div>
        }
        <main
          class="mx-auto w-full max-w-6xl flex-1 px-3 pb-12 md:px-4"
          [class.fuwari-main-overlap]="showHero()"
          [class.fuwari-main-plain]="!showHero()"
          [class.fuwari-wide]="wideLayout()"
        >
          <div
            class="grid grid-cols-[minmax(0,1fr)] gap-4 lg:gap-6"
            [class.fuwari-with-sidebar]="
              !hideSidebar() &&
              desktop() &&
              (leftModules().length || rightModules().length)
            "
            [class.fuwari-sidebar-reverse]="
              desktop() && !leftModules().length && rightModules().length
            "
            [class.fuwari-both-sidebars]="wideLayout()"
          >
            @if (!hideSidebar()) {
              @if (desktop()) {
                @if (leftModules().length) {
                  <aside
                    class="fuwari-sidebar-column order-2 min-w-0 lg:order-1"
                    aria-label="左侧栏"
                  >
                    <app-sidebar [modules]="leftModules()" />
                  </aside>
                }
                @if (rightModules().length) {
                  <aside
                    class="fuwari-sidebar-column order-3 min-w-0"
                    aria-label="右侧栏"
                  >
                    <app-sidebar [modules]="rightModules()" />
                  </aside>
                }
              } @else {
                <aside
                  class="fuwari-sidebar-column order-2 min-w-0"
                  aria-label="侧栏"
                >
                  <app-sidebar [modules]="sidebarModules()" />
                </aside>
              }
            }
            <div class="fuwari-content-column order-1 min-w-0 lg:order-2">
              <router-outlet />
            </div>
          </div>
        </main>
      }
      <app-footer />
      @if (!isAdmin()) {
        <app-float-buttons />
      }
      <app-toast />
    </div>
  `,
})
export class AppComponent {
  private router = inject(Router)
  private blog = inject(BlogService)
  // 初始化主题
  private theme = inject(ThemeService)
  private announcementState = inject(AnnouncementStateService)
  readonly settings = this.blog.settings
  readonly desktop = signal(false)
  readonly url = signal(
    location.pathname.startsWith(this.blog.config.baseHref)
      ? location.pathname.slice(this.blog.config.baseHref.length - 1)
      : location.pathname,
  )
  readonly isAdmin = computed(() =>
    /^\/admin(?:\/|$)/.test(this.url().split(/[?#]/)[0]),
  )
  readonly showHero = computed(() => {
    const path = this.url().split(/[?#]/)[0] || '/'
    return !!this.settings().heroEnable && /^(\/|\/page\/\d+\/?)$/.test(path)
  })
  readonly hideSidebar = computed(() => {
    const match = this.url().match(/^\/posts\/([^/?#]+)/)
    if (!match) return false
    try {
      return !!this.blog.findPost(decodeURIComponent(match[1]))?.hideSidebar
    } catch {
      return false
    }
  })
  readonly sidebarModules = computed(() => {
    const s = this.settings(),
      a = readAnnouncement(s)
    return availableSidebarModules(s, {
      announcement:
        a.enabled &&
        !!(a.text || a.link) &&
        (!a.closable ||
          this.announcementState.dismissed() !== announcementVersion(a)),
      categories: this.blog.categories().length > 0,
      tags: this.blog.tags().length > 0,
      toc: this.blog.toc().length > 0,
    })
  })
  readonly leftModules = computed(() =>
    this.sidebarModules().filter(
      (key) => sidebarModuleSide(this.settings(), key) === 'left',
    ),
  )
  readonly rightModules = computed(() =>
    this.sidebarModules().filter(
      (key) => sidebarModuleSide(this.settings(), key) === 'right',
    ),
  )
  readonly wideLayout = computed(
    () =>
      !this.isAdmin() &&
      !this.hideSidebar() &&
      this.desktop() &&
      !!this.leftModules().length &&
      !!this.rightModules().length,
  )
  readonly heroBg = computed(
    () => `url("${this.blog.url(this.settings().heroImage)}")`,
  )

  constructor() {
    const media = window.matchMedia('(min-width: 1024px)')
    const updateDesktop = () => this.desktop.set(media.matches)
    updateDesktop()
    media.addEventListener('change', updateDesktop)
    inject(DestroyRef).onDestroy(() =>
      media.removeEventListener('change', updateDesktop),
    )
    // 移除构建时注入的预渲染内容
    document.getElementById('prerender')?.remove()
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => this.url.set(e.urlAfterRedirects))
    this.loadBusuanzi()
    // 文章中的代码复制按钮（事件委托）
    document.addEventListener('click', (ev) => {
      const btn = (ev.target as HTMLElement).closest?.(
        '.code-copy',
      ) as HTMLElement | null
      if (!btn) return
      const code =
        btn.closest('.code-block')?.querySelector('code')?.textContent || ''
      navigator.clipboard?.writeText(code).then(() => {
        btn.innerHTML = '<i class="fas fa-check"></i>'
        setTimeout(() => (btn.innerHTML = '<i class="far fa-copy"></i>'), 1500)
      })
    })
  }

  private loadBusuanzi() {
    if (!this.settings().busuanzi) return
    const s = document.createElement('script')
    s.async = true
    s.src = 'https://busuanzi.ibruce.info/busuanzi/2.3/busuanzi.pure.mini.js'
    document.body.appendChild(s)
  }
}
