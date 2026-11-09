import { Component, HostListener, inject, signal } from '@angular/core'
import { BlogService } from '../services/blog.service'
import { ThemeService } from '../services/theme.service'
import { TocComponent } from './toc.component'

@Component({
  selector: 'app-float-buttons',
  imports: [TocComponent],
  template: `
    <div class="fuwari-float-wrap">
      @if (blog.toc().length) {
        <button class="fuwari-float-btn lg:!hidden" title="目录" (click)="tocOpen.set(!tocOpen())">
          <i class="fas fa-list-ul"></i>
        </button>
      }
      @if (hasComments()) {
        <button class="fuwari-float-btn" title="评论" (click)="toComments()">
          <i class="far fa-comment-dots"></i>
        </button>
      }
      <button class="fuwari-float-btn" title="切换深色模式" (click)="theme.toggleDark()">
        <i [class]="theme.dark() ? 'fas fa-sun' : 'fas fa-moon'"></i>
      </button>
      @if (scrolled()) {
        <button class="fuwari-float-btn" title="回到顶部" (click)="toTop()">
          <i class="fas fa-angle-up"></i>
        </button>
      }
    </div>
    @if (tocOpen() && blog.toc().length) {
      <div class="fixed inset-0 z-50 bg-black/30 lg:hidden" (click)="tocOpen.set(false)"></div>
      <div class="fuwari-card fixed right-3 bottom-20 z-50 w-72 p-4 lg:hidden">
        <div class="fuwari-section-title mb-3">目录</div>
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
  readonly hasComments = signal(false)

  @HostListener('window:scroll')
  onScroll() {
    this.scrolled.set(window.scrollY > 180)
    this.hasComments.set(!!document.getElementById('comments'))
  }

  toTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  toComments() {
    document.getElementById('comments')?.scrollIntoView({ behavior: 'smooth' })
  }
}
