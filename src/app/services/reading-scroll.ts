/** 桌面文章使用正文栏；手机和列表页使用浏览器页面。 */
export function readingScrollContainer(): HTMLElement | null {
  return (
    document.querySelector?.<HTMLElement>(
      '.fuwari-reading-layout .fuwari-content-column',
    ) || null
  )
}

export function readingScrollTop(): number {
  return readingScrollContainer()?.scrollTop ?? window.scrollY
}

export function scrollReadingTo(target?: HTMLElement | null, smooth = true) {
  const behavior: ScrollBehavior =
    smooth && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 'smooth'
      : 'instant'
  const container = readingScrollContainer()
  if (container) {
    const top = target
      ? target.getBoundingClientRect().top -
        container.getBoundingClientRect().top +
        container.scrollTop -
        24
      : 0
    container.scrollTo({ top, behavior })
  } else if (target) {
    target.scrollIntoView({ behavior, block: 'start' })
  } else {
    window.scrollTo({ top: 0, behavior })
  }
}
