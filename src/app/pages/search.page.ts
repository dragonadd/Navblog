import {
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core'
import { FormsModule } from '@angular/forms'
import { Router } from '@angular/router'
import { BlogService } from '../services/blog.service'
import { ScrollPostListComponent } from '../components/scroll-post-list.component'
import { PostListComponent } from '../components/post-list.component'

@Component({
  selector: 'app-search-page',
  imports: [FormsModule, PostListComponent, ScrollPostListComponent],
  template: `
    <div class="fuwari-card mb-4 p-6">
      <div class="fuwari-muted text-xs font-semibold tracking-widest uppercase">
        Search
      </div>
      <h1 class="mt-1 text-3xl font-bold">搜索</h1>
      <form class="mt-4 flex gap-2" (submit)="submit($event)">
        <input
          class="fuwari-input"
          name="kw"
          [ngModel]="kw()"
          (ngModelChange)="kw.set($event)"
          placeholder="输入关键词，搜索标题、摘要、分类与标签"
        />
        <button class="fuwari-btn solid shrink-0" type="submit">
          <i class="fas fa-search"></i>搜索
        </button>
      </form>
      @if (kw().trim()) {
        <p class="fuwari-muted mt-3 text-sm">
          找到 {{ results().length }} 篇相关文章
        </p>
      }
    </div>
    @if (kw().trim()) {
      @if (blog.settings().listMode === 'scroll') {
        <app-scroll-post-list [posts]="results()" [query]="kw()" />
      } @else {
        <app-post-list
          [posts]="results()"
          [showCover]="blog.settings().showCover"
          [query]="kw()"
        />
      }
    }
  `,
})
export class SearchPage {
  readonly blog = inject(BlogService)
  private router = inject(Router)
  readonly q = input<string>('')
  readonly kw = signal('')
  readonly results = computed(() => this.blog.searchPosts(this.kw()))
  constructor() {
    this.blog.setTitle('搜索')
    effect(() => this.kw.set(this.q() || ''))
  }
  submit(e: Event) {
    e.preventDefault()
    this.router.navigate(['/search'], { queryParams: { q: this.kw().trim() } })
  }
}
