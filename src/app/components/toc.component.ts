import {
  Component,
  OnDestroy,
  OnInit,
  inject,
  output,
  signal,
} from '@angular/core'
import { ViewportScroller } from '@angular/common'
import { BlogService } from '../services/blog.service'
import { pageScrollElement } from '../services/page-scroll.service'

@Component({
  selector: 'app-toc',
  template: `
    <nav class="fuwari-toc max-h-[60vh] overflow-y-auto">
      @for (item of blog.toc(); track item.id) {
        <a
          [href]="anchorHref(item.id)"
          [class.active]="active() === item.id"
          [style.padding-left.rem]="0.6 + (item.level - 2) * 0.9"
          (click)="go($event, item.id)"
          >{{ item.text }}</a
        >
      }
    </nav>
  `,
})
export class TocComponent implements OnInit, OnDestroy {
  readonly blog = inject(BlogService)
  private readonly viewport = inject(ViewportScroller)
  readonly active = signal('')
  readonly navigate = output<void>()
  private timer?: ReturnType<typeof setTimeout>
  private onScroll = () => {
    const threshold =
      (pageScrollElement()?.getBoundingClientRect().top ?? 80) + 40
    let current = ''
    for (const item of this.blog.toc()) {
      const el = document.getElementById(item.id)
      if (el && el.getBoundingClientRect().top < threshold) current = item.id
    }
    this.active.set(current)
  }

  ngOnInit() {
    document.addEventListener('scroll', this.onScroll, {
      capture: true,
      passive: true,
    })
    this.timer = setTimeout(this.onScroll, 100)
  }
  ngOnDestroy() {
    document.removeEventListener('scroll', this.onScroll, true)
    clearTimeout(this.timer)
  }

  anchorHref(id: string) {
    return location.pathname + location.search + '#' + encodeURIComponent(id)
  }

  go(e: Event, id: string) {
    e.preventDefault()
    this.viewport.scrollToAnchor(id, { behavior: 'smooth' })
    history.replaceState(history.state, '', this.anchorHref(id))
    this.navigate.emit()
  }
}
