import { Component, computed, effect, inject, input } from '@angular/core'
import { RouterLink } from '@angular/router'
import { BlogService } from '../services/blog.service'
import { ScrollPostListComponent } from '../components/scroll-post-list.component'
import { PostListComponent } from '../components/post-list.component'

@Component({
  selector: 'app-taxonomy-page',
  imports: [RouterLink, PostListComponent, ScrollPostListComponent],
  template: `
    <div class="fuwari-card mb-4 p-6">
      <div class="fuwari-muted text-xs font-semibold tracking-widest uppercase">
        {{ isTag() ? 'Tags' : 'Categories' }}
      </div>
      <h1 class="mt-1 text-3xl font-bold">
        @if (name()) {
          <i
            [class]="isTag() ? 'fas fa-hashtag' : 'far fa-folder-open'"
            class="mr-2 text-[var(--fuwari-primary)]"
          ></i
          >{{ name() }}
        } @else {
          {{ label() }}
        }
      </h1>
      @if (name()) {
        <p class="fuwari-muted mt-2 text-sm">
          共 {{ list().length }} 篇文章 ·
          <a
            [routerLink]="isTag() ? '/tags' : '/categories'"
            class="fuwari-link"
            >全部{{ label() }}</a
          >
        </p>
      }
      <div class="mt-4 flex flex-wrap gap-2">
        @for (t of items(); track t.name) {
          <a
            [routerLink]="[isTag() ? '/tags' : '/categories', t.name]"
            class="fuwari-chip"
            [class.active]="t.name === name()"
          >
            {{ isTag() ? '#' : '' }}{{ t.name }}
            <span class="count">{{ t.count }}</span>
          </a>
        } @empty {
          <span class="fuwari-muted text-sm">暂无{{ label() }}</span>
        }
      </div>
    </div>
    @if (name()) {
      @if (blog.settings().listMode === 'scroll') {
        <app-scroll-post-list [posts]="list()" />
      } @else {
        <app-post-list
          [posts]="list()"
          [showCover]="blog.settings().showCover"
        />
      }
    }
  `,
})
export class TaxonomyPage {
  readonly blog = inject(BlogService)
  readonly type = input<'category' | 'tag'>('category')
  readonly name = input<string>('')
  readonly isTag = computed(() => this.type() === 'tag')
  readonly label = computed(() => (this.isTag() ? '标签' : '分类'))
  readonly items = computed(() =>
    this.isTag() ? this.blog.tags() : this.blog.categories(),
  )
  readonly list = computed(() =>
    this.isTag()
      ? this.blog.postsByTag(this.name())
      : this.blog.postsByCategory(this.name()),
  )
  constructor() {
    effect(() =>
      this.blog.setTitle(
        this.name() ? `${this.label()}：${this.name()}` : this.label(),
      ),
    )
  }
}
