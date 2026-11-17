import { DOCUMENT, ViewportScroller } from '@angular/common'
import { Injectable, inject } from '@angular/core'

export function pageScrollElement(
  doc: Document = document,
): HTMLElement | null {
  return doc.querySelector<HTMLElement>('[data-page-scroll]')
}

/** 路由滚动兼容固定布局的正文区域和普通页面。 */
@Injectable()
export class PageViewportScroller extends ViewportScroller {
  private readonly doc = inject(DOCUMENT)
  private readonly browser = this.doc.defaultView!
  private offset = () => [0, 0] as [number, number]

  setOffset(offset: [number, number] | (() => [number, number])) {
    this.offset = typeof offset === 'function' ? offset : () => offset
  }

  getScrollPosition(): [number, number] {
    const root = pageScrollElement(this.doc)
    return root
      ? [root.scrollLeft, root.scrollTop]
      : [this.browser.scrollX, this.browser.scrollY]
  }

  scrollToPosition([left, top]: [number, number], options?: ScrollOptions) {
    const root = pageScrollElement(this.doc)
    ;(root || this.browser).scrollTo({
      left,
      top,
      behavior: 'instant',
      ...options,
    })
    // 进入新页面时，侧栏从顶部开始，目录始终先显示。
    if (left === 0 && top === 0)
      this.doc
        .querySelectorAll<HTMLElement>(
          '.fuwari-fixed-layout .fuwari-sidebar-column',
        )
        .forEach((aside) => aside.scrollTo({ top: 0, behavior: 'instant' }))
  }

  scrollToAnchor(anchor: string, options?: ScrollOptions) {
    const element =
      this.doc.getElementById(anchor) || this.doc.getElementsByName(anchor)[0]
    if (!element) return
    const root = pageScrollElement(this.doc)
    const [, offsetY] = this.offset()
    const top =
      element.getBoundingClientRect().top +
      (root?.scrollTop ?? this.browser.scrollY) -
      (root?.getBoundingClientRect().top ?? 0) -
      offsetY -
      (root ? 16 : 80)
    ;(root || this.browser).scrollTo({ top, behavior: 'instant', ...options })
    element.focus({ preventScroll: true })
  }

  setHistoryScrollRestoration(restoration: 'auto' | 'manual') {
    this.browser.history.scrollRestoration = restoration
  }
}
