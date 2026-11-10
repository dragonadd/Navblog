import {
  Component,
  HostListener,
  computed,
  inject,
  signal,
} from '@angular/core'
import { BlogService } from '../services/blog.service'
import { ThemeService } from '../services/theme.service'
import { TocComponent } from './toc.component'

@Component({
  selector: 'app-float-buttons',
  imports: [TocComponent],
  template: `
    <div class="fuwari-float-wrap">
      @if (blog.settings().articleToc !== false && blog.toc().length) {
        <button
          class="fuwari-float-btn lg:!hidden"
          title="目录"
          (click)="tocOpen.set(!tocOpen())"
        >
          <i class="fas fa-list-ul"></i>
        </button>
      }
      @if (hasComments()) {
        <button class="fuwari-float-btn" title="评论" (click)="toComments()">
          <i class="far fa-comment-dots"></i>
        </button>
      }
      @if (blog.settings().floatDark !== false) {
        <button
          class="fuwari-float-btn"
          title="切换深色模式"
          (click)="theme.toggleDark()"
        >
          <i [class]="theme.dark() ? 'fas fa-sun' : 'fas fa-moon'"></i>
        </button>
      }
      @if (scrolled()) {
        <button class="fuwari-float-btn" title="回到顶部" (click)="toTop()">
          <i class="fas fa-angle-up"></i>
        </button>
      }
    </div>
    @if (
      tocOpen() && blog.settings().articleToc !== false && blog.toc().length
    ) {
      <div
        class="fixed inset-0 z-50 bg-black/30 lg:hidden"
        (click)="tocOpen.set(false)"
      ></div>
      <div class="fuwari-card fixed right-3 bottom-20 z-50 w-72 p-4 lg:hidden">
        <div class="mb-3 flex items-center justify-between">
          <span class="fuwari-section-title">目录</span
          ><button
            class="fuwari-tool-btn"
            aria-label="关闭目录"
            (click)="tocOpen.set(false)"
          >
            <i class="fas fa-times"></i>
          </button>
        </div>
        <app-toc (navigate)="tocOpen.set(false)" />
      </div>
    }
  `,
})
export class FloatButtonsComponent {
  readonly blog = inject(BlogService)
  readonly theme = inject(ThemeService)
  readonly scrolled = signal(false)
  readonly tocOpen = signal(false)
  readonly hasComments = computed(
    () =>
      this.blog.commentsVisible() &&
      this.blog.settings().floatComment !== false,
  )

  @HostListener('window:scroll')
  onScroll() {
    this.scrolled.set(window.scrollY > 180)
  }

  @HostListener('document:keydown.escape')
  closeToc() {
    this.tocOpen.set(false)
  }

  toTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  toComments() {
    document.getElementById('comments')?.scrollIntoView({ behavior: 'smooth' })
  }
}
