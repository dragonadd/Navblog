import {
  Component,
  OnDestroy,
  OnInit,
  inject,
  output,
  signal,
} from '@angular/core'
import { BlogService } from '../services/blog.service'
import {
  readingScrollContainer,
  scrollReadingTo,
} from '../services/reading-scroll'

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
          >{{ item.text }}</a
        >
      }
    </nav>
  `,
})
export class TocComponent implements OnInit, OnDestroy {
  readonly blog = inject(BlogService)
  readonly active = signal('')
  readonly navigate = output<void>()
  private onScroll = () => {
    const container = readingScrollContainer()
    const top = container?.getBoundingClientRect().top ?? 76
    let current = this.blog.toc()[0]?.id || ''
    for (const item of this.blog.toc()) {
      const el = document.getElementById(item.id)
      if (el && el.getBoundingClientRect().top <= top + 48) current = item.id
    }
    const atBottom = container
      ? container.scrollTop > 0 &&
        container.scrollTop + container.clientHeight >=
          container.scrollHeight - 2
      : window.scrollY > 0 &&
        window.scrollY + window.innerHeight >=
          document.documentElement.scrollHeight - 2
    if (atBottom) current = this.blog.toc().at(-1)?.id || current
    this.active.set(current)
  }

  ngOnInit() {
    document.addEventListener('scroll', this.onScroll, {
      passive: true,
      capture: true,
    })
    window.addEventListener('resize', this.onScroll, { passive: true })
    setTimeout(this.onScroll, 100)
  }
  ngOnDestroy() {
    document.removeEventListener('scroll', this.onScroll, true)
    window.removeEventListener('resize', this.onScroll)
  }

  go(e: Event, id: string) {
    e.preventDefault()
    scrollReadingTo(document.getElementById(id))
    history.replaceState(
      null,
      '',
      location.pathname + location.search + '#' + id,
    )
    this.navigate.emit()
  }
}
