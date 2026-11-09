import { Component, computed, input } from '@angular/core'
import { RouterLink } from '@angular/router'

@Component({
  selector: 'app-pagination',
  imports: [RouterLink],
  template: `
    @if (total() > 1) {
      <div class="mt-6 flex items-center justify-center gap-3">
        <a class="fuwari-page-btn" [class.disabled]="current() <= 1" [routerLink]="link(current() - 1)" aria-label="上一页">
          <i class="fas fa-chevron-left"></i>
        </a>
        <div class="fuwari-page-box">
          @for (p of pages(); track $index) {
            @if (p === -1) {
              <span class="fuwari-page-num fuwari-muted !min-w-6">…</span>
            } @else {
              <a class="fuwari-page-num" [class.active]="p === current()" [routerLink]="link(p)">{{ p }}</a>
            }
          }
        </div>
        <a class="fuwari-page-btn" [class.disabled]="current() >= total()" [routerLink]="link(current() + 1)" aria-label="下一页">
          <i class="fas fa-chevron-right"></i>
        </a>
      </div>
    }
  `,
})
export class PaginationComponent {
  readonly current = input.required<number>()
  readonly total = input.required<number>()
  readonly pages = computed(() => {
    const ADJ = 2
    const cur = this.current()
    const total = this.total()
    const list: number[] = []
    const start = Math.max(1, cur - ADJ)
    const end = Math.min(total, cur + ADJ)
    if (start > 1) list.push(1)
    if (start > 2) list.push(-1)
    for (let i = start; i <= end; i++) list.push(i)
    if (end < total - 1) list.push(-1)
    if (end < total) list.push(total)
    return list
  })
  link(p: number) {
    return p <= 1 ? '/' : `/page/${p}`
  }
}
