import { Component, OnDestroy, OnInit, inject, output, signal } from '@angular/core'
import { BlogService } from '../services/blog.service'

@Component({
  selector: 'app-toc',
  template: `
    <nav class="fuwari-toc max-h-[60vh] overflow-y-auto">
      @for (item of blog.toc(); track item.id) {
        <a
          [href]="'#' + item.id"
          [class.active]="active() === item.id"
          [style.padding-left.rem]="0.6 + (item.level - 2) * 0.9"
          (click)="go($event, item.id)"
        >{{ item.text }}</a>
      }
    </nav>
  `,
})
export class TocComponent implements OnInit, OnDestroy {
  readonly blog = inject(BlogService)
  readonly active = signal('')
  readonly navigate = output<void>()
  private onScroll = () => {
    let current = ''
    for (const item of this.blog.toc()) {
      const el = document.getElementById(item.id)
      if (el && el.getBoundingClientRect().top < 120) current = item.id
    }
    this.active.set(current)
  }

  ngOnInit() {
    window.addEventListener('scroll', this.onScroll, { passive: true })
    setTimeout(this.onScroll, 100)
  }
  ngOnDestroy() {
    window.removeEventListener('scroll', this.onScroll)
  }

  go(e: Event, id: string) {
    e.preventDefault()
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    history.replaceState(null, '', location.pathname + location.search + '#' + id)
    this.navigate.emit()
  }
}
