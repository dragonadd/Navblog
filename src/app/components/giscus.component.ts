import { Component, ElementRef, effect, inject, viewChild } from '@angular/core'
import { BlogService } from '../services/blog.service'
import { ThemeService } from '../services/theme.service'

@Component({
  selector: 'app-giscus',
  template: `<div #box class="giscus"></div>`,
})
export class GiscusComponent {
  private blog = inject(BlogService)
  private theme = inject(ThemeService)
  private box = viewChild.required<ElementRef<HTMLElement>>('box')
  private loaded = false

  constructor() {
    effect(() => {
      const dark = this.theme.dark()
      const box = this.box().nativeElement
      if (!this.loaded) {
        this.load(box, dark)
        return
      }
      const iframe = box.querySelector<HTMLIFrameElement>('iframe.giscus-frame')
      iframe?.contentWindow?.postMessage(
        { giscus: { setConfig: { theme: dark ? 'dark' : 'light' } } },
        'https://giscus.app',
      )
    })
  }

  private load(box: HTMLElement, dark: boolean) {
    const g = this.blog.settings().giscus
    if (!g?.enable || !g.repo) return
    this.loaded = true
    const s = document.createElement('script')
    s.src = 'https://giscus.app/client.js'
    s.async = true
    s.crossOrigin = 'anonymous'
    const attrs: Record<string, string> = {
      'data-repo': g.repo,
      'data-repo-id': g.repoId,
      'data-category': g.category,
      'data-category-id': g.categoryId,
      'data-mapping': g.mapping || 'pathname',
      'data-strict': g.strict || '0',
      'data-reactions-enabled': g.reactionsEnabled || '1',
      'data-emit-metadata': '0',
      'data-input-position': g.inputPosition || 'top',
      'data-theme': dark ? 'dark' : 'light',
      'data-lang': g.lang || 'zh-CN',
      'data-loading': 'lazy',
    }
    for (const [k, v] of Object.entries(attrs)) s.setAttribute(k, v)
    box.appendChild(s)
  }
}
