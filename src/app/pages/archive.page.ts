import { Component, computed, inject } from '@angular/core'
import { RouterLink } from '@angular/router'
import { BlogService, formatDate } from '../services/blog.service'
import type { PostMeta } from '../../shared/types'

@Component({
  selector: 'app-archive-page',
  imports: [RouterLink],
  template: `
    <div class="fuwari-card mb-4 p-6">
      <div class="fuwari-muted text-xs font-semibold tracking-widest uppercase">Archive</div>
      <h1 class="mt-1 text-3xl font-bold">归档</h1>
      <p class="fuwari-muted mt-2 text-sm">共 {{ blog.posts().length }} 篇文章，继续加油！</p>
    </div>
    <div class="flex flex-col gap-4">
      @for (g of groups(); track g.year) {
        <div class="fuwari-card p-5">
          <div class="fuwari-section-title mb-3 !text-lg">{{ g.year }} <span class="fuwari-muted text-sm font-normal">{{ g.posts.length }} 篇</span></div>
          @for (p of g.posts; track p.slug) {
            <a [routerLink]="['/posts', p.slug]" class="group flex items-center gap-4 border-b border-dashed border-[var(--fuwari-border)] px-2 py-2.5 last:border-b-0">
              <span class="fuwari-muted w-12 shrink-0 font-mono text-sm">{{ date(p.date).slice(5) }}</span>
              <span class="h-2 w-2 shrink-0 rounded-full bg-[var(--fuwari-primary)] opacity-60 group-hover:opacity-100"></span>
              <span class="truncate font-medium transition-colors group-hover:text-[var(--fuwari-primary)]">{{ p.title }}</span>
              @if (p.tags.length) {
                <span class="fuwari-muted ml-auto hidden shrink-0 text-xs md:inline">{{ tagText(p) }}</span>
              }
            </a>
          }
        </div>
      }
    </div>
  `,
})
export class ArchivePage {
  readonly blog = inject(BlogService)
  readonly date = formatDate
  readonly groups = computed(() => {
    const map = new Map<string, PostMeta[]>()
    const sorted = [...this.blog.posts()].sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    for (const p of sorted) {
      const y = (p.date || '未知').slice(0, 4)
      if (!map.has(y)) map.set(y, [])
      map.get(y)!.push(p)
    }
    return [...map.entries()].map(([year, posts]) => ({ year, posts }))
  })
  tagText(p: PostMeta) {
    return p.tags.map((t) => '#' + t).join(' ')
  }
  constructor() {
    this.blog.setTitle('归档')
  }
}
