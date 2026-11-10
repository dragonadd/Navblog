import { Component, computed, effect, inject, input } from '@angular/core'
import { BlogService } from '../services/blog.service'
import { PostListComponent } from '../components/post-list.component'
import { PaginationComponent } from '../components/pagination.component'
import { HitokotoComponent } from '../components/hitokoto.component'
import { ScrollPostListComponent } from '../components/scroll-post-list.component'

@Component({
  selector: 'app-home-page',
  imports: [
    PostListComponent,
    PaginationComponent,
    HitokotoComponent,
    ScrollPostListComponent,
  ],
  template: `
    <app-hitokoto />
    @if (blog.settings().listMode === 'scroll') {
      <app-scroll-post-list [posts]="blog.posts()" [initialPage]="current()" />
    } @else {
      <app-post-list [posts]="list()" [showCover]="blog.settings().showCover" />
      <app-pagination [current]="current()" [total]="totalPages()" />
    }
  `,
})
export class HomePage {
  readonly blog = inject(BlogService)
  readonly page = input<string>()
  readonly size = computed(() =>
    Math.max(1, Number(this.blog.settings().postsPerPage) || 8),
  )
  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.blog.posts().length / this.size())),
  )
  readonly current = computed(() =>
    Math.min(this.totalPages(), Math.max(1, Number(this.page()) || 1)),
  )
  readonly list = computed(() => {
    const s = this.size()
    return this.blog.posts().slice((this.current() - 1) * s, this.current() * s)
  })
  constructor() {
    effect(() =>
      this.blog.setTitle(
        this.current() > 1 ? `第 ${this.current()} 页` : undefined,
      ),
    )
  }
}
