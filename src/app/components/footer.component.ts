import {
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core'
import { HttpClient } from '@angular/common/http'
import { DomSanitizer } from '@angular/platform-browser'
import { RouterLink } from '@angular/router'
import { timeout } from 'rxjs'
import { BlogService } from '../services/blog.service'

@Component({
  selector: 'app-footer',
  imports: [RouterLink],
  template: `
    <footer class="mx-auto w-full max-w-6xl px-3 md:px-4">
      <div
        class="fuwari-footer fuwari-muted flex flex-col items-center gap-1.5 py-8 text-center text-sm"
      >
        <div>
          © {{ yearText }}
          <a routerLink="/about" class="fuwari-link">{{ settings().author }}</a
          >. All Rights Reserved.
        </div>
        @if (settings().footerHtml) {
          <div [innerHTML]="footerHtml()"></div>
        }
        @if (settings().beiAn) {
          <a
            class="fuwari-link text-xs"
            [href]="settings().beiAnLink || 'https://beian.miit.gov.cn/'"
            target="_blank"
            rel="noopener noreferrer"
            >{{ settings().beiAn }}</a
          >
        }
        @if (settings().beiAnGongan) {
          <a
            class="fuwari-link text-xs"
            [href]="gonganLink()"
            target="_blank"
            rel="noopener noreferrer"
            >{{ settings().beiAnGongan }}</a
          >
        }
        <div
          class="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs"
        >
          @if (settings().busuanzi) {
            @if (stats(); as counts) {
              <span id="busuanzi_container_site_pv"
                ><i class="far fa-eye mr-1"></i>访问
                <span id="busuanzi_value_site_pv">{{ counts.pv }}</span>
                次</span
              >
              <span id="busuanzi_container_site_uv"
                ><i class="far fa-user mr-1"></i>访客
                <span id="busuanzi_value_site_uv">{{ counts.uv }}</span>
                人</span
              >
            } @else {
              <span role="status">{{
                statsFailed() ? '访问统计暂不可用' : '访问统计加载中…'
              }}</span>
            }
          }
          <a routerLink="/admin" class="fuwari-link" title="管理后台"
            ><i class="fas fa-pen-nib"></i
          ></a>
        </div>
      </div>
    </footer>
  `,
})
export class FooterComponent {
  readonly blog = inject(BlogService)
  readonly settings = this.blog.settings
  readonly path = input('/')
  readonly stats = signal<{ pv: number; uv: number } | null>(null)
  readonly statsFailed = signal(false)
  private readonly http = inject(HttpClient)
  private readonly statsEnabled = computed(
    () => !!this.settings().busuanzi,
  )
  private readonly page = computed(() => this.path().split('#')[0])
  private sanitizer = inject(DomSanitizer)
  readonly footerHtml = computed(() =>
    this.sanitizer.bypassSecurityTrustHtml(this.settings().footerHtml || ''),
  )
  readonly gonganLink = computed(() => {
    const code = this.settings().beiAnGongan?.match(/\d{10,}/)?.[0]
    return code
      ? `https://beian.mps.gov.cn/#/query/webSearch?code=${code}`
      : 'https://beian.mps.gov.cn/'
  })
  constructor() {
    effect((onCleanup) => {
      this.page()
      this.stats.set(null)
      this.statsFailed.set(false)
      if (!this.statsEnabled()) return
      // Angular 接收统计值，不依赖外部脚本寻找尚未渲染的页脚节点。
      const request = this.http
        .jsonp<{ site_pv: unknown; site_uv: unknown } | null>(
          `https://busuanzi.ibruce.info/busuanzi?t=${Date.now()}`,
          'jsonpCallback',
        )
        .pipe(timeout(10000))
        .subscribe({
          next: (data) => {
            const pv = data?.site_pv,
              uv = data?.site_uv
            if (
              typeof pv === 'number' &&
              typeof uv === 'number' &&
              Number.isSafeInteger(pv) &&
              pv >= 0 &&
              Number.isSafeInteger(uv) &&
              uv >= 0
            )
              this.stats.set({ pv, uv })
            else this.statsFailed.set(true)
          },
          error: () => this.statsFailed.set(true),
        })
      onCleanup(() => request.unsubscribe())
    })
  }
  get yearText() {
    const now = new Date().getFullYear()
    const since = Number(this.settings().since) || now
    return since < now ? `${since} - ${now}` : `${now}`
  }
}
