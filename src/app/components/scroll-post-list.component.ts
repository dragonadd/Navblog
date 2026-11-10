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
  readonly posts = input.required<PostMeta[]>()
  readonly initialPage = input(1)
  readonly query = input('')
  readonly size = computed(() =>
    Math.max(1, Number(this.blog.settings().postsPerPage) || 8),
  )
  readonly count = signal(1)
  readonly visible = computed(() =>
    this.posts().slice(0, this.count() * this.size()),
  )
  readonly hasMore = computed(() => this.visible().length < this.posts().length)
  readonly sentinel = viewChild<ElementRef<HTMLButtonElement>>('sentinel')
  private observer?: IntersectionObserver
  private frame = 0
  constructor() {
    effect(() => {
      this.posts()
      this.query()
      this.count.set(this.initialPage())
    })
    effect(() => {
      this.visible()
      this.observe()
    })
  }
  ngAfterViewInit() {
    this.observe()
  }
  private observe() {
    cancelAnimationFrame(this.frame)
    this.frame = requestAnimationFrame(() => {
      this.observer?.disconnect()
      const target = this.sentinel()?.nativeElement
      if (
        !target ||
        !this.hasMore() ||
        typeof IntersectionObserver === 'undefined'
      )
        return
      this.observer = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          this.observer?.disconnect()
          this.more()
        }
      })
      this.observer.observe(target)
    })
  }
  more() {
    if (this.hasMore()) this.count.update((v) => v + 1)
  }
  ngOnDestroy() {
    cancelAnimationFrame(this.frame)
    this.observer?.disconnect()
  }
}
