import { Injectable, inject, signal } from '@angular/core'
import { BlogService } from './blog.service'

const HUE_KEY = 'fuwari-theme-hue'
const DARK_KEY = 'blog-dark'

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private blog = inject(BlogService)
  readonly defaultHue = Number(this.blog.settings().themeHue) || 52
  readonly dark = signal(document.documentElement.classList.contains('dark'))
  readonly hue = signal<number>(
    this.blog.settings().themeFixed
      ? this.defaultHue
      : ((window as any).__BLOG_CURRENT_HUE__ ?? this.defaultHue),
  )

  constructor() {
    this.applyHue(this.hue())
  }

  toggleDark() {
    const v = !this.dark()
    this.dark.set(v)
    document.documentElement.classList.toggle('dark', v)
    try {
      localStorage.setItem(DARK_KEY, v ? '1' : '0')
    } catch {}
  }

  setHue(hue: number) {
    hue = Math.max(0, Math.min(360, Math.round(hue)))
    this.hue.set(hue)
    this.applyHue(hue)
    try {
      if (hue === this.defaultHue) localStorage.removeItem(HUE_KEY)
      else localStorage.setItem(HUE_KEY, String(hue))
    } catch {}
  }

  resetHue() {
    this.setHue(this.defaultHue)
  }

  private applyHue(hue: number) {
    document.documentElement.style.setProperty('--hue', String(hue))
  }
}
