import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core'
import type { PostMeta } from '../../shared/types'
import { BlogService } from '../services/blog.service'
import { PostListComponent } from './post-list.component'

@Component({
  selector: 'app-scroll-post-list',
  imports: [PostListComponent],
  host: { class: 'block' },
  template: `
    <app-post-list
      [posts]="visible()"
      [query]="query()"
      [showCover]="blog.settings().showCover"
    />
    <button
      #sentinel
      type="button"
      class="fuwari-card mt-4 w-full p-4 text-center text-sm"
      [disabled]="!hasMore()"
      (click)="more()"
    >
      {{ hasMore() ? '加载更多' : '已显示全部文章' }}
    </button>
  `,
})
export class ScrollPostListComponent implements AfterViewInit, OnDestroy {
  readonly blog = inject(BlogService)
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef)
  readonly posts = input.required<PostMeta[]>()
  readonly query = input('')
  readonly batchSize = signal(1)
  readonly count = signal(1)
  readonly visible = computed(() => this.posts().slice(0, this.count()))
  readonly hasMore = computed(() => this.visible().length < this.posts().length)
  readonly sentinel = viewChild<ElementRef<HTMLButtonElement>>('sentinel')
  private observer?: IntersectionObserver
  private resizeObserver?: ResizeObserver
  private frame = 0
  private destroyed = false
  private readonly onViewportChange = () => this.observe()
  constructor() {
    effect(() => {
      this.posts()
      this.query()
      this.count.set(1)
    })
    effect(() => {
      this.visible()
      this.observe()
    })
  }
  ngAfterViewInit() {
    window.addEventListener('resize', this.onViewportChange)
    window.addEventListener('scroll', this.onViewportChange, { passive: true })
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(this.onViewportChange)
      this.resizeObserver.observe(this.host.nativeElement)
    }
    this.observe()
  }
  private observe() {
    if (this.destroyed) return
    cancelAnimationFrame(this.frame)
    this.frame = requestAnimationFrame(() => {
      this.observer?.disconnect()
      this.observer = undefined
      const host = this.host.nativeElement
      const card = host.querySelector<HTMLElement>('article')
      const list = host.querySelector<HTMLElement>('app-post-list > div')
      const height = card?.getBoundingClientRect().height || 240
      const gap = list ? parseFloat(getComputedStyle(list).rowGap) || 0 : 16
      const batchSize = Math.max(
        1,
        Math.ceil(window.innerHeight / (height + gap)),
      )
      this.batchSize.set(batchSize)
      // 放大窗口时补足可见范围，缩小时保留已经加载的文章。
      if (this.count() < batchSize) {
        this.count.set(batchSize)
        return
      }
      const target = this.sentinel()?.nativeElement
      if (
        !target ||
        !this.hasMore() ||
        typeof IntersectionObserver === 'undefined'
      )
        return
      // 快速滚动可能跨过整个加载按钮，位置经过视口时仍继续追加。
      if (target.getBoundingClientRect().top <= window.innerHeight + 120) {
        this.more()
        return
      }
      const observer = new IntersectionObserver(
        (entries) => {
          if (this.destroyed || this.observer !== observer) return
          if (entries.some((e) => e.isIntersecting)) {
            observer.disconnect()
            this.more()
          }
        },
        { rootMargin: '0px 0px 120px 0px' },
      )
      this.observer = observer
      observer.observe(target)
    })
  }
  more() {
    if (!this.destroyed && this.hasMore())
      this.count.update((v) => v + this.batchSize())
  }
  ngOnDestroy() {
    this.destroyed = true
    cancelAnimationFrame(this.frame)
    this.observer?.disconnect()
    this.resizeObserver?.disconnect()
    window.removeEventListener('resize', this.onViewportChange)
    window.removeEventListener('scroll', this.onViewportChange)
  }
}
