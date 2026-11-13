import { Component, computed, inject } from '@angular/core'
import { DomSanitizer } from '@angular/platform-browser'
import { RouterLink } from '@angular/router'
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
  get yearText() {
    const now = new Date().getFullYear()
    const since = Number(this.settings().since) || now
    return since < now ? `${since} - ${now}` : `${now}`
  }
}
