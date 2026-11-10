// Blog based on https://github.com/xjh22222228/nav (GPL-3.0)
import { Component, computed, effect, inject, signal } from '@angular/core'
import { NavigationEnd, Router, RouterOutlet } from '@angular/router'
import { filter } from 'rxjs'
import { HeaderComponent } from './components/header.component'
import { SidebarComponent } from './components/sidebar.component'
import { FooterComponent } from './components/footer.component'
import { FloatButtonsComponent } from './components/float-buttons.component'
import { ToastComponent } from './components/toast.component'
import { BlogService } from './services/blog.service'
import { ThemeService } from './services/theme.service'

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
      <app-header />
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
        >
          <div
            class="grid grid-cols-[minmax(0,1fr)] gap-4 lg:gap-6"
            [class.fuwari-with-sidebar]="!hideSidebar()"
            [class.fuwari-sidebar-reverse]="
              !hideSidebar() && settings().sidebarReverse
            "
          >
            @if (!hideSidebar()) {
              <div class="fuwari-sidebar-column order-2 min-w-0 lg:order-1">
                <app-sidebar />
              </div>
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
  readonly settings = this.blog.settings
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
  readonly heroBg = computed(
    () => `url("${this.blog.url(this.settings().heroImage)}")`,
  )

  constructor() {
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
